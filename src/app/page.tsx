import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAINS } from "@/lib/chains";
import { formatAmount, formatDate, isStablecoin, ticker } from "@/lib/money";
import { loadAccounts, loadTransfers, type TreasuryAccount } from "@/lib/treasury";

export default function BalancesPage() {
  return (
    <PageShell title="Balances" intro="Every account in the treasury, by currency and network. Available is what you can spend now; current includes funds still settling.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Balances />
      </Suspense>
    </PageShell>
  );
}

/** One line per account: its name and network on the left, what is available on the right. */
function AccountRows({ accounts, empty }: { accounts: TreasuryAccount[]; empty: React.ReactNode }) {
  if (accounts.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {accounts.map((a) => (
        <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate font-medium">{a.display_name}</span>
            <span className="block text-xs text-muted-foreground">{a.chain ? `${ticker(a.currency)} · ${CHAINS[a.chain].name} network` : isStablecoin(a.currency) ? "No wallet yet" : `${a.currency} account`}</span>
          </span>
          <span className="shrink-0 text-lg font-bold tabular-nums">{formatAmount(a.balance.available, a.currency)}</span>
        </li>
      ))}
    </ul>
  );
}

async function Balances() {
  const [accounts, recent] = await Promise.all([loadAccounts(), loadTransfers(5)]);
  // Stablecoins here are pegged 1:1 to USD, so USDC and USDT sum into one dollar figure.
  const stable = accounts.filter((a) => isStablecoin(a.currency));
  const stableTotal = stable.reduce((sum, a) => sum + a.balance.available, 0);
  const fiat = accounts.filter((a) => !isStablecoin(a.currency));
  const fiatCurrencies = new Set(fiat.map((a) => a.currency));
  const fiatTotal = fiat.reduce((sum, a) => sum + a.balance.available, 0);
  const name = (id: string) => accounts.find((a) => a.id === id)?.display_name ?? "Account";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Stablecoins available</CardDescription>
            <CardTitle className="text-3xl font-extrabold tabular-nums">{formatAmount(stableTotal, "USD")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountRows accounts={stable} empty={<>No stablecoin accounts yet. <Link href="/deposit" className="underline underline-offset-4">Add a deposit address</Link>.</>} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Fiat available</CardDescription>
            <CardTitle className="text-3xl font-extrabold tabular-nums">{fiatCurrencies.size === 1 ? formatAmount(fiatTotal, [...fiatCurrencies][0]) : fiat.length === 0 ? "None" : "Mixed currencies"}</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountRows accounts={fiat} empty="No fiat accounts." />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/deposit" className={buttonVariants()}>Deposit</Link>
        <Link href="/convert" className={buttonVariants({ variant: "outline" })}>Convert</Link>
        <Link href="/send" className={buttonVariants({ variant: "outline" })}>Send</Link>
        <Link href="/payout" className={buttonVariants({ variant: "outline" })}>Cash out</Link>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent activity</CardTitle>
          <Link href="/activity" className="text-sm underline underline-offset-4">View all</Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet. Convert some funds to get started.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link href={`/activity/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{name(t.account_id)}</span>
                      <span className="block text-xs text-muted-foreground">{t.narration} · {formatDate(t.created)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums">{t.type === "inflow" ? "+" : "-"}{formatAmount(t.amount, t.currency)}</span>
                      <StatusBadge status={t.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account details</CardTitle><CardDescription>Available is spendable now; current includes funds still settling.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 font-medium">Asset</th>
                <th className="py-2 pr-4 font-medium">Network</th>
                <th className="py-2 pr-4 text-right font-medium">Available</th>
                <th className="py-2 text-right font-medium">Current</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{a.display_name}</td>
                  <td className="py-3 pr-4">{ticker(a.currency)}</td>
                  <td className="py-3 pr-4">
                    {a.chain ? CHAINS[a.chain].name : isStablecoin(a.currency) ? <Badge variant="outline">No wallet</Badge> : <span className="text-muted-foreground">Bank</span>}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatAmount(a.balance.available, a.currency)}</td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">{formatAmount(a.balance.current, a.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
