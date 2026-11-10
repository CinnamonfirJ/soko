import { NextResponse } from "next/server";
import { interpret, type Draft } from "@/lib/intent";
import { findCorridor, isTransactable } from "@/lib/corridors";
import { safeEqual, velocityOk } from "@/lib/security";
import { countryFromPhone, formatReply, signDraftLink, WHATSAPP_SECRET } from "@/lib/whatsapp";

/**
 * Inbound WhatsApp messages, forwarded by the orchestration layer (n8n) from an approved WhatsApp Business provider.
 *
 * Request:  POST { from: "+27821234567", text: "send R500 to my brother in Harare", draft?: {...} }
 *           header x-soko-channel-secret: SOKO_WHATSAPP_SECRET
 * Response: { reply: string, draft, link?, ready }
 *
 * The orchestrator sends `reply` back to the user and stores `draft` to pass in with their next message.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-soko-channel-secret") ?? "";
  if (!safeEqual(secret, WHATSAPP_SECRET)) return NextResponse.json({ error: "Unauthorized channel." }, { status: 401 });

  let body: { from?: string; text?: string; draft?: Draft };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }
  const from = String(body.from ?? "").slice(0, 20);
  const text = String(body.text ?? "").slice(0, 600).trim();
  if (!from || !text) return NextResponse.json({ error: "from and text are required." }, { status: 422 });
  if (!velocityOk("wa:" + from, 20, 60_000)) return NextResponse.json({ reply: "You're sending messages quickly. Give me a moment and try again." });

  const reply = await interpret(text, body.draft ?? {}, countryFromPhone(from));
  const d = reply.draft;
  const corridor = d.sourceCountry && d.destinationCountry ? findCorridor(d.sourceCountry, d.destinationCountry) : undefined;
  const ready = reply.intent !== "STATUS" && reply.intent !== "HELP" && isTransactable(corridor) && !!d.destinationCountry;
  const origin = process.env.SOKO_PUBLIC_URL || new URL(req.url).origin;
  const link = ready ? `${origin}/app/send?wa=${signDraftLink(d, from)}` : undefined;

  return NextResponse.json({ reply: formatReply(reply, link), draft: d, link, ready, missing: reply.missing });
}
