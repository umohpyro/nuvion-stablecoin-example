/**
 * The last webhook event seen per transfer, kept in memory.
 *
 * Shortcut: this lives in one server process, so it is empty after a restart and not shared between
 * serverless instances. That is fine here because every page reads the real state from Nuvion anyway;
 * the store only lets the status page show that a webhook arrived. Replace it with a database table
 * (event ID as a unique key) before relying on it for anything else.
 */
export interface SeenEvent {
  eventId: string | null;
  event: string;
  status: string;
  receivedAt: number;
}

const store = (globalThis as { __nuvionEvents?: Map<string, SeenEvent> }).__nuvionEvents ?? new Map<string, SeenEvent>();
(globalThis as { __nuvionEvents?: Map<string, SeenEvent> }).__nuvionEvents = store;

const MAX = 500;

/** Keeps the first delivery of an event ID and ignores repeats: Nuvion retries and can deliver twice. */
export function record(transferId: string, e: SeenEvent): boolean {
  const prev = store.get(transferId);
  if (prev && e.eventId && prev.eventId === e.eventId) return false;
  store.delete(transferId);
  store.set(transferId, e);
  if (store.size > MAX) store.delete(store.keys().next().value as string);
  return true;
}

export const lastEvent = (transferId: string) => store.get(transferId) ?? null;
export const clearEvents = () => store.clear();
