import { clearSession, getSession, getStock, insertOrder, setSession } from "./db";
import { PRODUCTS } from "./products";
import { sendButtons, sendList, sendText } from "./whatsapp";

const COMPANY = "Edquest";

const sendProductList = (to: string, intro: string) =>
  sendList(
    to,
    `${intro}\n\nPlease choose a product 👇`,
    Object.entries(PRODUCTS).map(([n, p]) => ({ id: "p" + n, title: `${n}. ${p}` })),
  );

const askConfirm = (to: string, product: string, qty: number) =>
  sendButtons(to, `📋 *${product} × ${qty}*\nConfirm your order?`, [
    ["confirm", "✅ Confirm"],
    ["change", "✏️ Change"],
    ["cancel", "❌ Cancel"],
  ]);

// Flow: PRODUCT -> QTY -> CONFIRM -> order saved
export async function handleMessage(from: string, input: string) {
  const msg = input.trim();
  const s = getSession(from);

  // A greeting always (re)starts the flow
  if (/^(hi+|hello|hey|menu|start)$/i.test(msg)) {
    setSession(from, "PRODUCT");
    return sendProductList(from, `👋 *Welcome to ${COMPANY}!*`);
  }

  if (s?.step === "PRODUCT") {
    const n = msg.replace(/^p/i, "");
    if (!PRODUCTS[n])
      return sendProductList(from, "⚠️ Sorry, that isn't a valid option.");
    setSession(from, "QTY", PRODUCTS[n]);
    return sendText(
      from,
      `🔧 *${PRODUCTS[n]}*\nHow many units do you need? (e.g. 50)`,
    );
  }

  if (s?.step === "QTY" && s.product) {
    const qty = Number(msg);
    if (!Number.isInteger(qty) || qty <= 0)
      return sendText(
        from,
        "⚠️ Please enter a valid quantity as a whole number, e.g. *50*.",
      );
    const available = getStock(s.product);
    if (qty > available)
      return sendText(
        from,
        `⚠️ Sorry, we only have ${available} units of ${s.product} in stock.\nPlease enter ${available} or less.`,
      );
    setSession(from, "CONFIRM", s.product, qty);
    return askConfirm(from, s.product, qty);
  }

  if (s?.step === "CONFIRM" && s.product && s.qty) {
    const a = msg.toLowerCase();
    if (a === "confirm" || a === "yes") {
      const order = insertOrder(from, s.product, s.qty);
      clearSession(from);
      return sendText(
        from,
        `🎉 *Order #${order.id} Placed!*\n🔧 ${order.product} × ${order.quantity}\n\n🔔 We'll notify you when production is done.\nThank you! 🙏`,
      );
    }
    if (a === "change") {
      setSession(from, "PRODUCT");
      return sendProductList(from, "No problem! Let's pick again.");
    }
    if (a === "cancel" || a === "no") {
      clearSession(from);
      return sendText(
        from,
        `❌ *Order cancelled.*\nSend *Hi* whenever you want to order again.\n\n— ${COMPANY}`,
      );
    }
    return askConfirm(from, s.product, s.qty);
  }

  return sendText(from, `👋 Hello from *${COMPANY}*!\nSend *Hi* to place an order.`);
}
