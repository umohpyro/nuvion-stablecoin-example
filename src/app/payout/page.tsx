import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { PayoutForm } from "@/components/payout-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { accountLabel, loadAccounts, stablecoinAccounts } from "@/lib/treasury";

export const metadata: Metadata = { title: "Cash out" };

export default function PayoutPage() {
  return (
    <PageShell title="Cash out" intro="Convert a stablecoin balance to pounds and pay it into a UK bank account. You get a quote with a locked rate, then confirm before it expires.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Form />
      </Suspense>
    </PageShell>
  );
}

async function Form() {
  const accounts = stablecoinAccounts(await loadAccounts()).map((a) => ({ id: a.id, label: accountLabel(a), currency: a.currency, availableMinor: a.balance.available }));
  return (
    <Card className="max-w-3xl">
      <CardContent className="pt-6"><PayoutForm accounts={accounts} /></CardContent>
    </Card>
  );
}
