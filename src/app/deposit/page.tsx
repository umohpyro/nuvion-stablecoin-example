import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletsView } from "@/components/wallets-view";
import { loadAccounts, stablecoinAccounts } from "@/lib/treasury";

export const metadata: Metadata = { title: "Deposit" };

export default function DepositPage() {
  return (
    <PageShell eyebrow="Receive" title="Deposit" intro="Each stablecoin account has one wallet address on one network. To receive on a second network, create a second account.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Wallets />
      </Suspense>
    </PageShell>
  );
}

async function Wallets() {
  const accounts = stablecoinAccounts(await loadAccounts());
  // Only an active wallet is safe to share, so only those get a QR code.
  const qr = new Map(await Promise.all(accounts.filter((a) => a.wallet?.status === "active").map(async (a) => [a.id, await QRCode.toDataURL(a.wallet!.account_number, { margin: 1, width: 192 })] as const)));
  return <WalletsView accounts={accounts} qr={qr} />;
}
