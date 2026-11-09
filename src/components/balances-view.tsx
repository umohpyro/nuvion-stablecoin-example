import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AssetGlyph, assetTone, ChainChip, Chip } from "@/components/assets";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAmount, formatDate, isStablecoin, ticker } from "@/lib/money";
import type { ApiTransfer } from "@/lib/nuvion";
import type { TreasuryAccount } from "@/lib/treasury";

export const INTRO = "Every account in the treasury, grouped by asset. Available is what you can spend now; current includes funds still settling.";

/** Groups accounts by currency, keeping the order each currency first appears in. */
function byAsset(accounts: TreasuryAccount[]) {
  const groups = new Map<string, TreasuryAccount[]>();
  for (const a of accounts) groups.set(a.currency, [...(groups.get(a.currency) ?? []), a]);
  return [...groups.entries()].map(([currency, list]) => ({
    currency,
    accounts: list,
    available: list.reduce((n, a) => n + a.balance.available, 0),
    current: list.reduce((n, a) => n + a.balance.current, 0),
  }));
}

/** One bar split by stablecoin account, so the mix of assets and networks reads at a glance. */
function AllocationBar({ accounts, total }: { accounts: TreasuryAccount[]; total: number }) {
  const held = accounts.filter((a) => a.balance.available > 0);
  if (total <= 0 || held.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Allocation: ${held.map((a) => `${a.display_name} ${Math.round((a.balance.available / total) * 100)}%`).join(", ")}`}>
        {held.map((a) => (
          <span key={a.id} className={`h-full ${assetTone(a.currency)}`} style={{ flexGrow: a.balance.available }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-band-foreground/85">
        {held.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${assetTone(a.currency)}`} aria-hidden />
            {a.chain ? `${ticker(a.currency)} on ${a.chain.toUpperCase()}` : ticker(a.currency)}
            <span className="font-semibold tabular-nums text-band-foreground">{Math.round((a.balance.available / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssetCard({ group }: { group: ReturnType<typeof byAsset>[number] }) {
  const stable = isStablecoin(group.currency);
  const action = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <Card className="gap-0 py-0">
      <div className={`h-14 ${assetTone(group.currency)}`} aria-hidden />
      <div className="-mt-7 flex items-end justify-between gap-3 px-5">
        <AssetGlyph currency={group.currency} size={56} />
        <Chip>{group.accounts.length} {group.accounts.length === 1 ? "account" : "accounts"}</Chip>
      </div>
      <CardContent className="pt-3">
        <p className="text-[0.72rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">{stable ? `${ticker(group.currency)} available` : `${group.currency} available`}</p>
        <p className="text-3xl font-extrabold tracking-tight tabular-nums">{formatAmount(group.available, group.currency)}</p>
        {group.current !== group.available && <p className="text-sm text-muted-foreground tabular-nums">{formatAmount(group.current, group.currency)} current, including funds settling</p>}
        <ul className="mt-4 divide-y">
          {group.accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{a.display_name}</span>
                <span className="mt-1 block">{a.chain ? <ChainChip chain={a.chain} /> : stable ? <Chip>No wallet yet</Chip> : <Chip>Bank account</Chip>}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-lg font-bold tabular-nums">{formatAmount(a.balance.available, a.currency)}</span>
                {a.balance.current !== a.balance.available && <span className="block text-xs text-muted-foreground tabular-nums">{formatAmount(a.balance.current, a.currency)} current</span>}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
      <div className="mt-auto flex flex-wrap gap-2 px-5 pt-3 pb-5">
        {stable && <Link href="/deposit" className={action}>Deposit</Link>}
        <Link href="/convert" className={action}>Convert</Link>
        {stable && <Link href="/send" className={action}>Send</Link>}
      </div>
    </Card>
  );
}

export function BalancesView({ accounts, recent }: { accounts: TreasuryAccount[]; recent: ApiTransfer[] }) {
  // Stablecoins here are pegged 1:1 to USD, so USDC and USDT sum into one dollar figure.
  const stable = accounts.filter((a) => isStablecoin(a.currency));
  const stableTotal = stable.reduce((sum, a) => sum + a.balance.available, 0);
  const fiat = accounts.filter((a) => !isStablecoin(a.currency));
  const fiatCurrencies = new Set(fiat.map((a) => a.currency));
  const fiatTotal = fiat.reduce((sum, a) => sum + a.balance.available, 0);
  const fiatText = fiat.length === 0 ? "None" : fiatCurrencies.size === 1 ? formatAmount(fiatTotal, [...fiatCurrencies][0]) : "Mixed currencies";
  const name = (id: string) => accounts.find((a) => a.id === id)?.display_name ?? "Account";
  const groups = byAsset(accounts);
  const actionOnBand = "inline-flex min-h-11 items-center rounded-full bg-white/12 px-5 text-sm font-semibold text-band-foreground transition-colors hover:bg-white/20";

  return (
    <PageShell
      eyebrow="Treasury position"
      title="Balances"
      intro={INTRO}
      band={
        <>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-[0.72rem] font-bold tracking-[0.12em] text-sand-fixed/80 uppercase">Stablecoins available</p>
              <p className="text-[clamp(2.2rem,6vw,3.4rem)] leading-none font-extrabold tracking-[-0.02em] tabular-nums">{formatAmount(stableTotal, "USD")}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[0.72rem] font-bold tracking-[0.12em] text-sand-fixed/80 uppercase">Fiat available</p>
              <p className="text-2xl font-bold tabular-nums">{fiatText}</p>
            </div>
          </div>
          <AllocationBar accounts={stable} total={stableTotal} />
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/deposit" className={buttonVariants({ size: "lg" })}>Deposit</Link>
            <Link href="/convert" className={actionOnBand}>Convert</Link>
            <Link href="/send" className={actionOnBand}>Send</Link>
            <Link href="/payout" className={actionOnBand}>Cash out</Link>
          </div>
        </>
      }
    >
      <div className="space-y-8">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet. <Link href="/deposit" className="link">Add a deposit address</Link>.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => <AssetCard key={g.currency} group={g} />)}
          </div>
        )}

        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-3 pb-2">
              <h2 className="text-base font-bold">Recent activity</h2>
              <Link href="/activity" className="link text-sm">View all</Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet. Convert some funds to get started.</p>
            ) : (
              <ul className="divide-y text-sm">
                {recent.map((t) => {
                  const inflow = t.type === "inflow";
                  const Dir = inflow ? ArrowDownLeft : ArrowUpRight;
                  return (
                    <li key={t.id}>
                      <Link href={`/activity/${t.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/60">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${inflow ? "bg-ok/15 text-ok" : "bg-c-soft text-c-text"}`}>
                          <Dir className="size-5" aria-label={inflow ? "Money in" : "Money out"} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{name(t.account_id)}</span>
                          <span className="block truncate text-xs text-muted-foreground">{t.narration} · {formatDate(t.created)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-bold tabular-nums">{inflow ? "+" : "-"}{formatAmount(t.amount, t.currency)}</span>
                          <StatusBadge status={t.status} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
