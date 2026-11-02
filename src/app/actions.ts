"use server";

import { z } from "zod";
import { CHAINS, CHAIN_IDS, validateAddress, type Chain } from "@/lib/chains";
import { ConfigError, env } from "@/lib/env";
import { UserError } from "@/lib/errors";
import { formatAmount, isStablecoin, parseAmount, ticker } from "@/lib/money";
import { NuvionError, nuvion, type ApiAccount, type ApiAccountDetails, type ApiTransfer, type FxQuote } from "@/lib/nuvion";
import { bookDetail, createRecipient, getRecipient, listAccounts, loadAccounts, selfCounterparty, walletDetail } from "@/lib/treasury";

/*
 * Server Actions are public POST endpoints, so every input is validated here. The browser sends account IDs,
 * an amount and an address; everything else (currencies, chains, rates) is read back from Nuvion.
 */

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

async function guard<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof NuvionError) return { ok: false, error: friendly(e), code: e.type };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Please check your input." };
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof ConfigError) return { ok: false, error: `${e.message} Finish setup at /setup.`, code: "config" };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Turns Nuvion error types into sentences an operator can act on. */
function friendly(e: NuvionError): string {
  switch (e.type) {
    case "error_transfer_insufficient_funds":
      return e.message;
    case "error_operation_invalid_for_state":
      return "Nuvion can't process this transfer right now. The sandbox does not support on-chain sends, and the attempt is recorded as failed in Activity.";
    case "error_duplicate_resource":
      return "This request was already submitted. Check Activity before trying again.";
    case "error_wallet_already_exists":
      return "A wallet already exists for this account on this network.";
    case "error_system_dependency_unavailable":
      return "Nuvion couldn't reach a provider. Wait a moment and try again.";
    default:
      return e.summary;
  }
}

const id = z.string().regex(/^[0-9A-Z]{26}$/, "Invalid ID.");

/* ---------------- Deposit: create a stablecoin account and issue its wallet ---------------- */

const walletSchema = z.object({
  currency: z.enum(["USC", "UST"]),
  chain: z.enum(CHAIN_IDS as [Chain, ...Chain[]]),
});

/**
 * Account details are bound to the account for good, so receiving on a second chain needs a second account.
 * This creates the account, then issues the wallet. If the second call fails the account remains,
 * and the Deposit page offers "Issue wallet" for it.
 */
export async function createWallet(input: z.input<typeof walletSchema>) {
  return guard(async () => {
    const v = walletSchema.parse(input);
    const account = await nuvion<{ account: ApiAccount }>("POST", "/accounts", {
      entity_id: env.entityId,
      type: "checking",
      currency: v.currency,
      display_name: `${ticker(v.currency)} on ${CHAINS[v.chain].name}`,
    });
    await issueWalletFor(account.account.id, v.chain);
    return { accountId: account.account.id };
  });
}

export async function issueWallet(input: { accountId: string; chain: Chain }) {
  return guard(async () => {
    const v = z.object({ accountId: id, chain: walletSchema.shape.chain }).parse(input);
    await issueWalletFor(v.accountId, v.chain);
    return {};
  });
}

async function issueWalletFor(accountId: string, chain: Chain) {
  await nuvion<{ account_details: ApiAccountDetails }>("POST", "/account-details", { account_id: accountId, entity_id: env.entityId, chain });
}

/* ---------------- Convert: FX quote, then a book transfer between two of our accounts ---------------- */

const quoteSchema = z.object({ fromId: id, toId: id, amount: z.string() });

/** Resolves two account IDs to accounts of this entity. Currencies come from Nuvion, never from the browser. */
async function pair(fromId: string, toId: string) {
  const all = await listAccounts();
  const from = all.find((a) => a.id === fromId);
  const to = all.find((a) => a.id === toId);
  if (!from || !to) throw new UserError("Choose two accounts.");
  if (from.currency === to.currency) throw new UserError("Choose two different currencies.");
  if (!isStablecoin(from.currency) && !isStablecoin(to.currency)) throw new UserError("One side of a conversion must be a stablecoin.");
  return { from, to };
}

export async function getQuote(input: z.input<typeof quoteSchema>) {
  return guard(async () => {
    const v = quoteSchema.parse(input);
    const { from, to } = await pair(v.fromId, v.toId);
    const amount = parseAmount(v.amount);
    if (!amount) throw new UserError("Enter an amount greater than zero with at most 2 decimals.");
    if (amount > from.balance.available) throw new UserError(`Available balance is ${formatAmount(from.balance.available, from.currency)}.`);
    const quote = await nuvion<FxQuote>("POST", "/fx-quotes", {
      entity_id: env.entityId,
      from_currency: from.currency,
      to_currency: to.currency,
      amount_from: amount,
      account_id: from.id,
    });
    return { quote: { id: quote.id, rate: quote.rate, amountFrom: quote.amount_from, amountTo: quote.amount_to, expiresAt: quote.quote.expires_at } };
  });
}

