# Nuvion stablecoin treasury example

A small treasury app that holds USDC and USDT in [Nuvion](https://docs.nuvion.co) accounts, shows a deposit address per network, converts between fiat and stablecoin with FX quotes, sends stablecoin to an external wallet, and tracks every transfer. It has **no database**: Nuvion holds all state. It runs on Next.js 16, React 19, Tailwind CSS 4 and shadcn/ui.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fumohpyro%2Fnuvion-stablecoin-example&project-name=stablecoin-treasury&repository-name=nuvion-stablecoin-example&env=NUVION_API_KEY,NUVION_ENTITY_ID&envDescription=Your%20Nuvion%20sandbox%20API%20key%20and%20the%20ID%20of%20an%20approved%20entity&envLink=https%3A%2F%2Fapp.nuvion.dev%2Fdashboard%2Fsettings)

> The button works once this repository is public. If you don't know your entity ID yet, deploy with a placeholder, open `/setup` on your site to list your approved entities, set the real value in Vercel, and redeploy.

## What it shows

| Page | What it demonstrates | Nuvion calls |
|---|---|---|
| Balances `/` | Balance per account, currency and network | `GET /accounts`, `GET /account-details` |
| Deposit `/deposit` | One wallet address per account and network, with wrong-network warnings; adding a network | `POST /accounts`, `POST /account-details` |
| Convert `/convert` | Quote with a locked rate, then confirm before it expires | `POST /fx-quotes`, `GET /fx-quotes/{id}`, `POST /transfers` (`book-transfer`) |
| Send `/send` | Address validation per network, explicit review step, idempotent send | `POST /counterparties`, `POST /payment-details`, `POST /transfers` (`stablecoin-transfer`) |
| Recipients `/recipients` | A saved-address book stored in Nuvion, usable as an allow list | `POST /counterparties`, `GET /counterparties` |
| Activity `/activity` | Transfer list and a status page per transfer | `GET /transfers`, `GET /transfers/{id}` |
| `/api/webhooks/nuvion` | Signature verification, duplicate-safe event record | none (receives `outflows.*` and `inflows.*` events) |
| Setup `/setup` | First-run checks and an entity lookup | `GET /entities` |

## Deploying

The button above creates the project. After the first deploy, set `DEMO_PASSWORD`, then register `https://<your-domain>/api/webhooks/nuvion` with `POST /entity-webhooks`, put the returned `secret` in `NUVION_WEBHOOK_SECRET` and redeploy. `/setup` shows the URL and the events to subscribe to.

## Run it

You need Node.js 20.9 or later, a Nuvion **sandbox** account, and an approved entity.

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

| Variable | Where to get it |
|---|---|
| `NUVION_API_KEY` | Sandbox dashboard, Settings > Developers |
| `NUVION_ENTITY_ID` | Open `/setup`: it lists your approved entities |
| `DEMO_PASSWORD` | Optional. Asks for this password (any username) on every page except the webhook route. Set it on any public deployment, because the app has no sign-in |
| `SEND_ONLY_TO_SAVED` | Optional. `true` allows sends only to saved recipients, enforced on the server |
| `NUVION_WEBHOOK_SECRET` | Optional. Returned once when you register a webhook. `/setup` shows the URL to register |

The entity needs a fiat account with a balance to convert from. Then use **Deposit** to add a USDC or USDT account on a network, and **Convert** to fund it.

## What the sandbox can and can't do

Verified against `https://api.nuvion.dev`.

| Works | Doesn't |
|---|---|
| Creating stablecoin accounts and issuing wallets on `eth`, `base`, `matic` and `sol` (the address is `pending`, then `active` within seconds) | Receiving a real on-chain deposit. Nothing on a blockchain can pay the address, so a stablecoin balance only comes from converting fiat |
| FX quotes between fiat and stablecoin at a rate of `1` | Sending stablecoin to an external wallet. `POST /transfers` with `stablecoin-transfer` returns `400 error_operation_invalid_for_state` and records the transfer as `failed`, even with an active USDC wallet and enough balance, and the same for USDT |
| Book transfers that convert between your own accounts, settled in about two seconds | A `book-transfer` has no `pending` phase to observe, so the status page for a conversion is already `successful` |
| Address format validation on payment details (`error_validation_invalid_format`) | Webhooks reaching a local machine. Use a tunnel, or send yourself a signed test event (see below) |
| Insufficient funds (`error_transfer_insufficient_funds`) | |

The send screen is complete and its validation, review step and error handling are real. The final API call fails in the sandbox, and the app shows that failure inline and in Activity.

To test the webhook route without a tunnel, sign a body with your secret the way Nuvion does: HMAC-SHA256 over `{timestamp}.{raw body}`, hex, sent in `x-nuvion-event-signature` with the timestamp in `x-nuvion-event-timestamp`. The unit tests in `src/lib/webhook.test.ts` show the exact format.

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
14. **A valid webhook signature doesn't mean the latest state.** The status page always reads the transfer from Nuvion and only uses the webhook to show that an event arrived.
15. **Registering a webhook needs every event in a group.** `POST /entity-webhooks` with `outflows` set returns `422` until all five `outflows` events, both `inflows` events and all three `account_details` events are present as booleans. The signing secret comes back once, in `data.secret`.
16. **A counterparty can carry your own data in `meta`, and the list returns it.** The Recipients page stores each address book entry as a counterparty with `meta: { kind, chain, address }` and finds them with `GET /counterparties?search=Recipient`. The send action reads the network and address back from Nuvion, so the browser can't change where funds go.
17. **There is no fee preview.** The API documents no way to price a transfer before creating it. `applicable_fee` appears on the transfer, so the status page shows it and the review step says a fee may apply.

## Before this is a real treasury

This example leaves out what needs a database or your own controls. Add these before moving real funds:

- **Persistent event log.** The webhook route keeps the last event per transfer in memory. That is empty after a restart and not shared between serverless instances. Store event IDs in a database and ignore repeats.
- **Authentication and roles.** Anyone who can open this app can send funds. Put it behind sign-in, and require a second approver above a limit.
- **Allow list by default.** Set `SEND_ONLY_TO_SAVED=true` on any shared deployment, and add an approval step for new recipients.
- **Rate limiting and an audit trail** on the server actions.
- **Production keys.** Sandbox and production use different keys. The app refuses any host that isn't `*.nuvion.dev`; change that guard deliberately.

## How it is built

```
src/lib/nuvion.ts       Typed API client and error type
src/lib/treasury.ts     Accounts with wallets, own counterparty, payment details
src/lib/chains.ts       Networks and address validation
src/lib/money.ts        Amounts in the smallest unit
src/lib/webhook.ts      Signature verification
src/lib/events.ts       Last webhook event per transfer (in memory)
src/app/actions.ts      createWallet, getQuote, convert, sendStablecoin server actions
src/app/activity/[id]   Transfer status read from Nuvion
```

Server Actions are public endpoints, so each one validates its input with zod, takes only IDs, an amount and an address from the browser, and reads currencies, networks and quotes back from Nuvion. The API host is checked, not the key prefix.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests for amounts, addresses, webhook verification and the event store |
| `npm run typecheck` | Type-check |
| `npm run lint` | Lint |
