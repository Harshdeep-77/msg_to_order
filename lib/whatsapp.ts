const { WHATSAPP_TOKEN, PHONE_NUMBER_ID } = process.env;

async function post(payload: Record<string, unknown>) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    },
  );
  if (!res.ok) console.error("Send failed:", res.status, await res.text());
  return res.ok;
}

export const sendText = (to: string, body: string) =>
  post({ to, type: "text", text: { body } });

export const sendButtons = (
  to: string,
  body: string,
  buttons: [id: string, title: string][],
) =>
  post({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map(([id, title]) => ({
          type: "reply",
          reply: { id, title },
        })),
      },
    },
  });

export const sendList = (
  to: string,
  body: string,
  rows: { id: string; title: string }[],
) =>
  post({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: "View Products",
        sections: [{ title: "Our Products", rows }],
      },
    },
  });
