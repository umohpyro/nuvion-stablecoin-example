import { readConfig } from "@/lib/config";
import { nuvionAs, type List } from "@/lib/nuvion";
import { balanceStamp, deliveryStamp, type Pulse } from "@/lib/pulse";

/**
 * The dashboard polls this. It returns a short stamp, and the browser refreshes the page when the stamp changes.
 * One Nuvion call per poll, in either mode:
 *  - webhook registered: the newest delivery log for that webhook. Nuvion holds it, so every serverless instance agrees.
 *  - no webhook: a fingerprint of the account balances, so the poll diffs them itself.
 */
export async function GET() {
  const cfg = await readConfig();
  if (!cfg) return Response.json({ error: "Not connected." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  let pulse: Pulse;
  if (cfg.webhookId) {
    const logs = await nuvionAs<List<{ id: string; event_id?: string }>>(cfg.apiKey, "GET", `/webhook-logs?entity_webhook_id=${cfg.webhookId}&entity_id=${cfg.entityId}&limit=1`);
    pulse = { mode: "webhook", stamp: deliveryStamp(logs.data) };
  } else {
    const accounts = await nuvionAs<List<{ id: string; balance: { available: number; current: number } }>>(cfg.apiKey, "GET", `/accounts?entity_id=${cfg.entityId}&limit=100`);
    pulse = { mode: "poll", stamp: balanceStamp(accounts.data) };
  }
  return Response.json(pulse, { headers: { "Cache-Control": "no-store" } });
}
