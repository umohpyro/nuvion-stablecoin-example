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
    <PageShell title="Convert" intro="Move value between a fiat account and a stablecoin account. You get a quote with a locked rate first, then confirm before it expires.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Form />
      </Suspense>
    </PageShell>
  );
}

async function Form() {
  const accounts = (await loadAccounts()).map((a) => ({ id: a.id, label: accountLabel(a), currency: a.currency, availableMinor: a.balance.available }));
  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6"><ConvertForm accounts={accounts} /></CardContent>
    </Card>
  );
}
