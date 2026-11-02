/**
 * The last webhook event seen per transfer.
 *
 * With Upstash Redis configured (the Vercel integration sets KV_REST_API_URL and KV_REST_API_TOKEN) events are
 * shared by every serverless instance and survive restarts. Without it they live in this process's memory,
 * which is fine locally. Either way every page reads the real state from Nuvion; the store only lets the
 * status page show that a webhook arrived.
 */
export interface SeenEvent {
  eventId: string | null;
  event: string;
  status: string;
  receivedAt: number;
}

const TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX = 500;

const redisUrl = () => process.env.KV_REST_API_URL?.trim() || process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = () => process.env.KV_REST_API_TOKEN?.trim() || process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

/** One Redis command over Upstash's REST API. */
async function redis<T>(...command: (string | number)[]): Promise<T> {
  const res = await fetch(redisUrl()!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis request failed (HTTP ${res.status}).`);
  return ((await res.json()) as { result: T }).result;
}

const redisConfigured = () => Boolean(redisUrl() && redisToken());

const memory = ((globalThis as { __nuvionEvents?: Map<string, SeenEvent> }).__nuvionEvents ??= new Map<string, SeenEvent>());

/** Keeps the first delivery of an event ID and ignores repeats: Nuvion retries and can deliver twice. Returns false for a repeat. */
export async function record(transferId: string, e: SeenEvent): Promise<boolean> {
  if (redisConfigured()) {
    if (e.eventId && (await redis<string | null>("SET", `seen:${e.eventId}`, "1", "NX", "EX", TTL_SECONDS)) === null) return false;
    await redis("SET", `evt:${transferId}`, JSON.stringify(e), "EX", TTL_SECONDS);
    return true;
  }
  const prev = memory.get(transferId);
  if (prev && e.eventId && prev.eventId === e.eventId) return false;
  memory.delete(transferId);
  memory.set(transferId, e);
  if (memory.size > MAX) memory.delete(memory.keys().next().value as string);
  return true;
}

export async function lastEvent(transferId: string): Promise<SeenEvent | null> {
  if (redisConfigured()) {
    try {
      const raw = await redis<string | null>("GET", `evt:${transferId}`);
      return raw ? (JSON.parse(raw) as SeenEvent) : null;
    } catch (e) {
      // The status page must not break because the event store is down; the API read still gives the status.
      console.error(e);
      return null;
    }
  }
  return memory.get(transferId) ?? null;
}

export const clearEvents = () => memory.clear();
