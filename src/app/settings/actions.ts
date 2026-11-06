"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearConfig, configSchema, saveConfig } from "@/lib/config";
import { ConfigError } from "@/lib/env";
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

const keySchema = configSchema.pick({ apiKey: true });

export interface Option { id: string; name: string }

/** Lists the visitor's approved entities, so they can pick one instead of copying an ID. */
export async function lookup(input: z.input<typeof keySchema>) {
  return guard(async () => {
    const { apiKey } = keySchema.parse(input);
    const all = await nuvionAs<List<{ id: string; name: string; status: string }>>(apiKey, "GET", "/entities?limit=50");
    return { entities: all.data.filter((e) => e.status === "approved").slice(0, 10).map((e): Option => ({ id: e.id, name: e.name })) };
  });
}

/** Checks the key can read the entity's accounts, then saves both in the visitor's sealed cookie. */
export async function connect(input: z.input<typeof configSchema>) {
  return guard(async () => {
    const cfg = configSchema.parse(input);
    await nuvionAs(cfg.apiKey, "GET", `/accounts?entity_id=${cfg.entityId}&limit=1`);
    await saveConfig(cfg);
    revalidatePath("/", "layout");
    return {};
  });
}

export async function disconnect() {
  await clearConfig();
  revalidatePath("/", "layout");
}
