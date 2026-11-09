import { openWebhookToken } from "@/lib/config";
import { isRelevant, verify } from "@/lib/webhook";

/**
 * Nuvion webhook receiver. The URL path carries a sealed token holding this webhook's signing secret, because
 * Nuvion calls this route with no cookie and the app has no database to look the secret up in. In order:
 *   1. Read the raw body. Never re-serialize parsed JSON before verifying.
 *   2. Open the token to get the secret, then verify the HMAC-SHA256 signature in constant time. Reject anything that fails.
 *   3. Acknowledge with a 2xx quickly. Any other status counts as a failed delivery, and three failures in 24 hours
 *      blacklist the webhook.
 *
 * The handler stores nothing. The dashboard learns about events from Nuvion's own delivery log (see /api/pulse),
 * and the event is only a trigger: pages read the current state from the API before showing it.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/nuvion/[token]">) {
  const { token } = await ctx.params;
  const raw = await request.text();

  // The placeholder URL used while a webhook is being created, before its secret is known. It does nothing.
  if (token === "pending") return Response.json({ received: false });

  const opened = await openWebhookToken(token);
  if (!opened) return Response.json({ error: "Unknown webhook." }, { status: 404 });
  if (!verify(opened.secret, raw, request.headers)) return Response.json({ error: "Invalid signature." }, { status: 401 });

  let body: { event?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Body isn't valid JSON." }, { status: 400 });
  }

  // `webhook.health` (sent when the URL is registered or changed) and unrelated events are acknowledged and ignored.
  return Response.json({ received: true, relevant: isRelevant(body.event) });
}
