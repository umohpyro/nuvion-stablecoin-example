import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { PageShell } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IssueWalletForm, NewWalletForm } from "@/components/wallet-forms";
import { CHAINS } from "@/lib/chains";
import { ticker } from "@/lib/money";
import { loadAccounts, stablecoinAccounts } from "@/lib/treasury";

export const metadata: Metadata = { title: "Deposit" };

export default function DepositPage() {
  return (
    <PageShell title="Deposit" intro="Each stablecoin account has one wallet address on one network. To receive on a second network, create a second account.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Wallets />
      </Suspense>
    </PageShell>
  );
}

async function Wallets() {
  const accounts = stablecoinAccounts(await loadAccounts());

  return (
    <div className="space-y-6">
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Send only the right asset on the right network</AlertTitle>
        <AlertDescription>
          A deposit address works for one asset on one network. USDC sent on a different network, or USDT sent to a USDC address, can be lost for good. Check both before you send.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {a.display_name}
                {a.wallet && <Badge variant={a.wallet.status === "active" ? "secondary" : "outline"}>{a.wallet.status === "active" ? "Ready" : "Provisioning"}</Badge>}
              </CardTitle>
              {a.chain && <CardDescription>Accepts {ticker(a.currency)} on {CHAINS[a.chain].name} only.</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {a.wallet && a.chain ? (
                <>
                  <p className="break-all rounded-lg bg-muted p-3 font-mono" data-testid="wallet-address">{a.wallet.account_number}</p>
                  <div className="flex items-center justify-between gap-3">
                    <CopyButton value={a.wallet.account_number} label={`Copy ${a.display_name} address`} />
                    <p className="font-medium">{ticker(a.currency)} · {CHAINS[a.chain].name}</p>
                  </div>
                  {a.wallet.status !== "active" && <p className="text-muted-foreground">The address is still being provisioned. Reload in a few seconds before you share it.</p>}
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">This account has no wallet yet. Choose a network, which can&apos;t be changed later.</p>
                  <IssueWalletForm accountId={a.id} />
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a deposit address</CardTitle>
          <CardDescription>Creates a stablecoin account and issues its wallet on the network you choose.</CardDescription>
        </CardHeader>
        <CardContent><NewWalletForm /></CardContent>
      </Card>
    </div>
  );
}
