import { Suspense } from "react";
import { connection } from "next/server";
import { listOrders, listStock } from "@/lib/db";
import AutoRefresh from "./auto-refresh";
import MarkDoneButton from "./mark-done-button";
import AllocateButton from "./allocate-button";
import { allocateStock, markDone, updateStock } from "./actions";

async function Orders() {
  await connection(); // read the DB on every request, not at build time
  const orders = listOrders();
  const stock = listStock();
  const pending = orders.filter((o) => o.status === "PENDING").length;

  const total = orders.reduce((n, o) => n + o.quantity, 0);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <Stat label="Orders" value={orders.length} />
        <Stat label="Total units" value={total} />
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">Stock</h2>
          <form action={allocateStock} className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{pending} pending</span>
            <AllocateButton />
          </form>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stock.map((s) => (
            <form key={s.product} action={updateStock} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <input type="hidden" name="product" value={s.product} />
              <div className="text-xs text-zinc-500">{s.product}</div>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  name="quantity"
                  min={0}
                  defaultValue={s.quantity}
                  key={s.quantity}
                  className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm tabular-nums dark:border-zinc-700"
                />
                <button type="submit" className="rounded bg-zinc-800 px-2 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900">
                  Set
                </button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Placed (UTC)</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  No orders yet. Send &quot;Hi&quot; on WhatsApp to place one.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">#{o.id}</td>
                <td className="px-4 py-3 font-mono">{o.phone}</td>
                <td className="px-4 py-3">{o.product}</td>
                <td className="px-4 py-3 text-right tabular-nums">{o.quantity}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === "COMPLETED"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : o.status === "ACCEPTED"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : o.status === "REJECTED"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{o.created_at}</td>
                <td className="px-4 py-3 text-right">
                  {o.status === "ACCEPTED" && (
                    <form action={markDone}>
                      <input type="hidden" name="id" value={o.id} />
                      <MarkDoneButton />
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Edquest Orders</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Orders placed through WhatsApp. Updates automatically.
      </p>
      <Suspense fallback={<p className="text-zinc-500">Loading orders…</p>}>
        <Orders />
      </Suspense>
      <AutoRefresh />
    </main>
  );
}
