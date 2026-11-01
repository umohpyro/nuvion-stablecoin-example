import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatDate } from "@/lib/money";
import { loadAccounts, loadTransfers } from "@/lib/treasury";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <PageShell title="Activity" intro="Recent transfers on every account. Each row opens its status page.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Rows />
      </Suspense>
    </PageShell>
  );
}

const KIND: Record<string, string> = { "book-transfer": "Conversion", "stablecoin-transfer": "Stablecoin", "bank-transfer": "Bank", "card-acq": "Card" };

async function Rows() {
  const [transfers, accounts] = await Promise.all([loadTransfers(), loadAccounts()]);
  const name = (id: string) => accounts.find((a) => a.id === id)?.display_name ?? "Account";
  const unsettled = transfers.some((t) => t.status === "new" || t.status === "pending");

  return (
    <Card>
      {unsettled && <AutoRefresh />}
      <CardContent className="overflow-x-auto">
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transfers yet. Convert some funds to get started.</p>
        ) : (
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 text-right font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <Link href={`/activity/${t.id}`} className="underline-offset-4 hover:underline">{formatDate(t.created)}</Link>
                  </td>
                  <td className="py-3 pr-4">{KIND[t.payment_type] ?? t.payment_type} {t.type === "inflow" ? "in" : "out"}</td>
                  <td className="py-3 pr-4">{name(t.account_id)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{t.type === "inflow" ? "+" : "-"}{formatAmount(t.amount, t.currency)}</td>
                  <td className="py-3"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
