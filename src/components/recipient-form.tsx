"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addRecipient } from "@/app/actions";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAINS, CHAIN_IDS, validateAddress, type Chain } from "@/lib/chains";

export function RecipientForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [chain, setChain] = useState<Chain>("base");
  const [address, setAddress] = useState("");
  const error = address ? validateAddress(chain, address) : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addRecipient({ name, chain, address });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Recipient saved.");
          setName("");
          setAddress("");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rc-name">Name</Label>
          <Input id="rc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rc-chain">Network</Label>
          <NativeSelect id="rc-chain" value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
            {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rc-address">Wallet address</Label>
        <Input id="rc-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={CHAINS[chain].example} className="font-mono" aria-invalid={Boolean(error)} autoComplete="off" spellCheck={false} required />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={pending || !name.trim() || !address || Boolean(error)}>{pending ? "Saving…" : "Save recipient"}</Button>
    </form>
  );
}
