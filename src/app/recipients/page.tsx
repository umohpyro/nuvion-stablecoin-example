import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { RecipientForm } from "@/components/recipient-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAINS } from "@/lib/chains";
import { env } from "@/lib/env";
import { listRecipients } from "@/lib/treasury";

export const metadata: Metadata = { title: "Recipients" };

export default function RecipientsPage() {
  return (
    <PageShell title="Recipients" intro="Saved wallet addresses. Each one is a Nuvion counterparty that stores its network and address, so sends to it can't be redirected from the browser.">
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
                <li key={r.id} className="py-3">
                  <p className="font-medium">{r.name} <span className="font-normal text-muted-foreground">· {CHAINS[r.chain].name}</span></p>
                  <p className="break-all font-mono text-muted-foreground">{r.address}</p>
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
