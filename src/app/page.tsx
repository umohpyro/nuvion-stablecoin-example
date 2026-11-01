import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAINS } from "@/lib/chains";
import { formatAmount, isStablecoin, ticker } from "@/lib/money";
import { loadAccounts } from "@/lib/treasury";

export default function BalancesPage() {
  return (
    <PageShell title="Balances" intro="Every account in the treasury, by currency and network. Available is what you can spend now; current includes funds still settling.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Balances />
      </Suspense>
    </PageShell>
  );
}

async function Balances() {
  const accounts = await loadAccounts();
  // Stablecoins here are pegged 1:1 to USD, so USDC and USDT sum into one dollar figure.
  const stable = accounts.filter((a) => isStablecoin(a.currency));
  const stableTotal = stable.reduce((sum, a) => sum + a.balance.available, 0);
  const fiat = accounts.filter((a) => !isStablecoin(a.currency));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Stablecoins available</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-extrabold">{formatAmount(stableTotal, "USD")}</p><p className="mt-1 text-sm text-muted-foreground">Across {stable.length} stablecoin account{stable.length === 1 ? "" : "s"}, counted at 1 USD each.</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Fiat available</CardTitle></CardHeader>
          <CardContent>
            {fiat.length === 0 ? <p className="text-sm text-muted-foreground">No fiat accounts.</p> : fiat.map((a) => <p key={a.id} className="text-3xl font-extrabold">{formatAmount(a.balance.available, a.currency)}</p>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
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

      <div className="flex flex-wrap gap-3">
        <Link href="/deposit" className={buttonVariants()}>Deposit</Link>
        <Link href="/convert" className={buttonVariants({ variant: "outline" })}>Convert</Link>
        <Link href="/send" className={buttonVariants({ variant: "outline" })}>Send</Link>
      </div>
    </div>
  );
}
