import { env } from "@/lib/env";
import { record } from "@/lib/events";
import { EVENT_ID_HEADER, verify } from "@/lib/webhook";

/**
 * Nuvion webhook receiver. In order:
 *   1. Read the raw body. Never re-serialize parsed JSON before verifying.
 *   2. Verify the HMAC-SHA256 signature in constant time and reject anything that fails.
 *   3. Remember the event, skipping a repeated event ID (Nuvion retries and can deliver twice).
 *   4. Acknowledge with a 2xx quickly. Any other status makes Nuvion retry.
 *
 * The event is only a hint that something changed. The status page reads the transfer from Nuvion
 * before showing a status, so a stale or replayed event can't mark money as moved.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = env.webhookSecret;
  if (!secret) return Response.json({ error: "No webhook secret configured." }, { status: 503 });
  if (!verify(secret, raw, request.headers)) return Response.json({ error: "Invalid signature." }, { status: 401 });

  let body: { event?: string; data?: { id?: string; status?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Body isn't valid JSON." }, { status: 400 });
  }

  // Transfer events are outflows.* and inflows.*; their data.id is the transfer ID.
  if (body.event && /^(outflows|inflows)\./.test(body.event) && body.data?.id) {
    await record(body.data.id, { eventId: request.headers.get(EVENT_ID_HEADER), event: body.event, status: body.data.status ?? "", receivedAt: Date.now() });
  }
  return Response.json({ received: true });
}