const convertSchema = z.object({ quoteId: z.string().regex(/^[0-9A-Z]{26}$/, "Invalid quote."), fromId: id, toId: id });

/**
 * Re-reads the quote from Nuvion instead of trusting what the browser shows: it must be active and match both accounts.
 * The transfer reference is derived from the quote ID, and a quote can be used once, so a double click can't convert twice.
 */
export async function convert(input: z.input<typeof convertSchema>) {
  return guard(async () => {
    const v = convertSchema.parse(input);
    const { from, to } = await pair(v.fromId, v.toId);
    // Independent calls run together: the quote read and the counterparty lookup.
    const [quote, counterparty] = await Promise.all([nuvion<FxQuote>("GET", `/fx-quotes/${v.quoteId}?entity_id=${env.entityId}`), selfCounterparty()]);
    if (quote.quote.status !== "active") throw new UserError("This quote has expired or was already used. Get a new one.");
    if (quote.from !== from.currency || quote.to !== to.currency) throw new UserError("This quote doesn't match the selected accounts.");

    const paymentDetailId = await bookDetail(counterparty, to);
    const transfer = await nuvion<ApiTransfer>("POST", "/transfers", {
      entity_id: env.entityId,
      account_id: from.id,
      payment_detail_id: paymentDetailId,
      counterparty_id: counterparty,
      amount: quote.amount_from,
      currency: from.currency,
      narration: `Convert ${ticker(from.currency)} to ${ticker(to.currency)}`,
      payment_type: "book-transfer",
      unique_reference: `convert-${quote.id}`,
      fx_quote_id: quote.id,
    });
    return { transferId: transfer.id };
  });
}

/* ---------------- Send: stablecoin to an external wallet ---------------- */

const sendSchema = z.object({
  reference: z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "Invalid reference."),
  accountId: id,
  /** A saved recipient. Leave out to send to a one-off address, unless the allow list is on. */
  recipientId: id.optional(),
  chain: walletSchema.shape.chain,
  address: z.string().trim().max(100),
  amount: z.string(),
  recipient: z.string().trim().max(80),
});

/**
 * The address is validated for the chosen chain before anything is created, and Nuvion validates it again.
 * `reference` is generated once per form load, so a retry or double click can't send twice (409 instead).
 * With SEND_ONLY_TO_SAVED=true the server refuses any address that isn't a saved recipient, whatever the browser sends.
 */
export async function sendStablecoin(input: z.input<typeof sendSchema>) {
  return guard(async () => {
    const v = sendSchema.parse(input);
    const amount = parseAmount(v.amount);
    if (!amount) throw new UserError("Enter an amount greater than zero with at most 2 decimals.");

    // The saved recipient, not the browser, decides the network and address.
    const saved = v.recipientId ? await getRecipient(v.recipientId) : null;
    if (v.recipientId && !saved) throw new UserError("That saved recipient no longer exists.");
    if (!saved && env.sendOnlyToSaved) throw new UserError("This treasury only sends to saved recipients. Add one on the Recipients page.");
    const chain = saved?.chain ?? v.chain;
    const address = saved?.address ?? v.address.trim();
    const holder = saved?.name ?? v.recipient;
    if (!holder) throw new UserError("Enter the recipient's name.");
    const bad = validateAddress(chain, address);
    if (bad) throw new UserError(bad);

    const account = (await loadAccounts()).find((a) => a.id === v.accountId);
    if (!account || !isStablecoin(account.currency)) throw new UserError("Choose a stablecoin account.");
    if (amount > account.balance.available) throw new UserError(`Available balance is ${formatAmount(account.balance.available, account.currency)}.`);

    const counterparty = saved?.id ?? (await selfCounterparty());
    const paymentDetailId = await walletDetail(counterparty, account.currency, chain, address, holder);
    const transfer = await nuvion<ApiTransfer>("POST", "/transfers", {
      entity_id: env.entityId,
      account_id: account.id,
      payment_detail_id: paymentDetailId,
      counterparty_id: counterparty,
      amount,
      currency: account.currency,
      narration: `Send ${ticker(account.currency)} on ${CHAINS[chain].name}`,
      payment_type: "stablecoin-transfer",
      unique_reference: v.reference,
    });
    return { transferId: transfer.id };
  });
}

/* ---------------- Recipients: the saved-address book ---------------- */

const recipientSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(60),
  chain: walletSchema.shape.chain,
  address: z.string().trim().max(100),
});

export async function addRecipient(input: z.input<typeof recipientSchema>) {
  return guard(async () => {
    const v = recipientSchema.parse(input);
    const bad = validateAddress(v.chain, v.address);
    if (bad) throw new UserError(bad);
    await createRecipient(v.name, v.chain, v.address);
    return {};
  });
}
