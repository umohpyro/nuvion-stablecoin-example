import type { Metadata } from "next";
import { Suspense } from "react";
import { ChainChip } from "@/components/assets";
import { PageShell } from "@/components/page-shell";
import { RecipientForm } from "@/components/recipient-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { listRecipients } from "@/lib/treasury";

export const metadata: Metadata = { title: "Recipients" };

export default function RecipientsPage() {
  return (
    <PageShell eyebrow="Address book" title="Recipients" intro="Saved wallet addresses. Each one is a Nuvion counterparty that stores its network and address, so sends to it can't be redirected from the browser.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Book />
      </Suspense>
    </PageShell>
  );
}

async function Book() {
  const recipients = await listRecipients();
  return (
    <div className="space-y-6">
      {env.sendOnlyToSaved && <Badge variant="secondary">Allow list on: sends go to saved recipients only</Badge>}
      <Card>
        <CardHeader><CardTitle>Saved recipients</CardTitle></CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recipients.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-c text-sm font-extrabold text-white" aria-hidden>{r.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.name}</span><ChainChip chain={r.chain} /></span>
                    <span className="mt-1 block font-mono text-[0.82rem] break-all text-muted-foreground">{r.address}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add a recipient</CardTitle>
          <CardDescription>The address is checked against the network before it is saved.</CardDescription>
        </CardHeader>
        <CardContent><RecipientForm /></CardContent>
      </Card>
    </div>
  );
}
