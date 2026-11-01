import { Circle, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { nuvion, type List } from "@/lib/nuvion";
import { getOrigin } from "@/lib/origin";

export const metadata: Metadata = { title: "Setup" };

const CHECKS = [
  { key: "apiKey", name: "NUVION_API_KEY", help: "Your sandbox API key, from app.nuvion.dev Settings > Developers." },
  { key: "entityId", name: "NUVION_ENTITY_ID", help: "The approved entity that owns the treasury. Find it in the list below." },
  { key: "webhookSecret", name: "NUVION_WEBHOOK_SECRET", help: "Optional. The signing secret returned when you register a webhook." },
] as const;

export default function SetupPage() {
  const status = env.status;
  return (
    <PageShell title="Setup" intro="Everything this app needs from Nuvion, and whether it is set. Add each value in your host's environment settings, then redeploy.">
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {CHECKS.map((c) => (
                <li key={c.key} className="flex items-start gap-3 py-3">
                  {status[c.key] ? <CircleCheck className="mt-0.5 size-4 text-emerald-600" aria-label="Set" /> : <Circle className="mt-0.5 size-4 text-muted-foreground" aria-label="Not set" />}
                  <div>
                    <p className="font-mono text-sm font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.help}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Lookup />
        </Suspense>
        <Suspense fallback={null}>
          <WebhookHint />
        </Suspense>
      </div>
    </PageShell>
  );
}

/** Lists approved entities so you can copy an ID. Hidden once an entity is configured, so a finished deployment never lists them to visitors. */
async function Lookup() {
  const s = env.status;
  if (!s.apiKey) return null;
  if (s.entityId) return <p className="text-sm text-muted-foreground">Setup is complete. The entity lookup is hidden once NUVION_ENTITY_ID is set.</p>;
  const entities = await nuvion<List<{ id: string; name: string; status: string }>>("GET", "/entities?limit=50").then((r) => r.data.filter((e) => e.status === "approved")).catch(() => null);
  return (
    <Card>
      <CardHeader><CardTitle>Approved entities</CardTitle><CardDescription>Pick one. Its accounts are the treasury.</CardDescription></CardHeader>
      <CardContent className="text-sm">
        {!entities ? <p className="text-muted-foreground">Couldn&apos;t load entities. Check the API key.</p> : entities.length === 0 ? <p className="text-muted-foreground">None approved yet.</p> : (
          <ul className="space-y-1">{entities.map((e) => <li key={e.id}><span className="font-medium">{e.name}</span> <code className="font-mono text-xs text-muted-foreground">{e.id}</code></li>)}</ul>
        )}
      </CardContent>
    </Card>
  );
}

async function WebhookHint() {
  const origin = await getOrigin();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook endpoint</CardTitle>
        <CardDescription>Register this URL with Nuvion (POST /entity-webhooks). Subscribe to <code className="font-mono">outflows.created</code>, <code className="font-mono">outflows.completed</code>, <code className="font-mono">outflows.failed</code> and <code className="font-mono">inflows.completed</code>.</CardDescription>
      </CardHeader>
      <CardContent><code className="break-all font-mono text-sm">{origin}/api/webhooks/nuvion</code></CardContent>
    </Card>
  );
}
