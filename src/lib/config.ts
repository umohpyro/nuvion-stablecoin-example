import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { ConfigError } from "@/lib/env";
import { open, seal, SESSION_COOKIE } from "@/lib/seal";

/** One visitor's own Nuvion tenant. Nothing here is shared between visitors. */
export const configSchema = z.object({
  apiKey: z.string().trim().min(10, "Enter your sandbox API key.").max(200),
  /** The approved entity whose accounts are the treasury. */
  entityId: z.string().regex(/^[0-9A-Z]{26}$/, "Choose an entity."),
  /** Set once the visitor registers a webhook from Settings. The signing secret is shown by Nuvion only once, so it is kept here, sealed. */
  webhookId: z.string().regex(/^[0-9A-Z]{26}$/).optional(),
  webhookSecret: z.string().min(10).max(200).optional(),
});
export type Config = z.infer<typeof configSchema>;

const DEV_SECRET = randomBytes(32).toString("hex"); // local dev only: a new value per server start just means connecting again

function secret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new ConfigError("SESSION_SECRET is not set on the server.");
  return DEV_SECRET;
}

/** The visitor's saved settings, or null if they haven't connected yet. */
export async function readConfig(): Promise<Config | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = configSchema.safeParse(await open(secret(), token));
  return parsed.success ? parsed.data : null;
}

export async function getConfig(): Promise<Config> {
  const cfg = await readConfig();
  if (!cfg) throw new ConfigError("Connect your own sandbox on the Settings page first.");
  return cfg;
}

export async function saveConfig(cfg: Config) {
  (await cookies()).set(SESSION_COOKIE, await seal(secret(), cfg), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // eight hours, then they connect again
  });
}

/** What the webhook receiver needs to verify one visitor's deliveries. It has no cookie, because Nuvion calls it, not the browser. */
const tokenSchema = z.object({ secret: z.string().min(10).max(200), entityId: configSchema.shape.entityId });
export type WebhookToken = z.infer<typeof tokenSchema>;

/**
 * The receiver is stateless: its URL carries the webhook's signing secret sealed with SESSION_SECRET, so any
 * serverless instance can verify a delivery without a database. Nuvion stores the URL, but without SESSION_SECRET
 * the token is unreadable and can't be forged.
 */
export const sealWebhookToken = (data: WebhookToken) => seal(secret(), data);

export async function openWebhookToken(token: string): Promise<WebhookToken | null> {
  const parsed = tokenSchema.safeParse(await open(secret(), token));
  return parsed.success ? parsed.data : null;
}

export async function clearConfig() {
  (await cookies()).delete(SESSION_COOKIE);
}
