"use client";

import { ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { convert, getQuote } from "@/app/actions";
import { AmountInput } from "@/components/amount-input";
import { AssetGlyph } from "@/components/assets";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatAmount, ticker } from "@/lib/money";

export interface AccountOption {
  id: string;
  label: string;
  currency: string;
  availableMinor: number;
}

interface Quote {
  id: string;
  rate: number;
  amountFrom: number;
  amountTo: number;
  expiresAt: number;
  /** How long the rate was locked for when the quote arrived, in seconds. Drives the countdown bar. */
  lockedFor: number;
}

const eyebrow = "text-[0.72rem] font-bold tracking-[0.12em] text-muted-foreground uppercase";

export function ConvertForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts.find((a) => a.currency !== accounts[0]?.currency)?.id ?? "");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const secondsLeft = quote ? Math.max(0, Math.round((quote.expiresAt - now) / 1000)) : 0;
  const expired = quote !== null && secondsLeft === 0;

  useEffect(() => {
    if (!quote) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [quote]);

  // Any change to the inputs invalidates the quote on screen.
  const edit = (fn: () => void) => () => {
    fn();
    setQuote(null);
  };

  if (accounts.length < 2) return <p className="text-sm text-muted-foreground">You need a fiat account and a stablecoin account to convert between them.</p>;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (quote && !expired) {
            const r = await convert({ quoteId: quote.id, fromId, toId });
            if (!r.ok) return void toast.error(r.error);
            router.push(`/activity/${r.transferId}`);
            return;
          }
          const r = await getQuote({ fromId, toId, amount });
          if (!r.ok) return void toast.error(r.error);
          setQuote({ ...r.quote, lockedFor: Math.max(1, Math.round((r.quote.expiresAt - Date.now()) / 1000)) });
          setNow(Date.now());
        });
      }}
    >
      <div className="relative space-y-2">
        {/* You pay */}
        <div className="rounded-2xl bg-muted p-4">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="cv-from" className={eyebrow}>You pay</Label>
            {from && <span className="text-xs text-muted-foreground tabular-nums">Available {formatAmount(from.availableMinor, from.currency)}</span>}
          </div>
          <div className="mt-2 flex items-center gap-3">
            {from && <AssetGlyph currency={from.currency} size={40} />}
            <NativeSelect id="cv-from" value={fromId} onChange={(e) => edit(() => setFromId(e.target.value))()}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {formatAmount(a.availableMinor, a.currency)}</option>)}
            </NativeSelect>
          </div>
          <div className="mt-3">
            <Label htmlFor="cv-amount" className="sr-only">Amount to convert{from ? ` (${ticker(from.currency)})` : ""}</Label>
            <AmountInput id="cv-amount" placeholder="10.00" value={amount} onValue={(v) => edit(() => setAmount(v))()} maxMinor={from?.availableMinor} wrapClassName="w-full" className="text-lg font-bold tabular-nums" required />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 grid -translate-y-1/2 place-items-center">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="pointer-events-auto size-11 border-2 border-background bg-card shadow-card"
            aria-label="Swap direction"
            onClick={edit(() => {
              setFromId(toId);
              setToId(fromId);
              // The old amount was in the other currency and may exceed this balance.
              setAmount("");
            })}
          >
            <ArrowUpDown className="size-5 text-c-text" aria-hidden />
          </Button>
        </div>

        {/* You receive */}
        <div className="rounded-2xl bg-muted p-4">
          <Label htmlFor="cv-to" className={eyebrow}>You receive</Label>
          <div className="mt-2 flex items-center gap-3">
            {to && <AssetGlyph currency={to.currency} size={40} />}
            <NativeSelect id="cv-to" value={toId} onChange={(e) => edit(() => setToId(e.target.value))()}>
              {accounts.filter((a) => a.currency !== from?.currency).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </NativeSelect>
          </div>
          <p className="mt-3 min-h-11 text-2xl font-extrabold tabular-nums" aria-live="polite">
            {quote && to ? formatAmount(quote.amountTo, to.currency) : <span className="text-base font-medium text-muted-foreground">Get a quote to see what you receive.</span>}
          </p>
        </div>
      </div>

      {/* Rate strip */}
      <div className="rounded-2xl bg-c-soft p-4 text-c-text" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-sm">
            <span className="mr-2 text-[0.72rem] font-bold tracking-[0.12em] uppercase">Rate</span>
            {quote && from && to ? <strong className="tabular-nums">{ticker(from.currency)} to {ticker(to.currency)} at {quote.rate}</strong> : <span>Locked when you get a quote</span>}
          </p>
          {quote && <p className="text-sm font-semibold tabular-nums">{expired ? "Expired. Get a new quote." : `Locked for ${secondsLeft}s`}</p>}
        </div>
        {quote && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-c/20" role="presentation">
            <div className="h-full rounded-full bg-c transition-[width] duration-1000 ease-linear" style={{ width: `${expired ? 0 : Math.min(100, (secondsLeft / quote.lockedFor) * 100)}%` }} />
          </div>
        )}
        {quote && from && to && <p className="mt-3 text-sm">You convert <strong className="tabular-nums">{formatAmount(quote.amountFrom, from.currency)}</strong> and receive <strong className="tabular-nums">{formatAmount(quote.amountTo, to.currency)}</strong>.</p>}
      </div>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || !fromId || !toId}>
        {pending ? "Working…" : quote && !expired ? "Confirm conversion" : quote ? "Get a new quote" : "Get a quote"}
      </Button>
    </form>
  );
}
