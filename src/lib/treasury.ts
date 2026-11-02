import "server-only";
import { CHAINS, isChain, type Chain } from "@/lib/chains";
import { env } from "@/lib/env";
import { isStablecoin } from "@/lib/money";
import { nuvion, type ApiAccount, type ApiAccountDetails, type ApiTransfer, type Counterparty, type List, type PaymentDetail } from "@/lib/nuvion";

export interface TreasuryAccount extends ApiAccount {
  wallet: ApiAccountDetails | null;
  chain: Chain | null;
}

export const listAccounts = async (): Promise<ApiAccount[]> => (await nuvion<List<ApiAccount>>("GET", `/accounts?entity_id=${env.entityId}&limit=100`)).data;

/** Every account of the entity, with its wallet when it is a stablecoin account. Two calls, any number of accounts. */
export async function loadAccounts(): Promise<TreasuryAccount[]> {
  const [accounts, details] = await Promise.all([listAccounts(), nuvion<List<ApiAccountDetails>>("GET", `/account-details?entity_id=${env.entityId}&limit=100`)]);
  return accounts.map((a) => {
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

/**
 * IDs that never change once found (the app's own counterparty, a payment detail for a given destination).
 * Shortcut: cached per server instance, so a cold start repeats the lookup once. Nuvion stays the source of truth.
 */
const cache = ((globalThis as { __treasuryIds?: Map<string, string> }).__treasuryIds ??= new Map<string, string>());

async function cached(key: string, find: () => Promise<string>): Promise<string> {
  const hit = cache.get(key);
  if (hit) return hit;
  const id = await find();
  cache.set(key, id);
  return id;
}

const SELF_NICKNAME = "Treasury (this app)";
const profile = (name: string, relationship: string) => ({
  legal_name: name,
  relationship,
  email: "treasury@example.com",
  registered_address: { line1: "1 Example Street", city: "London", country: "GB" },
});

/**
 * Transfers need a counterparty, even between your own accounts. This app keeps one counterparty for itself,
 * found by nickname. Creating a counterparty is not idempotent, so look before creating.
 */
export const selfCounterparty = () =>
  cached("self", async () => {
    const existing = await nuvion<List<Counterparty>>("GET", `/counterparties?entity_id=${env.entityId}&search=${encodeURIComponent(SELF_NICKNAME)}&limit=100`);
    const found = existing.data.find((c) => c.nickname === SELF_NICKNAME);
    if (found) return found.id;
    return (await nuvion<Counterparty>("POST", "/counterparties", { type: "business", entity_id: env.entityId, nickname: SELF_NICKNAME, profile: profile(SELF_NICKNAME, "supplier") })).id;
  });

/* ---------------- Saved recipients: counterparties tagged in their `meta` ---------------- */

export interface Recipient {
  id: string;
  name: string;
  chain: Chain;
  address: string;
}

const RECIPIENT_PREFIX = "Recipient: ";

type RecipientRow = Counterparty & { meta?: { kind?: string; chain?: string; address?: string } };

const toRecipient = (c: RecipientRow): Recipient[] =>
  c.meta?.kind === "recipient" && c.meta.chain && isChain(c.meta.chain) && c.meta.address && c.nickname?.startsWith(RECIPIENT_PREFIX)
    ? [{ id: c.id, name: c.nickname.slice(RECIPIENT_PREFIX.length), chain: c.meta.chain, address: c.meta.address }]
    : [];

/** A recipient is a counterparty whose `meta` holds the network and address. Nuvion stores it, so this app needs no database. */
export async function listRecipients(): Promise<Recipient[]> {
  const r = await nuvion<List<RecipientRow>>("GET", `/counterparties?entity_id=${env.entityId}&search=Recipient&status=active&limit=100`);
  return r.data.flatMap(toRecipient);
}

export async function getRecipient(id: string): Promise<Recipient | null> {
  const r = await nuvion<RecipientRow>("GET", `/counterparties/${id}?entity_id=${env.entityId}`);
  return toRecipient(r)[0] ?? null;
}

export async function createRecipient(name: string, chain: Chain, address: string): Promise<Recipient> {
  const c = await nuvion<Counterparty>("POST", "/counterparties", {
    type: "business",
    entity_id: env.entityId,
    nickname: `${RECIPIENT_PREFIX}${name}`,
    meta: { kind: "recipient", chain, address },
    profile: profile(name, "vendor"),
  });
  return { id: c.id, name, chain, address };
}

/** Returns a payment detail on the counterparty that matches `want`, creating it once. */
async function paymentDetail(counterpartyId: string, want: Partial<PaymentDetail>, create: Record<string, unknown>): Promise<string> {
  const key = ["pd", counterpartyId, want.payment_method, want.currency, want.account_number, want.wallet_address, want.blockchain_network].join("|").toLowerCase();
  return cached(key, async () => {
    const list = await nuvion<List<PaymentDetail>>("GET", `/counterparties/${counterpartyId}/payment-details?entity_id=${env.entityId}&limit=100`);
    const same = (p: PaymentDetail) =>
      p.payment_method === want.payment_method &&
      p.currency === want.currency &&
      (p.account_number ?? "").toLowerCase() === (want.account_number ?? "").toLowerCase() &&
      (p.wallet_address ?? "").toLowerCase() === (want.wallet_address ?? "").toLowerCase() &&
      p.blockchain_network === want.blockchain_network;
    const found = list.data.find(same);
    if (found) return found.id;
    const made = await nuvion<PaymentDetail>("POST", "/payment-details", { ...create, ...want, entity_id: env.entityId, counterparty_id: counterpartyId });
    return made.id;
  });
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
