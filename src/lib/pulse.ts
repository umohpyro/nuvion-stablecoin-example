/**
 * The "pulse" is a short string the dashboard polls. When it changes, the dashboard refreshes. Pure functions,
 * so they can be unit tested without Next.js.
 */

/** Fingerprint of balances: used when no webhook is registered, so the poll has to diff the balances itself. */
export function balanceStamp(accounts: { id: string; balance: { available: number; current: number } }[]): string {
  return accounts
    .map((a) => `${a.id}:${a.balance.available}:${a.balance.current}`)
    .sort()
    .join("|");
}

/**
 * Stamp for a registered webhook: the newest delivery log Nuvion holds for it. Nuvion is the shared store, so every
 * serverless instance sees the same value. Returns "none" before the first delivery.
 */
export function deliveryStamp(logs: { id: string; event_id?: string }[]): string {
  const newest = logs[0];
  return newest ? `${newest.id}:${newest.event_id ?? ""}` : "none";
}

export type Pulse = { mode: "webhook" | "poll"; stamp: string };
