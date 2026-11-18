# msg_to_order – WhatsApp Order System

Customers place orders by chatting with the **Edquest WhatsApp number**. The factory team sees every order on a simple web page, decides which orders to accept based on stock, and marks them done when production is finished. The customer is told about every step on WhatsApp.

## What it does (in plain words)

1. **A customer sends "Hi"** on WhatsApp.
2. The bot shows a product list: HYD Rack, Gear Shift Rail, Gear Shift Shaft, Inner Shaft.
3. The customer picks a product and types a quantity (whole number, must be within available stock).
4. The bot shows `Product × Quantity` with **Confirm / Change / Cancel** buttons.
5. On Confirm, the order is saved as **PENDING** and the customer gets "Order #N Placed".
6. The admin opens the web page (`http://localhost:3000`) and sees all orders, live (refreshes every 5 seconds), plus stock per product.
7. The admin clicks **Allocate stock**. For each product the biggest orders are served first while stock lasts:
   - fits in stock -> **ACCEPTED**, customer gets "Order Confirmed"
   - too big for total stock, or stock already used up -> **REJECTED**, customer gets a polite reason
8. When production is finished, the admin clicks **Mark done** -> status becomes **COMPLETED** and the customer gets "Your order is ready" on WhatsApp.
9. The admin can also edit the stock quantity of each product on the page.

### Order status life cycle

```
PENDING --(Allocate stock)--> ACCEPTED --(Mark done)--> COMPLETED
        \--(Allocate stock)--> REJECTED  (reason: TOO_BIG or ALLOCATED)
```

## How it works

```
WhatsApp -> Meta Cloud API -> ngrok -> POST /api/webhook -> lib/bot.ts -> SQLite -> reply via Graph API
Browser  -> /  (app/page.tsx) -> reads SQLite -> orders table
Admin buttons -> server actions (app/actions.ts) -> update SQLite + send WhatsApp message
```

## Tech stack

- Next.js 16 (App Router), React 19, Tailwind 4, TypeScript
- SQLite through Node's built-in `node:sqlite` (Node 22+). Raw SQL only, no ORM, no native modules.
- WhatsApp Cloud API (Meta Graph API) via webhook

## Project files

```
app/page.tsx               Orders page + stock (server component, reads SQLite)
app/auto-refresh.tsx       Refreshes the page every 5 seconds
app/actions.ts             Server actions: markDone, allocateStock, updateStock
app/mark-done-button.tsx   "Mark done" button
app/allocate-button.tsx    "Allocate stock" button
app/api/webhook/route.ts   Meta webhook (GET = verification, POST = incoming messages)
lib/bot.ts                 Chat conversation flow and message wording
lib/products.ts            Product list and default stock
lib/allocate.ts            Stock allocation rule (biggest order first)
lib/whatsapp.ts            Send text / buttons / list via Graph API
lib/db.ts                  SQLite schema and all SQL queries
```

## Database (`data/orders.db`)

- `orders` – id, phone, product, quantity, status, reason, created_at (UTC)
- `sessions` – each customer's chat step (`PRODUCT` -> `QTY` -> `CONFIRM`), so a restart doesn't lose it
- `stock` – available units per product

## Setup

You need Node 22+, a Meta WhatsApp Cloud API app, and [ngrok](https://ngrok.com).

```
npm install
copy .env.local.example .env.local   # then fill in the values
npm run dev                          # http://localhost:3000
ngrok http 3000                      # in a second terminal
```

`.env.local` values:

| Variable | Meaning |
|---|---|
| `WHATSAPP_TOKEN` | Access token from Meta |
| `PHONE_NUMBER_ID` | WhatsApp phone number ID from Meta |
| `VERIFY_TOKEN` | Any secret string you choose; must match Meta's setting |
| `DB_PATH` | Optional, custom database location |

In Meta > WhatsApp > Configuration set:
- Callback URL: `https://<ngrok-url>/api/webhook`
- Verify token: the `VERIFY_TOKEN` from `.env.local`
- Subscribe to the `messages` field

## Good to know

- WhatsApp allows free-form messages only within **24 hours** of the customer's last message. After that, notifications fail to send (the status still updates). A Meta-approved message template would fix this; it is not built yet.
- Temporary Meta tokens expire in about 24 hours (error `190` in the log). Update `.env.local` and restart.
- The free ngrok URL changes on every restart; update the callback URL in Meta.
- The web page has **no login**. Add authentication before exposing it publicly.
- Don't run `next build` while `npm run dev` is running; they share the `.next` folder.

## Possible next steps

- Login for the admin page
- Message template for the "production done" notification
- Search / filter on the orders page
