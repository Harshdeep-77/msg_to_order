import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_STOCK, PRODUCTS } from "./products";

export type Order = {
  id: number;
  phone: string;
  product: string;
  quantity: number;
  status: string; // PENDING | ACCEPTED | REJECTED | COMPLETED
  reason: string | null; // TOO_BIG | ALLOCATED when REJECTED
  created_at: string;
};

export type Stock = { product: string; quantity: number };

export type Session = {
  phone: string;
  step: string;
  product: string | null;
  qty: number | null;
};

// Keep one connection across hot reloads in dev.
const g = globalThis as unknown as { __db?: DatabaseSync };

function open(): DatabaseSync {
  const file = process.env.DB_PATH || path.join(process.cwd(), "data", "orders.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS orders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      phone      TEXT    NOT NULL,
      product    TEXT    NOT NULL,
      quantity   INTEGER NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'PENDING',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      phone   TEXT PRIMARY KEY,
      step    TEXT NOT NULL,
      product TEXT,
      qty     INTEGER
    );

    CREATE TABLE IF NOT EXISTS stock (
      product  TEXT PRIMARY KEY,
      quantity INTEGER NOT NULL
    );
  `);
  // Migration for databases created before allocation existed.
  const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "reason")) {
    db.exec("ALTER TABLE orders ADD COLUMN reason TEXT");
  }
  const seed = db.prepare("INSERT OR IGNORE INTO stock (product, quantity) VALUES (?, ?)");
  for (const p of Object.values(PRODUCTS)) seed.run(p, DEFAULT_STOCK);
  return db;
}

export const db = (g.__db ??= open());

// ---- orders ----
export function insertOrder(phone: string, product: string, quantity: number): Order {
  return db
    .prepare(
      "INSERT INTO orders (phone, product, quantity) VALUES (?, ?, ?) RETURNING *",
    )
    .get(phone, product, quantity) as Order;
}

export function listOrders(): Order[] {
  return db
    .prepare("SELECT * FROM orders ORDER BY id DESC")
    .all() as Order[];
}

// Returns the updated order, or undefined if it isn't an ACCEPTED order.
export function completeOrder(id: number): Order | undefined {
  return db
    .prepare(
      "UPDATE orders SET status = 'COMPLETED' WHERE id = ? AND status = 'ACCEPTED' RETURNING *",
    )
    .get(id) as Order | undefined;
}

// ---- stock + allocation ----
export function listStock(): Stock[] {
  return db.prepare("SELECT product, quantity FROM stock ORDER BY rowid").all() as Stock[];
}

export function getStock(product: string): number {
  const r = db.prepare("SELECT quantity FROM stock WHERE product = ?").get(product) as
    | { quantity: number }
    | undefined;
  return r?.quantity ?? 0;
}

export function setStock(product: string, quantity: number) {
  db.prepare(
    `INSERT INTO stock (product, quantity) VALUES (?, ?)
     ON CONFLICT(product) DO UPDATE SET quantity = excluded.quantity`,
  ).run(product, quantity);
}

export function pendingOrders(product: string): Order[] {
  return db
    .prepare("SELECT * FROM orders WHERE status = 'PENDING' AND product = ? ORDER BY id")
    .all(product) as Order[];
}

// Applies allocation decisions for one product atomically: updates order
// statuses and subtracts the accepted quantity from stock (never below 0).
export function applyAllocation(
  product: string,
  decisions: { id: number; accepted: boolean; reason?: string }[],
) {
  const setStatus = db.prepare(
    "UPDATE orders SET status = ?, reason = ? WHERE id = ? AND status = 'PENDING' RETURNING quantity",
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    let used = 0;
    for (const d of decisions) {
      const row = setStatus.get(
        d.accepted ? "ACCEPTED" : "REJECTED",
        d.reason ?? null,
        d.id,
      ) as { quantity: number } | undefined;
      if (row && d.accepted) used += row.quantity;
    }
    db.prepare("UPDATE stock SET quantity = MAX(quantity - ?, 0) WHERE product = ?").run(
      used,
      product,
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getOrder(id: number): Order | undefined {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
}

// ---- conversation state (kept in DB so it survives restarts) ----
export function getSession(phone: string): Session | undefined {
  return db.prepare("SELECT * FROM sessions WHERE phone = ?").get(phone) as
    | Session
    | undefined;
}

export function setSession(
  phone: string,
  step: string,
  product: string | null = null,
  qty: number | null = null,
) {
  db.prepare(
    `INSERT INTO sessions (phone, step, product, qty) VALUES (?, ?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET step = excluded.step,
       product = excluded.product, qty = excluded.qty`,
  ).run(phone, step, product, qty);
}

export function clearSession(phone: string) {
  db.prepare("DELETE FROM sessions WHERE phone = ?").run(phone);
}
