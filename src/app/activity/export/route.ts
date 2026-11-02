import { csvRow } from "@/lib/csv";
import { ticker } from "@/lib/money";
import { loadAccounts, loadTransfers } from "@/lib/treasury";

/** Activity as a CSV download. Amounts are decimal, in the currency's own unit; fees are in the transfer currency. */
export async function GET() {
  const [transfers, accounts] = await Promise.all([loadTransfers(100), loadAccounts()]);
  const name = (id: string) => accounts.find((a) => a.id === id)?.display_name ?? "";
  const lines = [
    csvRow(["created_utc", "transfer_id", "account", "direction", "method", "currency", "amount", "fee", "status", "status_reason", "narration"]),
    ...transfers.map((t) =>
      csvRow([new Date(t.created).toISOString(), t.id, name(t.account_id), t.type, t.payment_type, ticker(t.currency), (t.amount / 100).toFixed(2), (t.applicable_fee / 100).toFixed(2), t.status, t.status_reason ?? "", t.narration]),
    ),
  ];
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="treasury-activity.csv"', "Cache-Control": "no-store" },
  });
}
