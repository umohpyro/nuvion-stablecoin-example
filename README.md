# Nuvion stablecoin treasury example

A small treasury app that holds USDC and USDT in [Nuvion](https://docs.nuvion.co) accounts, shows a deposit address per network, converts between fiat and stablecoin with FX quotes, sends stablecoin to an external wallet, and tracks every transfer. It has **no database**: Nuvion holds all state. It runs on Next.js 16, React 19, Tailwind CSS 4 and shadcn/ui.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fumohpyro%2Fnuvion-stablecoin-example&project-name=stablecoin-treasury&repository-name=nuvion-stablecoin-example&env=SESSION_SECRET&envDescription=A%20long%20random%20string%20that%20seals%20each%20visitor%27s%20cookie&envLink=https%3A%2F%2Fgithub.com%2Fumohpyro%2Fnuvion-stablecoin-example%23run-it)

> The button works once this repository is public. It asks for one value, `SESSION_SECRET`. Visitors add their own Nuvion sandbox key on the Settings page.

## What it shows

| Page | What it demonstrates | Nuvion calls |
|---|---|---|
| Balances `/` | Balance per account, currency and network | `GET /accounts`, `GET /account-details` |
| Deposit `/deposit` | One wallet address (with a QR code) per account and network, with wrong-network warnings; adding a network | `POST /accounts`, `POST /account-details` |
| Convert `/convert` | Quote with a locked rate, then confirm before it expires | `POST /fx-quotes`, `GET /fx-quotes/{id}`, `POST /transfers` (`book-transfer`) |
| Send `/send` | Address validation per network, explicit review step, idempotent send | `POST /counterparties`, `POST /payment-details`, `POST /transfers` (`stablecoin-transfer`) |
| Recipients `/recipients` | A saved-address book stored in Nuvion, usable as an allow list | `POST /counterparties`, `GET /counterparties` |
| Cash out `/payout` | Quote, then pay a stablecoin balance into a UK bank account as GBP | `POST /fx-quotes`, `POST /counterparties`, `POST /payment-details`, `POST /transfers` (`bank-transfer`) |
| Activity `/activity` | Transfer list, CSV download and a status page per transfer | `GET /transfers`, `GET /transfers/{id}` |
| Settings `/settings` | Bring your own key: look up your approved entities and connect one | `GET /entities`, `GET /accounts` |

## Run it

The treasury is bring-your-own-key. Nothing about your Nuvion account is stored on the server or shared between visitors: each visitor connects their own sandbox on the **Settings** page, and everything runs in their own tenant, so you can confirm it in your own dashboard.

You need Node.js 20.9 or later, a Nuvion **sandbox** account, and an approved entity.

```bash
npm install
npm run dev
```

Open http://localhost:3000/settings, paste your sandbox API key (from the sandbox dashboard, [Settings > Developers](https://app.nuvion.dev/dashboard/settings); see [how API keys work](https://docs.nuvion.co/authentication)), pick an approved entity from the list the page loads, and connect. Your key is sealed in an `httpOnly` cookie that expires after eight hours.

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Required in production: a long random string that seals the cookie. Local development generates one for you |
| `NUVION_API_URL` | Optional. Must be a `*.nuvion.dev` host |
| `SEND_ONLY_TO_SAVED` | Optional. `true` allows sends only to saved recipients, enforced on the server |

The entity needs a fiat account with a balance to convert from. Then use **Deposit** to add a USDC or USDT account on a network, and **Convert** to fund it.

## What the sandbox can and can't do

Verified against `https://api.nuvion.dev`.

| Works | Doesn't |
|---|---|
| Creating stablecoin accounts and issuing wallets on `eth`, `base`, `matic` and `sol` (the address is `pending`, then `active` within seconds) | Receiving a real on-chain deposit. Nothing on a blockchain can pay the address, so a stablecoin balance only comes from converting fiat |
| FX quotes between fiat and stablecoin at a rate of `1` | Sending stablecoin to an external wallet. `POST /transfers` with `stablecoin-transfer` returns `400 error_operation_invalid_for_state` and records the transfer as `failed`, even with an active USDC wallet and enough balance, and the same for USDT |
| Book transfers that convert between your own accounts, settled in about two seconds | A `book-transfer` has no `pending` phase to observe, so the status page for a conversion is already `successful` |
| Quotes to GBP, and creating the payee, payment detail and transfer for a bank payout | A bank payout actually settling. The transfer is created as `new`, then ends `failed` with `invalid_payment_request` within seconds, from a stablecoin or a USD account. The `applicable_fee` it shows is not debited: the balance stays the same. A USD ACH attempt returned `503 error_system_dependency_unavailable` |
| Address format validation on payment details (`error_validation_invalid_format`) | |
| Insufficient funds (`error_transfer_insufficient_funds`) | |

The send screen is complete and its validation, review step and error handling are real. The final API call fails in the sandbox, and the app shows that failure inline and in Activity.

## What to know about Nuvion before you build a treasury

These come from running the flows against the sandbox. Each one shapes the code.

1. **A wallet belongs to one account and one network, for good.** Account details are bound to the account once generated. To receive USDC on Base and on Solana you need two accounts. `createWallet` does both calls, and the Deposit page offers "Issue wallet" for an account whose second call failed.
2. **`chain` and `blockchain_network` use different names.** Account details take `eth`, `base`, `matic`, `sol`. Payment details take `ETH_MAINNET`, `BASE_MAINNET`, `MATIC_MAINNET`, `SOLANA_MAINNET`. Polygon is `MATIC_MAINNET`; `POLYGON_MAINNET` is rejected (`src/lib/chains.ts`).
3. **`USC` is USDC and `UST` is USDT.** Use these currency codes in every call, and map them to tickers only for display.
4. **Stablecoins have 2 decimal places, like fiat.** `1250` is 12.50 USDC, not 0.00125. Parse user input into integers once, at the edge (`parseAmount`).
5. **A wallet starts as `pending`.** Don't show an address as ready until its status is `active`; the Deposit page shows both states.
6. **Converting between your own accounts is a `book-transfer` with an `fx_quote_id`.** You still need a counterparty and a payment detail for the destination account (`account_number` is its `nuvion_ban`, `scheme` is `nuvion_direct`). The app keeps one counterparty for itself and reuses it, because creating a counterparty is not idempotent (`src/lib/treasury.ts`).
7. **Quotes expire and are single use.** They last a couple of minutes. The convert action re-reads the quote from Nuvion, checks it is `active` and matches the accounts, and derives the transfer `unique_reference` from the quote ID, so a double click can't convert twice.
8. **The `account_id` on a quote is the account you will debit,** and must hold the `from_currency`.
9. **A rejected transfer can still exist.** When a send fails with a `400`, Nuvion has already recorded a transfer with `status: failed` (visible in Activity). A retry needs a fresh `unique_reference`; the same one returns `409 error_duplicate_resource`.
10. **Child entities need `entity_id` on every call.** Leaving it out returns a confusing `404`.
11. **Lists return their rows under `data.data`.** Nuvion wraps every response in `data`, and lists put the rows and a `meta` block inside it. `account-details` list paging doesn't work yet, so request `limit=100`.
12. **Cloudflare blocks the default user agent of some HTTP libraries** (Python's, for one). `src/lib/nuvion.ts` sends its own `User-Agent`.
13. **Validate addresses before you call Nuvion, but know the limit.** An EVM address is valid on every EVM chain, so no check can tell Base from Ethereum. The send screen therefore makes the operator confirm the network before sending. `validateAddress` doesn't verify the EIP-55 checksum; Nuvion validates the format again.
14. **Read the transfer, don't trust the last thing you heard.** The status page always reads the transfer from Nuvion on each visit.
15. **A counterparty can carry your own data in `meta`, and the list returns it.** The Recipients page stores each address book entry as a counterparty with `meta: { kind, chain, address }` and finds them with `GET /counterparties?search=Recipient`. The send action reads the network and address back from Nuvion, so the browser can't change where funds go.
16. **There is no fee preview.** The API documents no way to price a transfer before creating it. `applicable_fee` appears on the transfer, so the status page shows it and the review step says a fee may apply.
17. **A bank payout needs the payee's full address on the counterparty,** including `state_or_province` and `postal_code`. Without them `POST /transfers` returns `422` on `counterparty.address.state`. The app's own counterparty has no such address, so each payee gets one (`payoutTarget`).
18. **A payout can be accepted and then fail.** `POST /transfers` returns `201` with `status: new`, and the failure arrives later as `status: failed` with a `status_reason`. Don't tell the operator it worked until the status is `successful`. The status page refreshes until the transfer settles.
19. **Duplicate bank details are rejected.** Adding the same `account_number` to a payment detail again returns `422 error_duplicate_resource`, so look for an existing payment detail first (`paymentDetail`).
20. **Minimum payout.** A 1.00 USDC payout was rejected with `error_validation_value_out_of_range`, so the form asks for at least 5.00.
21. **`applicable_fee` on a failed transfer is not charged.** A failed GBP payout reports a fee (for example 2.75 USDC) while the account balance is identical before, during and after. Read it as the fee that would have applied.
22. **A cross-currency payout fee follows the quote rate.** In the sandbox a GBP Faster Payments payout reported the same fee for 5.00, 10.00 and 50.00, in the source currency and rounded up. The values match a flat 2.00 GBP converted at the quote's rate, so the fee moves slightly from one quote to the next.

## Before this is a real treasury

This example leaves out what needs a database or your own controls. Add these before moving real funds:

- **Webhooks.** This demo reads state from the API on every visit and registers no webhook, because each visitor brings their own tenant. A production treasury should subscribe to `outflows.*` and `inflows.*`, verify the signature and keep an event log.
- **Real authentication and roles.** Here the visitor's own API key is the credential, sealed in a cookie (`src/lib/config.ts`): no per-user accounts and no roles. Use an auth library such as Better Auth, keep keys server-side, and require a second approver above a limit.
- **Allow list by default.** Set `SEND_ONLY_TO_SAVED=true` on any shared deployment, and add an approval step for new recipients.
- **Rate limiting and an audit trail** on the server actions.
- **Production keys.** Sandbox and production use different keys. The app refuses any host that isn't `*.nuvion.dev`; change that guard deliberately.

## How it is built

```
src/lib/nuvion.ts       Typed API client and error type
src/lib/treasury.ts     Accounts with wallets, own counterparty, payment details
src/lib/chains.ts       Networks and address validation
src/lib/money.ts        Amounts in the smallest unit
src/lib/config.ts       The visitor's key and entity, sealed in an httpOnly cookie
src/lib/seal.ts         AES-256-GCM seal and open
src/app/actions.ts      createWallet, getQuote, convert, sendStablecoin server actions
src/app/activity/[id]   Transfer status read from Nuvion
```

Server Actions are public endpoints, so each one validates its input with zod, takes only IDs, an amount and an address from the browser, and reads currencies, networks and quotes back from Nuvion. The API host is checked, not the key prefix.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests for amounts, addresses, destinations and the cookie seal |
| `npm run typecheck` | Type-check |
| `npm run lint` | Lint |
