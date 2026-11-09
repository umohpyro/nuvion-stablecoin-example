import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-nuvion-event-signature";
export const TIMESTAMP_HEADER = "x-nuvion-event-timestamp";
export const EVENT_ID_HEADER = "x-nuvion-event-id";

/** The signature Nuvion sends: HMAC-SHA256 over `{timestamp}.{raw body}`, lowercase hex, keyed with the full `nv_wsk_` secret. */
export function sign(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * Verifies a webhook. Sign the raw body exactly as received: parsing and re-serializing changes the bytes.
 * Compare in constant time.
 */
export function verify(secret: string, rawBody: string, headers: Headers): boolean {
  const timestamp = headers.get(TIMESTAMP_HEADER);
  const received = headers.get(SIGNATURE_HEADER);
  if (!timestamp || !received) return false;
  const expected = Buffer.from(sign(secret, timestamp, rawBody));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Events that can change what the dashboard shows. `webhook.health` and anything else is acknowledged but ignored. */
export const RELEVANT_EVENT = /^(accounts|account_details|inflows|outflows)\./;

export const isRelevant = (event: string | undefined): boolean => Boolean(event && RELEVANT_EVENT.test(event));
