"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { convert, getQuote } from "@/app/actions";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount } from "@/lib/money";

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
}

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
      className="space-y-5"
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
          setQuote(r.quote);
          setNow(Date.now());
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cv-from">From</Label>
          <NativeSelect id="cv-from" value={fromId} onChange={(e) => edit(() => setFromId(e.target.value))()}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {formatAmount(a.availableMinor, a.currency)}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cv-to">To</Label>
          <NativeSelect id="cv-to" value={toId} onChange={(e) => edit(() => setToId(e.target.value))()}>
            {accounts.filter((a) => a.currency !== from?.currency).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cv-amount">Amount to convert{from ? ` (${from.currency === "USC" ? "USDC" : from.currency === "UST" ? "USDT" : from.currency})` : ""}</Label>
        <Input id="cv-amount" inputMode="decimal" placeholder="10.00" value={amount} onChange={(e) => edit(() => setAmount(e.target.value))()} className="max-w-48" required />
      </div>

      {quote && to && from && (
        <div className="rounded-xl border bg-card p-4 text-sm" aria-live="polite">
          <p className="text-muted-foreground">You convert</p>
          <p className="text-xl font-bold">{formatAmount(quote.amountFrom, from.currency)}</p>
          <p className="mt-2 text-muted-foreground">You receive</p>
          <p className="text-xl font-bold">{formatAmount(quote.amountTo, to.currency)}</p>
          <p className="mt-3 text-muted-foreground">
            Rate {quote.rate} · {expired ? "Quote expired. Get a new one." : `Locked for ${secondsLeft}s`}
          </p>
        </div>
      )}

      <Button type="submit" disabled={pending || !fromId || !toId}>
        {pending ? "Working…" : quote && !expired ? "Confirm conversion" : quote ? "Get a new quote" : "Get a quote"}
      </Button>
    </form>
  );
}
