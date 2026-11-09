import type { Metadata } from "next";
import { Suspense } from "react";
import { ConvertForm } from "@/components/convert-form";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { accountLabel, loadAccounts } from "@/lib/treasury";

export const metadata: Metadata = { title: "Convert" };

export default function ConvertPage() {
  return (
    <PageShell eyebrow="Swap" title="Convert" intro="Move value between a fiat account and a stablecoin account. You get a quote with a locked rate first, then confirm before it expires.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Form />
      </Suspense>
    </PageShell>
  );
}

async function Form() {
  const accounts = (await loadAccounts()).map((a) => ({ id: a.id, label: accountLabel(a), currency: a.currency, availableMinor: a.balance.available }));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,40rem)_1fr]">
      <Card>
        <CardContent><ConvertForm accounts={accounts} /></CardContent>
      </Card>
      <aside className="space-y-3 text-sm text-muted-foreground lg:pt-2">
        <h2 className="text-base font-bold text-foreground">How a conversion runs</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Choose the account to pay from, the account to receive into, and an amount.</li>
          <li>Get a quote. Nuvion locks the rate and the strip shows the time left.</li>
          <li>Confirm before it expires. The transfer then opens on its status page.</li>
        </ol>
        <p>Converting between USD and a stablecoin changes the form of the balance, not its dollar value.</p>
      </aside>
    </div>
  );
}
