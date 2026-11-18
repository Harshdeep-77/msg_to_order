"use server";

import { revalidatePath } from "next/cache";
import { allocate } from "@/lib/allocate";
import {
  applyAllocation,
  completeOrder,
  getOrder,
  getStock,
  pendingOrders,
  setStock,
} from "@/lib/db";
import { PRODUCTS } from "@/lib/products";
import { sendText } from "@/lib/whatsapp";

export async function markDone(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const order = completeOrder(id);
  if (order) {
    await sendText(
      order.phone,
      `🏭 *Order #${order.id} is ready!*\n🔧 ${order.product} × ${order.quantity}\n\nProduction is complete. Our team will contact you shortly for dispatch.\n\nThank you for choosing *Edquest* 🙏`,
    );
  }
  revalidatePath("/");
}

// Option A: for each product, biggest order that fits first; the rest are rejected.
export async function allocateStock() {
  const messages: { to: string; body: string }[] = [];

  for (const product of Object.values(PRODUCTS)) {
    const pending = pendingOrders(product);
    if (pending.length === 0) continue;

    const stock = getStock(product);
    const decisions = allocate(
      pending.map((o) => ({ id: o.id, quantity: o.quantity })),
      stock,
    );
    applyAllocation(product, decisions);

    for (const d of decisions) {
      const o = getOrder(d.id);
      if (!o) continue;
      const line = `🔧 ${o.product} × ${o.quantity}`;
      if (d.accepted) {
        messages.push({
          to: o.phone,
          body: `✅ *Order #${o.id} Confirmed!*\n${line}\n\n🔔 We'll notify you when production is done.\nThank you! 🙏`,
        });
      } else if (d.reason === "TOO_BIG") {
        messages.push({
          to: o.phone,
          body: `❌ *Order #${o.id} Rejected*\n${line}\n\nSorry, we only have ${stock} units in stock, so we can't fulfil this order.\nSend *Hi* to place a smaller order.\n\n— Edquest`,
        });
      } else {
        messages.push({
          to: o.phone,
          body: `❌ *Order #${o.id} Rejected*\n${line}\n\nSorry, our stock is fully allocated right now.\nSend *Hi* to order again after we restock.\n\n— Edquest`,
        });
      }
    }
  }

  // Status is already saved; a failed send (e.g. 24 h window) is logged by sendText.
  await Promise.all(messages.map((m) => sendText(m.to, m.body)));
  revalidatePath("/");
}

export async function updateStock(formData: FormData) {
  const product = String(formData.get("product") ?? "");
  const qty = Number(formData.get("quantity"));
  if (!Object.values(PRODUCTS).includes(product)) return;
  if (!Number.isInteger(qty) || qty < 0) return;
  setStock(product, qty);
  revalidatePath("/");
}
