import "server-only";
import { CHAINS, isChain, type Chain } from "@/lib/chains";
import { env } from "@/lib/env";
import { isStablecoin } from "@/lib/money";
import { nuvion, type ApiAccount, type ApiAccountDetails, type ApiTransfer, type Counterparty, type List, type PaymentDetail } from "@/lib/nuvion";

export interface TreasuryAccount extends ApiAccount {
  wallet: ApiAccountDetails | null;
  chain: Chain | null;
}

/** Every account of the entity, with its wallet when it is a stablecoin account. Two calls, any number of accounts. */
export async function loadAccounts(): Promise<TreasuryAccount[]> {
  const q = `entity_id=${env.entityId}&limit=100`;
  const [accounts, details] = await Promise.all([
    nuvion<List<ApiAccount>>("GET", `/accounts?${q}`),
    nuvion<List<ApiAccountDetails>>("GET", `/account-details?${q}`),
  ]);
  return accounts.data.map((a) => {
    const wallet = details.data.find((d) => d.account_id === a.id && d.asset_type === "stablecoin") ?? null;
    return { ...a, wallet, chain: wallet?.chain && isChain(wallet.chain) ? wallet.chain : null };
  });
}

export const accountLabel = (a: TreasuryAccount) =>
  a.chain && !a.display_name.includes(CHAINS[a.chain].name) ? `${a.display_name} (${CHAINS[a.chain].name})` : a.display_name;
export const stablecoinAccounts = (all: TreasuryAccount[]) => all.filter((a) => isStablecoin(a.currency));

export async function loadTransfers(limit = 50): Promise<ApiTransfer[]> {
  return (await nuvion<List<ApiTransfer>>("GET", `/transfers?entity_id=${env.entityId}&limit=${limit}`)).data;
}

const SELF_NICKNAME = "Treasury (this app)";

/**
 * Transfers need a counterparty, even between your own accounts. This app keeps one counterparty for itself,
 * found by nickname. Creating a counterparty is not idempotent, so look before creating.
 */
export async function selfCounterparty(): Promise<string> {
  const existing = await nuvion<List<Counterparty>>("GET", `/counterparties?entity_id=${env.entityId}&limit=100`);
  const found = existing.data.find((c) => c.nickname === SELF_NICKNAME);
  if (found) return found.id;
  const created = await nuvion<Counterparty>("POST", "/counterparties", {
    type: "business",
    entity_id: env.entityId,
    nickname: SELF_NICKNAME,
    profile: {
      legal_name: SELF_NICKNAME,
      relationship: "supplier",
      email: "treasury@example.com",
      registered_address: { line1: "1 Example Street", city: "London", country: "GB" },
    },
  });
  return created.id;
}

/** Returns a payment detail on the counterparty that matches `want`, creating it once. */
async function paymentDetail(counterpartyId: string, want: Partial<PaymentDetail>, create: Record<string, unknown>): Promise<string> {
  const list = await nuvion<List<PaymentDetail>>("GET", `/counterparties/${counterpartyId}/payment-details?entity_id=${env.entityId}&limit=100`);
  const same = (p: PaymentDetail) =>
    p.payment_method === want.payment_method &&
    p.currency === want.currency &&
    (p.account_number ?? "").toLowerCase() === (want.account_number ?? "").toLowerCase() &&
    (p.wallet_address ?? "").toLowerCase() === (want.wallet_address ?? "").toLowerCase() &&
    p.blockchain_network === want.blockchain_network;
  const found = list.data.find(same);
  if (found) return found.id;
  const made = await nuvion<PaymentDetail>("POST", "/payment-details", {
    ...create,
    ...want,
    entity_id: env.entityId,
    counterparty_id: counterpartyId,
  });
  return made.id;
}

/** Destination of a conversion: one of our own accounts, addressed by its `nuvion_ban` on the book-transfer rail. */
export const bookDetail = (counterpartyId: string, to: ApiAccount) =>
  paymentDetail(counterpartyId, { payment_method: "book-transfer", currency: to.currency, account_number: to.nuvion_ban }, { account_holder_name: SELF_NICKNAME, scheme: "nuvion_direct" });

/** Destination of a send: an external wallet on one chain. */
export const walletDetail = (counterpartyId: string, currency: string, chain: Chain, address: string, holder: string) =>
  paymentDetail(
    counterpartyId,
    { payment_method: "stablecoin-transfer", currency, wallet_address: address, blockchain_network: CHAINS[chain].network },
    { account_holder_name: holder, scheme: "stablecoin" },
  );
