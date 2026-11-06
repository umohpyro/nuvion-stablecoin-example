import "server-only";
import { CHAINS, isChain, type Chain } from "@/lib/chains";
import { getConfig } from "@/lib/config";
import { isStablecoin } from "@/lib/money";
import { nuvion, type ApiAccount, type ApiAccountDetails, type ApiTransfer, type Counterparty, type List, type PaymentDetail } from "@/lib/nuvion";

export interface TreasuryAccount extends ApiAccount {
  wallet: ApiAccountDetails | null;
  chain: Chain | null;
}

/** The visitor's entity. Every Nuvion call acts for it. */
const entityId = async () => (await getConfig()).entityId;

export const listAccounts = async (): Promise<ApiAccount[]> => (await nuvion<List<ApiAccount>>("GET", `/accounts?entity_id=${await entityId()}&limit=100`)).data;

/** Every account of the entity, with its wallet when it is a stablecoin account. Two calls, any number of accounts. */
export async function loadAccounts(): Promise<TreasuryAccount[]> {
  const [accounts, details] = await Promise.all([listAccounts(), nuvion<List<ApiAccountDetails>>("GET", `/account-details?entity_id=${await entityId()}&limit=100`)]);
  return accounts.map((a) => {
    const wallet = details.data.find((d) => d.account_id === a.id && d.asset_type === "stablecoin") ?? null;
    return { ...a, wallet, chain: wallet?.chain && isChain(wallet.chain) ? wallet.chain : null };
  });
}

export const accountLabel = (a: TreasuryAccount) =>
  a.chain && !a.display_name.includes(CHAINS[a.chain].name) ? `${a.display_name} (${CHAINS[a.chain].name})` : a.display_name;
export const stablecoinAccounts = (all: TreasuryAccount[]) => all.filter((a) => isStablecoin(a.currency));

export async function loadTransfers(limit = 50): Promise<ApiTransfer[]> {
  return (await nuvion<List<ApiTransfer>>("GET", `/transfers?entity_id=${await entityId()}&limit=${limit}`)).data;
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
export const selfCounterparty = async () => {
  const entity = await entityId();
  // Keyed by entity: the cache is shared by every visitor on this server instance.
  return cached(`self|${entity}`, async () => {
    const existing = await nuvion<List<Counterparty>>("GET", `/counterparties?entity_id=${entity}&search=${encodeURIComponent(SELF_NICKNAME)}&limit=100`);
    const found = existing.data.find((c) => c.nickname === SELF_NICKNAME);
    if (found) return found.id;
    return (await nuvion<Counterparty>("POST", "/counterparties", { type: "business", entity_id: entity, nickname: SELF_NICKNAME, profile: profile(SELF_NICKNAME, "supplier") })).id;
  });
};

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
  const r = await nuvion<List<RecipientRow>>("GET", `/counterparties?entity_id=${await entityId()}&search=Recipient&status=active&limit=100`);
  return r.data.flatMap(toRecipient);
}

export async function getRecipient(id: string): Promise<Recipient | null> {
  const r = await nuvion<RecipientRow>("GET", `/counterparties/${id}?entity_id=${await entityId()}`);
  return toRecipient(r)[0] ?? null;
}

export async function createRecipient(name: string, chain: Chain, address: string): Promise<Recipient> {
  const c = await nuvion<Counterparty>("POST", "/counterparties", {
    type: "business",
    entity_id: await entityId(),
    nickname: `${RECIPIENT_PREFIX}${name}`,
    meta: { kind: "recipient", chain, address },
    profile: profile(name, "vendor"),
  });
  return { id: c.id, name, chain, address };
}

/** Returns a payment detail on the counterparty that matches `want`, creating it once. */
async function paymentDetail(counterpartyId: string, want: Partial<PaymentDetail>, create: Record<string, unknown>): Promise<string> {
  const key = ["pd", counterpartyId, want.payment_method, want.currency, want.account_number, want.wallet_address, want.blockchain_network].join("|").toLowerCase();
  const entity = await entityId();
  return cached(key, async () => {
    const list = await nuvion<List<PaymentDetail>>("GET", `/counterparties/${counterpartyId}/payment-details?entity_id=${entity}&limit=100`);
    const same = (p: PaymentDetail) =>
      p.payment_method === want.payment_method &&
      p.currency === want.currency &&
      (p.account_number ?? "").toLowerCase() === (want.account_number ?? "").toLowerCase() &&
      (p.wallet_address ?? "").toLowerCase() === (want.wallet_address ?? "").toLowerCase() &&
      p.blockchain_network === want.blockchain_network;
    const found = list.data.find(same);
    if (found) return found.id;
    const made = await nuvion<PaymentDetail>("POST", "/payment-details", { ...create, ...want, entity_id: entity, counterparty_id: counterpartyId });
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

/* ---------------- Bank payouts: a counterparty with a full address, found again by its bank details ---------------- */

export interface BankDetails {
  name: string;
  sortCode: string;
  accountNumber: string;
  bankName: string;
  line1: string;
  city: string;
  postcode: string;
}

/**
 * A bank transfer needs the counterparty's address with `state_or_province` and `postal_code`, which the app's own
 * counterparty doesn't have, so each payee gets its own. Reuses an existing one that has the same bank details.
 * Shortcut: `state_or_province` reuses the city, because this example doesn't collect a county.
 */
export async function payoutTarget(b: BankDetails): Promise<{ counterpartyId: string; paymentDetailId: string }> {
  const entity = await entityId();
  const found = await nuvion<List<Counterparty & { meta?: { kind?: string; sort_code?: string; account_number?: string } }>>(
    "GET",
    `/counterparties?entity_id=${entity}&search=${encodeURIComponent(b.name)}&limit=100`,
  );
  const counterpartyId =
    found.data.find((c) => c.meta?.kind === "payout" && c.meta.sort_code === b.sortCode && c.meta.account_number === b.accountNumber)?.id ??
    (
      await nuvion<Counterparty>("POST", "/counterparties", {
        type: "business",
        entity_id: entity,
        nickname: `Payout: ${b.name}`,
        meta: { kind: "payout", sort_code: b.sortCode, account_number: b.accountNumber },
        profile: {
          legal_name: b.name,
          relationship: "vendor",
          email: "treasury@example.com",
          registered_address: { line1: b.line1, city: b.city, state_or_province: b.city, postal_code: b.postcode, country: "GB" },
        },
      })
    ).id;
  const paymentDetailId = await paymentDetail(
    counterpartyId,
    { payment_method: "bank-transfer", currency: "GBP", account_number: b.accountNumber },
    { account_holder_name: b.name, country: "GB", sort_code: b.sortCode, bank_name: b.bankName },
  );
  return { counterpartyId, paymentDetailId };
}
