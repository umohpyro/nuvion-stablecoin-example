"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendStablecoin } from "@/app/actions";
import type { AccountOption } from "@/components/convert-form";
import { NativeSelect } from "@/components/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAINS, CHAIN_IDS, validateAddress, type Chain } from "@/lib/chains";
import { formatAmount, parseAmount, ticker } from "@/lib/money";

export interface SendAccount extends AccountOption {
  chain: Chain | null;
}

export function SendForm({ accounts }: { accounts: SendAccount[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // One reference per page load: a double click or retry hits a 409 instead of sending twice.
  const [reference, setReference] = useState(() => crypto.randomUUID());
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const [chain, setChain] = useState<Chain>(accounts[0]?.chain ?? "base");
  const [address, setAddress] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState(false);
  const [ack, setAck] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const addressError = address ? validateAddress(chain, address) : null;
  const minor = parseAmount(amount);
  const amountError = amount && !minor ? "Enter a positive amount with at most 2 decimals." : minor && account && minor > account.availableMinor ? `Available: ${formatAmount(account.availableMinor, account.currency)}.` : null;
  const ready = Boolean(account && address && recipient.trim() && minor && !addressError && !amountError);
  const asset = account ? ticker(account.currency) : "";
  const reset = () => {
    setReview(false);
    setAck(false);
    setFailure(null);
  };

  if (accounts.length === 0) return <p className="text-sm text-muted-foreground">Create a stablecoin account on the Deposit page first.</p>;

  if (review && account && minor) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted-foreground">Send</dt><dd className="text-xl font-bold">{formatAmount(minor, account.currency)}</dd>
            <dt className="text-muted-foreground">From</dt><dd>{account.label}</dd>
            <dt className="text-muted-foreground">Network</dt><dd className="font-semibold">{CHAINS[chain].name}</dd>
            <dt className="text-muted-foreground">Recipient</dt><dd>{recipient}</dd>
            <dt className="text-muted-foreground">Address</dt><dd className="break-all font-mono">{address.trim()}</dd>
          </dl>
        </div>
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>On-chain sends can&apos;t be undone</AlertTitle>
          <AlertDescription>
            Funds sent on the wrong network, or to an address that can&apos;t receive {asset} on {CHAINS[chain].name}, are usually lost.
          </AlertDescription>
        </Alert>
        {failure && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>The send didn&apos;t go through</AlertTitle>
            <AlertDescription>{failure} Check the Activity page before you try again.</AlertDescription>
          </Alert>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 size-4" />
          <span>I checked that this address accepts {asset} on {CHAINS[chain].name}.</span>
        </label>
        <div className="flex gap-3">
          <Button variant="outline" onClick={reset} disabled={pending}>Back</Button>
          <Button
            disabled={!ack || pending}
            onClick={() =>
              start(async () => {
                const r = await sendStablecoin({ reference, accountId, chain, address, amount, recipient });
                if (!r.ok) {
                  setFailure(r.error);
                  // Nuvion answered definitively (the attempt is recorded as failed), so a retry is a new transfer.
                  if (r.code && r.code !== "error_duplicate_resource") setReference(crypto.randomUUID());
                  return void toast.error(r.error);
                }
                router.push(`/activity/${r.transferId}`);
              })
            }
          >
            {pending ? "Sending…" : `Send ${formatAmount(minor, account.currency)}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) setReview(true);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sd-from">From</Label>
          <NativeSelect
            id="sd-from"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setChain(accounts.find((a) => a.id === e.target.value)?.chain ?? chain);
            }}
          >
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {formatAmount(a.availableMinor, a.currency)}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sd-chain">Network the recipient uses</Label>
          <NativeSelect id="sd-chain" value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
            {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sd-recipient">Recipient name</Label>
        <Input id="sd-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={80} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sd-address">Wallet address</Label>
        <Input id="sd-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={CHAINS[chain].example} className="font-mono" aria-invalid={Boolean(addressError)} aria-describedby="sd-address-help" autoComplete="off" spellCheck={false} required />
        <p id="sd-address-help" className={addressError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {addressError ?? `${CHAINS[chain].name} address that can receive ${asset}.`}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sd-amount">Amount ({asset})</Label>
        <Input id="sd-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5.00" className="max-w-48" aria-invalid={Boolean(amountError)} required />
        {amountError && <p className="text-sm text-destructive">{amountError}</p>}
      </div>
      <Button type="submit" disabled={!ready}>Review</Button>
    </form>
  );
}
