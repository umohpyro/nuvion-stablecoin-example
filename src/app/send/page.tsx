import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { SendForm } from "@/components/send-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { accountLabel, loadAccounts, stablecoinAccounts } from "@/lib/treasury";

export const metadata: Metadata = { title: "Send" };

export default function SendPage() {
  return (
    <PageShell title="Send" intro="Send USDC or USDT to an external wallet. The address is checked against the network, and you confirm the details before anything is sent.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Form />
      </Suspense>
    </PageShell>
  );
}

async function Form() {
  const accounts = stablecoinAccounts(await loadAccounts()).map((a) => ({
    id: a.id,
    label: accountLabel(a),
    currency: a.currency,
    availableMinor: a.balance.available,
    chain: a.chain,
  }));
  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6"><SendForm accounts={accounts} /></CardContent>
    </Card>
  );
}
