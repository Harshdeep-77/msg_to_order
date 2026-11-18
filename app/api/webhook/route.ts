import { after } from "next/server";
import { handleMessage } from "@/lib/bot";

// Meta calls this once to verify the webhook
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (
    q.get("hub.mode") === "subscribe" &&
    q.get("hub.verify_token") === process.env.VERIFY_TOKEN
  )
    return new Response(q.get("hub.challenge"), { status: 200 });
  return new Response(null, { status: 403 });
}

type WaMessage = {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    list_reply?: { id: string };
    button_reply?: { id: string };
  };
};

// Incoming WhatsApp messages
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const incoming: { from: string; text: string }[] = [];
  for (const entry of body?.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const m of (change.value?.messages ?? []) as WaMessage[]) {
        const text =
          m.type === "text"
            ? m.text?.body
            : m.interactive?.list_reply?.id || m.interactive?.button_reply?.id;
        if (text) incoming.push({ from: m.from, text });
      }

  // Reply 200 to Meta right away; process the messages after the response
  after(async () => {
    for (const { from, text } of incoming)
      await handleMessage(from, text).catch((e) => console.error(e));
  });
  return new Response(null, { status: 200 });
}
