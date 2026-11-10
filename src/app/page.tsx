import { Suspense } from "react";
import { BalancesView, INTRO } from "@/components/balances-view";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { loadAccounts, loadTransfers } from "@/lib/treasury";

export default function BalancesPage() {
  return (
    <Suspense
      fallback={
        <PageShell eyebrow="Treasury position" title="Balances" intro={INTRO}>
          <Skeleton className="h-72 w-full" />
        </PageShell>
      }
    >
      <Balances />
    </Suspense>
  );
}

async function Balances() {
  const [accounts, recent] = await Promise.all([loadAccounts(), loadTransfers(5)]);
  return <BalancesView accounts={accounts} recent={recent} />;
}
