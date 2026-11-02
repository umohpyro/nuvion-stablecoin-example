"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getPayoutQuote, payout } from "@/app/actions";
import type { AccountOption } from "@/components/convert-form";
import { AmountInput } from "@/components/amount-input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PAYOUT_MINOR, sortCode, ukAccountNumber } from "@/lib/bank";
import { formatAmount, parseAmount, ticker } from "@/lib/money";

interface Quote {
  id: string;
  rate: number;
  amountFrom: number;
  amountTo: number;
  expiresAt: number;
}

const EMPTY = { name: "", sortCode: "", accountNumber: "", bankName: "", line1: "", city: "", postcode: "" };

export function PayoutForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState(EMPTY);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const from = accounts.find((a) => a.id === fromId);

  const secondsLeft = quote ? Math.max(0, Math.round((quote.expiresAt - now) / 1000)) : 0;
  const expired = quote !== null && secondsLeft === 0;
  useEffect(() => {
    if (!quote) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [quote]);

  const minor = parseAmount(amount);
  const problems = [
    !minor || minor < MIN_PAYOUT_MINOR ? `Amount must be at least ${from ? formatAmount(MIN_PAYOUT_MINOR, from.currency) : ""}.` : from && minor > from.availableMinor ? `Available: ${formatAmount(from.availableMinor, from.currency)}.` : null,
    sortCode(bank.sortCode) ? null : "Sort code must be 6 digits.",
    ukAccountNumber(bank.accountNumber) ? null : "Account number must be 8 digits.",
  ];
  const ready = Boolean(bank.name.trim() && bank.bankName.trim() && bank.line1.trim() && bank.city.trim() && bank.postcode.trim() && problems.every((p) => p === null));

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setBank({ ...bank, [k]: e.target.value });
    setQuote(null);
  };

  if (accounts.length === 0) return <p className="text-sm text-muted-foreground">You need a stablecoin account with a balance to cash out.</p>;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (quote && !expired) {
            const r = await payout({ quoteId: quote.id, fromId, bank });
            if (!r.ok) return void toast.error(r.error);
            router.push(`/activity/${r.transferId}`);
            return;
          }
          const r = await getPayoutQuote({ fromId, amount });
          if (!r.ok) return void toast.error(r.error);
          setQuote(r.quote);
          setNow(Date.now());
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="po-from">From</Label>
          <NativeSelect id="po-from" value={fromId} onChange={(e) => { setFromId(e.target.value); setQuote(null); }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {formatAmount(a.availableMinor, a.currency)}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po-amount">Amount ({from ? ticker(from.currency) : ""})</Label>
          <AmountInput id="po-amount" value={amount} onValue={(v) => { setAmount(v); setQuote(null); }} placeholder="5.00" maxMinor={from?.availableMinor} aria-invalid={Boolean(amount && problems[0])} required />
          {amount && problems[0] && <p className="text-sm text-destructive">{problems[0]}</p>}
        </div>
      </div>

      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">UK bank account (GBP, Faster Payments)</legend>
        <div className="space-y-1.5">
          <Label htmlFor="po-name">Account holder</Label>
          <Input id="po-name" value={bank.name} onChange={set("name")} maxLength={60} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="po-sort">Sort code</Label>
            <Input id="po-sort" inputMode="numeric" value={bank.sortCode} onChange={set("sortCode")} placeholder="04-00-04" aria-invalid={Boolean(bank.sortCode && problems[1])} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-acct">Account number</Label>
            <Input id="po-acct" inputMode="numeric" value={bank.accountNumber} onChange={set("accountNumber")} placeholder="12345678" aria-invalid={Boolean(bank.accountNumber && problems[2])} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-bank">Bank name</Label>
            <Input id="po-bank" value={bank.bankName} onChange={set("bankName")} maxLength={60} required />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="po-line1">Street address</Label>
            <Input id="po-line1" value={bank.line1} onChange={set("line1")} maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-city">City</Label>
            <Input id="po-city" value={bank.city} onChange={set("city")} maxLength={60} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-post">Postcode</Label>
            <Input id="po-post" value={bank.postcode} onChange={set("postcode")} maxLength={10} required />
          </div>
        </div>
        {(bank.sortCode && problems[1]) || (bank.accountNumber && problems[2]) ? <p className="text-sm text-destructive">{[bank.sortCode && problems[1], bank.accountNumber && problems[2]].filter(Boolean).join(" ")}</p> : null}
      </fieldset>

      {quote && from && (
        <div className="rounded-xl border bg-card p-4 text-sm" aria-live="polite">
          <p className="text-muted-foreground">You send</p>
          <p className="text-xl font-bold">{formatAmount(quote.amountFrom, from.currency)}</p>
          <p className="mt-2 text-muted-foreground">{bank.name} receives</p>
          <p className="text-xl font-bold">{formatAmount(quote.amountTo, "GBP")}</p>
          <p className="mt-3 text-muted-foreground">
            Rate {quote.rate} · {expired ? "Quote expired. Get a new one." : `Locked for ${secondsLeft}s`}. A transfer fee may apply; it shows on the transfer&apos;s status page.
          </p>
        </div>
      )}

      <Button type="submit" disabled={pending || !ready}>
        {pending ? "Working…" : quote && !expired ? "Confirm cash out" : quote ? "Get a new quote" : "Get a quote"}
      </Button>
    </form>
  );
}
