# msg_to_order – WhatsApp Order System (Next.js)

See `AGENTS.md`: this Next.js version (16) has breaking changes. Read `node_modules/next/dist/docs/` before writing Next code.

## What this project is
Customers message the Edquest WhatsApp number, pick a product, enter a quantity and confirm. The order is saved in SQLite and shown on a web page. An admin clicks **Mark done** on the page when production is finished, and the customer gets a WhatsApp message. It is the simplified Next.js rewrite of `../Whatsapp_order_system` (Express + `orders.json`), which is kept only for reference.

## Tech stack
- Next.js 16 (App Router, `cacheComponents: true`), React 19, Tailwind 4, TypeScript
- SQLite via Node's built-in `node:sqlite` (Node 22+), **raw SQL only**, no ORM, no native modules
- WhatsApp Cloud API (Meta Graph API v20.0) via webhook
- Config in `.env.local` (see `.env.local.example`): `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `VERIFY_TOKEN`, optional `DB_PATH`

## Flow
```
WhatsApp -> Meta -> ngrok -> POST /api/webhook -> lib/bot.ts -> SQLite -> reply via Graph API
Browser  -> /  (app/page.tsx) -> reads SQLite -> orders table
Admin clicks "Mark done" -> server action (app/actions.ts) -> UPDATE order + WhatsApp message
```

## Files
- `app/api/webhook/route.ts` – GET: Meta verification. POST: parses incoming messages, replies 200 immediately, processes them in `after()`.
- `lib/bot.ts` – conversation state machine and message wording. Products and `MAX_QTY` (100) live here.
- `lib/whatsapp.ts` – `sendText`, `sendButtons`, `sendList` (Graph API `fetch`).
- `lib/db.ts` – opens `data/orders.db`, creates tables, all SQL queries. Connection cached on `globalThis` for dev hot reload.
- `app/page.tsx` – orders table + counters. Server component; `await connection()` inside `<Suspense>` so the DB is read on every request.
- `app/auto-refresh.tsx` – client component, `router.refresh()` every 5 s.
- `app/actions.ts` – `markDone` server action. `app/mark-done-button.tsx` – button with pending state.

## Database
- `orders(id, phone, product, quantity, status, created_at)` – status is `PENDING` or `COMPLETED`; `created_at` is UTC.
- `sessions(phone, step, product, qty)` – per-customer chat state (`PRODUCT` -> `QTY` -> `CONFIRM`), stored in the DB so restarts don't lose it.

## Conversation flow
1. `hi / hello / hey / menu / start` (any time) restarts: welcome + product list (tap, or type 1-4).
2. Product chosen -> ask quantity. Must be a whole number > 0; above `MAX_QTY` the bot refuses and waits for a new number.
3. Show `Product × Qty` with Confirm / Change / Cancel buttons. Confirm inserts the order and replies "Order #N Placed".
4. Interactive replies arrive as ids (`p1`-`p4`, `confirm`, `change`, `cancel`) and go through the same `handleMessage` as typed text.

## Message style (user preference)
Short and clean. A few emojis. No "Step 1 of 3" labels, no long detail blocks.

## Gotchas
- Cache Components: any DB read in a page must happen after `await connection()` inside `<Suspense>`, otherwise it is frozen at build time.
- `node:sqlite` needs `@types/node` v22+ for types and prints an "experimental" warning. Harmless.
- WhatsApp allows free-form messages only within 24 h of the customer's last message. "Mark done" after that fails to send (status still updates). Needs an approved message template – not built.
- Temporary Meta tokens expire in ~24 h (error `190` in the log). Update `.env.local` and restart the server.
- The free ngrok URL changes on every restart; update the callback URL in Meta (`<url>/api/webhook`).
- Don't run `next build` while `npm run dev` is running; they share `.next`.
- The page and "Mark done" have **no login**. Add auth before exposing this publicly.

## Run
```
npm install
copy .env.local.example .env.local   # fill in values
npm run dev                          # http://localhost:3000
ngrok http 3000                      # second terminal
```
Webhook URL in Meta: `https://<ngrok-url>/api/webhook`, verify token = `VERIFY_TOKEN`, subscribe to `messages`.

## Possible next steps
- Login for the admin page
- Message template for the "production done" notification
- Per-product stock limits instead of one global `MAX_QTY`
- Cancel/search/filter on the orders page
