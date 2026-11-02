"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendStablecoin } from "@/app/actions";
import type { AccountOption } from "@/components/convert-form";
import { AmountInput } from "@/components/amount-input";
import { NativeSelect } from "@/components/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAINS, CHAIN_IDS, validateAddress, type Chain } from "@/lib/chains";
import { formatAmount, parseAmount, ticker } from "@/lib/money";
import type { Recipient } from "@/lib/treasury";

export interface SendAccount extends AccountOption {
  chain: Chain | null;
}

export function SendForm({ accounts, recipients, savedOnly }: { accounts: SendAccount[]; recipients: Recipient[]; savedOnly: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // One reference per page load: a double click or retry hits a 409 instead of sending twice.
  const [reference, setReference] = useState(() => crypto.randomUUID());
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const [recipientId, setRecipientId] = useState(savedOnly ? (recipients[0]?.id ?? "") : "");
  const saved = recipients.find((r) => r.id === recipientId);
  const [typedChain, setChain] = useState<Chain>(accounts[0]?.chain ?? "base");
  const [typedAddress, setAddress] = useState("");
  const [typedName, setRecipient] = useState("");
  // A saved recipient fixes the network, address and name; the server re-reads them from Nuvion.
  const chain = saved?.chain ?? typedChain;
  const address = saved?.address ?? typedAddress;
  const recipient = saved?.name ?? typedName;
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState(false);
  const [ack, setAck] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const addressError = !saved && address ? validateAddress(chain, address) : null;
  const minor = parseAmount(amount);
  const amountError = amount && !minor ? "Enter a positive amount with at most 2 decimals." : minor && account && minor > account.availableMinor ? `Available: ${formatAmount(account.availableMinor, account.currency)}.` : null;
  const ready = Boolean(account && address && recipient.trim() && minor && !addressError && !amountError);
  const asset = account ? ticker(account.currency) : "";
  const reset = () => {
    setReview(false);
    setAck(false);
    setFailure(null);
  };

  if (savedOnly && recipients.length === 0) return <p className="text-sm text-muted-foreground">This treasury only sends to saved recipients. <Link href="/recipients" className="underline underline-offset-4">Add one first</Link>.</p>;
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
        <p className="text-sm text-muted-foreground">A network fee may apply. Nuvion sets it when the transfer is created, and it shows on the transfer&apos;s status page.</p>
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
                const r = await sendStablecoin({ reference, accountId, recipientId: saved?.id, chain, address, amount, recipient });
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
      {recipients.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="sd-saved">Recipient</Label>
          <NativeSelect id="sd-saved" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
            {!savedOnly && <option value="">New address</option>}
            {recipients.map((r) => <option key={r.id} value={r.id}>{r.name} · {CHAINS[r.chain].name}</option>)}
          </NativeSelect>
        </div>
      )}
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
        {!saved && (
          <div className="space-y-1.5">
            <Label htmlFor="sd-chain">Network the recipient uses</Label>
            <NativeSelect id="sd-chain" value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
              {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
            </NativeSelect>
          </div>
        )}
      </div>
      {saved ? (
        <p className="rounded-lg bg-muted p-3 text-sm"><span className="font-medium">{saved.name}</span> on {CHAINS[saved.chain].name}<br /><span className="break-all font-mono">{saved.address}</span></p>
      ) : (
        <>
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
        </>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="sd-amount">Amount ({asset})</Label>
        <AmountInput id="sd-amount" value={amount} onValue={setAmount} placeholder="5.00" maxMinor={account?.availableMinor} aria-invalid={Boolean(amountError)} required />
        {amountError && <p className="text-sm text-destructive">{amountError}</p>}
      </div>
      <Button type="submit" disabled={!ready}>Review</Button>
    </form>
  );
}
