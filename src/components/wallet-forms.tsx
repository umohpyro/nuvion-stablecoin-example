"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWallet, issueWallet } from "@/app/actions";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CHAINS, CHAIN_IDS, type Chain } from "@/lib/chains";

export function NewWalletForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [currency, setCurrency] = useState<"USC" | "UST">("USC");
  const [chain, setChain] = useState<Chain>("base");

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createWallet({ currency, chain });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Account created. The wallet address is being provisioned.");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="nw-asset">Asset</Label>
        <NativeSelect id="nw-asset" value={currency} onChange={(e) => setCurrency(e.target.value as "USC" | "UST")} className="w-36">
          <option value="USC">USDC</option>
          <option value="UST">USDT</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nw-chain">Network</Label>
        <NativeSelect id="nw-chain" value={chain} onChange={(e) => setChain(e.target.value as Chain)} className="w-40">
          {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create account and wallet"}</Button>
    </form>
  );
}

/** For an account whose wallet call failed or was never made. The network is chosen once and is then permanent. */
export function IssueWalletForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chain, setChain] = useState<Chain>("base");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await issueWallet({ accountId, chain });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Wallet requested.");
          router.refresh();
        });
      }}
    >
      <NativeSelect aria-label="Network" value={chain} onChange={(e) => setChain(e.target.value as Chain)} className="w-40">
        {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
      </NativeSelect>
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Issuing…" : "Issue wallet"}</Button>
    </form>
  );
}
