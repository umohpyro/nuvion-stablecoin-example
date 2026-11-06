import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getConfig } from "@/lib/config";
import { formatAmount, formatDate } from "@/lib/money";
import { NuvionError, nuvion, type ApiTransfer } from "@/lib/nuvion";

export const metadata: Metadata = { title: "Transfer status" };

export default function TransferPage({ params }: PageProps<"/activity/[id]">) {
  return (
    <PageShell title="Transfer status" intro="Read from Nuvion on every visit, so it always shows the current state.">
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-2xl" />}>
        <Transfer params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Transfer({ params }: { params: PageProps<"/activity/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9A-Z]{26}$/.test(id)) notFound();

  // Nuvion is the source of truth: the status is read from the API on every visit.
  let t: ApiTransfer;
  try {
    t = await nuvion<ApiTransfer>("GET", `/transfers/${id}?entity_id=${(await getConfig()).entityId}`);
  } catch (e) {
    if (e instanceof NuvionError && e.httpStatus === 404) notFound();
    throw e;
  }
  const unsettled = t.status === "new" || t.status === "pending";
  const Icon = t.status === "successful" ? CircleCheck : t.status === "failed" ? CircleAlert : Clock;
  const tone = t.status === "successful" ? "text-ok" : t.status === "failed" ? "text-destructive" : "text-warn";

  return (
    <Card className="max-w-2xl">
      {unsettled && <AutoRefresh />}
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Icon className={`size-7 ${tone}`} aria-hidden />
          {formatAmount(t.amount, t.currency)} <StatusBadge status={t.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {t.status === "failed" && t.status_reason && <p className="rounded-lg bg-red-50 p-3 text-red-900">{t.status_reason}</p>}
        {unsettled && <p className="text-muted-foreground">Still processing. This page refreshes on its own.</p>}
        <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Direction</dt><dd>{t.type === "inflow" ? "Into the account" : "Out of the account"}</dd>
          <dt className="text-muted-foreground">Method</dt><dd>{t.payment_type}</dd>
          <dt className="text-muted-foreground">Narration</dt><dd>{t.narration}</dd>
          <dt className="text-muted-foreground">Fee</dt><dd>{formatAmount(t.applicable_fee, t.currency)}</dd>
          <dt className="text-muted-foreground">Created</dt><dd>{formatDate(t.created)}</dd>
          <dt className="text-muted-foreground">Transfer ID</dt><dd className="break-all font-mono">{t.id}</dd>
        </dl>
        <Link href="/activity" className="inline-block underline underline-offset-4">Back to activity</Link>
      </CardContent>
    </Card>
  );
}
