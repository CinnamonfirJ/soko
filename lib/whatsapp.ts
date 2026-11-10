import "server-only";
import { CORRIDORS, country, countryFromPhone } from "./corridors";
export { countryFromPhone };
import { hmac, safeEqual } from "./security";
import type { AssistantReply, Draft } from "./intent";

// WhatsApp channel (PRD F10 / Flow E).
// An approved WhatsApp Business provider (via n8n or a BSP such as WATI) forwards inbound messages here.
// SokoBot replies with text plus a short-lived signed link. Payment authorization always happens on the
// secure web page behind that link: a "yes" in WhatsApp is never treated as approval to pay.

export const WHATSAPP_SECRET = process.env.SOKO_WHATSAPP_SECRET || "dev-only-whatsapp-secret";
const LINK_TTL_MS = 30 * 60 * 1000;

/** Signed, expiring token carrying only the draft (no payment data, no authorization). */
export function signDraftLink(draft: Draft, from: string): string {
  const body = Buffer.from(JSON.stringify({ d: draft, f: from.slice(-4), e: Date.now() + LINK_TTL_MS })).toString("base64url");
  return `${body}.${hmac("wa:" + body)}`;
}

export function verifyDraftLink(token: string): Draft | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac("wa:" + body))) return null;
  try {
    const { d, e } = JSON.parse(Buffer.from(body, "base64url").toString()) as { d: Draft; e: number };
    return e > Date.now() ? d : null;
  } catch { return null; }
}

/** The transfer-form draft the web app should open with. */
export function toTransferDraft(d: Draft) {
  const c = d.sourceCountry && d.destinationCountry ? CORRIDORS.find((k) => k.source === d.sourceCountry && k.destination === d.destinationCountry) : undefined;
  const sameCurrency = !d.amountCurrency || d.amountCurrency === country(d.sourceCountry ?? "")?.currency;
  return {
    source: d.sourceCountry,
    destination: d.destinationCountry,
    amount: sameCurrency ? d.amount : undefined,
    recipientName: d.recipientName,
    recipient: c && d.recipientName ? { displayName: d.recipientName, payoutMethod: d.payoutMethod && c.payoutMethods.includes(d.payoutMethod) ? d.payoutMethod : c.payoutMethods[0], provider: "", identifier: "" } : undefined,
    step: 1,
    fromAssistant: true,
    channel: "whatsapp" as const,
  };
}

/** Plain-text WhatsApp reply (WhatsApp supports *bold* and line breaks). */
export function formatReply(r: AssistantReply, link?: string): string {
  const d = r.draft;
  const src = country(d.sourceCountry ?? ""), dst = country(d.destinationCountry ?? "");
  const lines = [r.message];
  if (r.intent === "SEND" || r.intent === "QUOTE_QUESTION") {
    const facts = [
      d.amount && `Amount: *${d.amount} ${d.amountCurrency ?? src?.currency ?? ""}*`.trim(),
      src && dst && `Route: ${src.name} → ${dst.name}`,
      (d.recipientName || d.recipientRelation) && `To: ${d.recipientName ?? "your " + d.recipientRelation}`,
    ].filter(Boolean);
    if (facts.length) lines.push("", ...(facts as string[]));
  }
  if (link) lines.push("", "Review the exact rate and fees, then confirm securely here:", link, "", "_SokoBot will never ask for your PIN or password in WhatsApp._");
  return lines.join("\n");
}
