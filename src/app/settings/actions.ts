"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { clearConfig, configSchema, getConfig, readConfig, saveConfig, sealWebhookToken } from "@/lib/config";
import { ConfigError } from "@/lib/env";
import { publicHttpsOrigin } from "@/lib/origin";
import { limited } from "@/lib/ratelimit";
import { NuvionError, nuvionAs, type List } from "@/lib/nuvion";

/*
 * Server Actions are public POST endpoints. These ones only ever act with the key the visitor typed, on that
 * visitor's own Nuvion tenant, so there is no shared secret here to protect.
 */

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof NuvionError) {
      if (e.httpStatus === 401) return { ok: false, error: "Nuvion rejected that API key. Check it is a sandbox key from your own dashboard." };
      return { ok: false, error: e.summary };
    }
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check your details." };
    if (e instanceof ConfigError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** These actions call Nuvion with a key a stranger typed, from this server, so cap how often one address can try. */
async function throttle() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const wait = limited(ip, 10, 60_000);
  if (wait) throw new ConfigError(`Too many attempts. Try again in ${wait} seconds.`);
}

const keySchema = configSchema.pick({ apiKey: true });

export interface Option { id: string; name: string }

/** Lists the visitor's approved entities, so they can pick one instead of copying an ID. */
export async function lookup(input: z.input<typeof keySchema>) {
  return guard(async () => {
    await throttle();
    const { apiKey } = keySchema.parse(input);
    const all = await nuvionAs<List<{ id: string; name: string; status: string }>>(apiKey, "GET", "/entities?limit=50");
    return { entities: all.data.filter((e) => e.status === "approved").slice(0, 10).map((e): Option => ({ id: e.id, name: e.name })) };
  });
}

/** Same list for the key already sealed in the cookie, so a connected visitor can switch entity without retyping it. */
export async function lookupStored() {
  return guard(async () => {
    await throttle();
    const { apiKey } = await getConfig();
    const all = await nuvionAs<List<{ id: string; name: string; status: string }>>(apiKey, "GET", "/entities?limit=50");
    return { entities: all.data.filter((e) => e.status === "approved").slice(0, 10).map((e): Option => ({ id: e.id, name: e.name })) };
  });
}

/** Moves a connected visitor to another of their entities. The key stays sealed on the server. */
export async function switchEntity(input: { entityId: string }) {
  const cfg = await getConfig();
  await dropWebhook(cfg); // a webhook belongs to one entity, so it doesn't follow the visitor to another
  return connect({ apiKey: cfg.apiKey, entityId: input.entityId });
}

/** Checks the key can read the entity's accounts, then saves both in the visitor's sealed cookie. */
export async function connect(input: z.input<typeof configSchema>) {
  return guard(async () => {
    await throttle();
    const cfg = configSchema.parse(input);
    await nuvionAs(cfg.apiKey, "GET", `/accounts?entity_id=${cfg.entityId}&limit=1`);
    await saveConfig({ apiKey: cfg.apiKey, entityId: cfg.entityId }); // a fresh connection starts with no webhook
    revalidatePath("/", "layout");
    return {};
  });
}

export async function disconnect() {
  const cfg = await readConfig();
  if (cfg) await dropWebhook(cfg);
  await clearConfig();
  revalidatePath("/", "layout");
}

/* ---------------- Webhook: live balance refresh ---------------- */

/** Every event group is sent in full, because Nuvion rejects a group with a missing event. Only events that change what the dashboard shows. */
const EVENTS = {
  accounts: { created: true, updated: false, deleted: false },
  account_details: { created: true, updated: true, deleted: true },
  inflows: { completed: true, failed: true },
  outflows: { created: true, completed: true, failed: true, cancelled: true, refunded: true },
};

/** This app's public address: an explicit PUBLIC_APP_URL, then the production URL Vercel provides, then the host of this request. */
async function appOrigin(): Promise<string> {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https")}://${host}`;
}

/** Deletes the visitor's webhook at Nuvion. Best effort: a webhook that is already gone, or a failed call, must not block disconnecting. */
async function dropWebhook(cfg: { apiKey: string; entityId: string; webhookId?: string }) {
  if (!cfg.webhookId) return;
  try {
    await nuvionAs(cfg.apiKey, "DELETE", `/entity-webhooks/${cfg.webhookId}`, { entity_id: cfg.entityId });
  } catch (e) {
    if (!(e instanceof NuvionError && e.httpStatus === 404)) console.error("Couldn't delete the webhook", e);
  }
}

/**
 * Registers a webhook for the visitor's entity. Two steps, because the receiver is stateless and needs the signing
 * secret inside its URL, and Nuvion only reveals the secret after the webhook exists:
 *   1. POST /entity-webhooks with a placeholder URL. The response carries the secret, once.
 *   2. PATCH the URL to one that carries the secret sealed with SESSION_SECRET. Nuvion first sends a signed
 *      webhook.health request to it and applies the change only if the receiver answers 2xx, so this also proves
 *      the receiver verifies signatures correctly.
 * The secret is also sealed in the visitor's cookie, since Nuvion can't show it again.
 */
export async function registerWebhook() {
  return guard(async () => {
    await throttle();
    const cfg = await getConfig();
    if (cfg.webhookId) throw new ConfigError("A webhook is already registered. Remove it first.");
    const origin = publicHttpsOrigin(await appOrigin());
    if (!origin) throw new ConfigError("Nuvion only delivers webhooks to a public https address, and this app is running on localhost or plain http. Open the deployed app, or an https tunnel to this one, and register from there.");

    const created = await nuvionAs<{ id: string; secret: string }>(cfg.apiKey, "POST", "/entity-webhooks", {
      url: `${origin}/api/webhooks/nuvion/pending`,
      expires_in: 31536000, // required; Nuvion stores it but doesn't expire the webhook
      entity_id: cfg.entityId,
      description: "Stablecoin treasury example: live balance refresh",
      enabled_events: EVENTS,
    });
    try {
      const token = await sealWebhookToken({ secret: created.secret, entityId: cfg.entityId });
      await nuvionAs(cfg.apiKey, "PATCH", `/entity-webhooks/${created.id}`, { entity_id: cfg.entityId, url: `${origin}/api/webhooks/nuvion/${token}` });
    } catch (e) {
      await dropWebhook({ ...cfg, webhookId: created.id }); // don't leave a webhook pointing at the placeholder
      throw e;
    }
    await saveConfig({ ...cfg, webhookId: created.id, webhookSecret: created.secret });
    revalidatePath("/", "layout");
    return {};
  });
}

/** Asks Nuvion to deliver a test event to the registered webhook and reports how the receiver answered. */
export async function sendTestWebhook() {
  return guard(async () => {
    await throttle();
    const cfg = await getConfig();
    if (!cfg.webhookId) throw new ConfigError("Register a webhook first.");
    const r = await nuvionAs<{ response?: { status?: number } }>(cfg.apiKey, "POST", "/webhook-tests", {
      entity_webhook_id: cfg.webhookId,
      event_group: "outflows",
      event_name: "completed",
      entity_id: cfg.entityId,
    });
    return { status: r.response?.status ?? 0 };
  });
}

export async function removeWebhook() {
  return guard(async () => {
    const cfg = await getConfig();
    await dropWebhook(cfg);
    await saveConfig({ apiKey: cfg.apiKey, entityId: cfg.entityId });
    revalidatePath("/", "layout");
    return {};
  });
}
