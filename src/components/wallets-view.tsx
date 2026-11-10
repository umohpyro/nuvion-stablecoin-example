import { TriangleAlert } from "lucide-react";
import { AssetGlyph, assetTone, ChainChip, Chip } from "@/components/assets";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IssueWalletForm, NewWalletForm } from "@/components/wallet-forms";
import { CHAINS } from "@/lib/chains";
import { ticker } from "@/lib/money";
import type { TreasuryAccount } from "@/lib/treasury";

/** `qr` maps an account id to a QR data URL, for the accounts whose wallet is active. */
export function WalletsView({ accounts, qr }: { accounts: TreasuryAccount[]; qr: Map<string, string> }) {
  return (
    <div className="space-y-8">
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Send only the right asset on the right network</AlertTitle>
        <AlertDescription>
          A deposit address works for one asset on one network. USDC sent on a different network, or USDT sent to a USDC address, can be lost for good. Check both before you send.
        </AlertDescription>
      </Alert>

      <div className="grid gap-5 lg:grid-cols-2">
        {accounts.map((a) => (
          <Card key={a.id} className="gap-0 py-0">
            <div className={`flex items-center justify-between gap-3 px-5 py-4 text-white ${assetTone(a.currency)}`}>
              <span className="flex items-center gap-3">
                <AssetGlyph currency={a.currency} size={40} className="ring-white/30" />
                <span className="font-extrabold">{a.display_name}</span>
              </span>
              {a.wallet && <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold">{a.wallet.status === "active" ? "Ready" : "Provisioning"}</span>}
            </div>
            <CardContent className="space-y-4 py-5 text-sm">
              {a.wallet && a.chain ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip>{ticker(a.currency)}</Chip>
                    <ChainChip chain={a.chain} />
                    <span className="text-muted-foreground">Accepts {ticker(a.currency)} on {CHAINS[a.chain].name} only.</span>
                  </div>
                  <div className="flex flex-col items-start gap-4 sm:flex-row">
                    {a.wallet.status === "active" && (
                      // A QR needs a light tile in both themes to scan.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr.get(a.id)} alt={`QR code for the ${a.display_name} address`} width={144} height={144} className="size-36 shrink-0 rounded-2xl border bg-white p-1.5" />
                    )}
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="text-[0.72rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">Wallet address</p>
                      <p className="rounded-xl bg-muted p-3 font-mono text-[0.82rem] leading-relaxed break-all" data-testid="wallet-address">{a.wallet.account_number}</p>
                      <CopyButton value={a.wallet.account_number} label={`Copy ${a.display_name} address`} />
                    </div>
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
