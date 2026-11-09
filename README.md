# Nuvion stablecoin treasury example

A small treasury app that holds USDC and USDT in [Nuvion](https://docs.nuvion.co) accounts, shows a deposit address per network, converts between fiat and stablecoin with FX quotes, sends stablecoin to an external wallet, and tracks every transfer. It has **no database**: Nuvion holds all state. It runs on Next.js 16, React 19, Tailwind CSS 4 and shadcn/ui.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fumohpyro%2Fnuvion-stablecoin-example&project-name=stablecoin-treasury&repository-name=nuvion-stablecoin-example&env=SESSION_SECRET&envDescription=A%20long%20random%20string%20that%20seals%20each%20visitor%27s%20cookie&envLink=https%3A%2F%2Fgithub.com%2Fumohpyro%2Fnuvion-stablecoin-example%23run-it)

> The button works once this repository is public. It asks for one value, `SESSION_SECRET`. Visitors add their own Nuvion sandbox key on the Settings page.

> Independent demo. Sandbox only, no real funds move on-chain. Not financial or investment advice. Not affiliated with or endorsed by Circle, Tether or any stablecoin issuer. Use fake details only. See the app's `/privacy` page.

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
| Settings `/settings` | Bring your own key: look up your approved entities and connect one; register a webhook for live updates | `GET /entities`, `GET /accounts`, `POST /entity-webhooks`, `PATCH /entity-webhooks/{id}`, `POST /webhook-tests` |
| Live refresh | The dashboard refreshes when Nuvion sends an event (see below) | `GET /webhook-logs` |
| `/api/webhooks/nuvion/[token]` | Signature verification, stateless | none (receives `accounts.*`, `account_details.*`, `inflows.*`, `outflows.*`) |

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
23. **Registering a webhook is two steps when the URL depends on the secret.** `POST /entity-webhooks` returns `data.secret` once. To put it in the URL, `PATCH` the URL afterwards. That `PATCH` triggers a signed `webhook.health` request, which the receiver must answer `2xx` for the change to apply.
24. **A webhook can only reach a public https URL.** `http` and `localhost` are refused, so test the receiver locally by signing a payload yourself (`src/lib/webhook.test.ts` shows how).
25. **Send every event in a group.** `enabled_events.outflows` needs all five outflow flags, `inflows` both, `account_details` all three. A missing one returns `422`.
26. **Webhook deliveries are logged by Nuvion.** `GET /webhook-logs?entity_webhook_id=...` returns them newest first, including test events and `webhook.health` checks. That is what makes a serverless poll possible without your own store.

## Live balance refresh

The dashboard refreshes itself when something changes in Nuvion, without a database.

**How it works**

1. **Settings > Register webhook** calls `POST /entity-webhooks` with your key for the entity you connected, subscribed to account, wallet and transfer events (`accounts.created`, `account_details.*`, `inflows.*`, `outflows.*`). It needs the app's public https address, so it works on the deployed app and not on `localhost`.
2. **The receiver** is `POST /api/webhooks/nuvion/[token]`. It reads the raw body, rebuilds `{x-nuvion-event-timestamp}.{body}`, computes HMAC-SHA256 with the webhook's secret and compares it with `x-nuvion-event-signature` in constant time (`src/lib/webhook.ts`). A bad signature returns `401`. A good one returns `200` straight away, because Nuvion blacklists a webhook after three failed deliveries in 24 hours.
3. **The browser** polls `GET /api/pulse` every 5 seconds while the tab is visible (`src/components/live-refresh.tsx`). When the stamp it returns changes, it calls `router.refresh()` and shows a toast.

**Where the secret lives.** Nuvion shows the signing secret once, and the receiver is called by Nuvion, not by your browser, so it has no cookie to read it from. The app solves both without a database:

- the secret is sealed in your session cookie, as the Settings page needs to know a webhook exists;
- the receiver's URL carries the secret too, sealed with `SESSION_SECRET` (AES-256-GCM). Any serverless instance can open the token and verify a delivery. Nuvion stores the URL but can't read the token, and nobody can forge one without `SESSION_SECRET`.

Because the secret is only known after the webhook exists, registering is two steps: create it with a placeholder URL, then `PATCH` the URL to the sealed one. Nuvion sends a signed `webhook.health` request to the new URL first and applies the change only if the receiver answers `2xx`, so a successful registration also proves the signature check works.

**The tradeoff: why polling and not push.** A serverless function can't push to a browser, and without shared storage one instance can't tell another that an event arrived. Server-sent events fail the same way: the instance holding the open stream is rarely the one that received the webhook, and functions have a maximum duration. So the event is the trigger and the browser pulls:

| | Webhook registered | No webhook |
|---|---|---|
| What the poll reads | The newest delivery log for your webhook (`GET /webhook-logs`) | The account balances (`GET /accounts`) |
| What changes the stamp | Any subscribed event, including a transfer that fails without moving a balance | A balance changing |
| Calls to Nuvion | 1 per poll | 1 per poll |
| Latency | Up to 5 seconds after the event | Up to 5 seconds after the change |

Nuvion's delivery log is the shared store, so every instance agrees and nothing is kept in memory. The cost is one API call per open tab every 5 seconds, and up to 5 seconds of delay. Add a store such as Redis or a database and the receiver could write the event, which lets the poll be a local read.

Treat the event as a trigger, never as the data: every page reads the current state from the API when it refreshes.

## Before this is a real treasury

This example leaves out what needs a database or your own controls. Add these before moving real funds:

- **An event log.** The receiver verifies and acknowledges but stores nothing, and the browser polls. A production treasury should write each event ID to a database, ignore repeats (Nuvion retries and can deliver an event twice) and act on events server-side.
- **Real authentication and roles.** Here the visitor's own API key is the credential, sealed in a cookie (`src/lib/config.ts`): no per-user accounts and no roles. Use an auth library such as Better Auth, keep keys server-side, and require a second approver above a limit.
- **Allow list by default.** Set `SEND_ONLY_TO_SAVED=true` on any shared deployment, and add an approval step for new recipients.
- **Rate limiting and an audit trail** on the server actions.
- **Production keys.** Sandbox and production use different keys. The app refuses any host that isn't `*.nuvion.dev`; change that guard deliberately.

## How it is built

```
src/lib/nuvion.ts       Typed API client and error type
src/lib/webhook.ts      Signature verification
src/lib/pulse.ts        The stamp the dashboard polls
src/app/api/webhooks    Stateless webhook receiver (secret sealed in its URL)
src/app/api/pulse       Lightweight endpoint the dashboard polls
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
| `npm test` | Unit tests for amounts, addresses, destinations, the cookie seal, webhook signatures and the live-refresh stamp |
| `npm run typecheck` | Type-check |
| `npm run lint` | Lint |
