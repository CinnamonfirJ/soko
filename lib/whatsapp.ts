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
export function signDraftLink(draft: LinkDraft, from: string): string {
  const body = Buffer.from(JSON.stringify({ d: draft, f: from.slice(-4), e: Date.now() + LINK_TTL_MS })).toString("base64url");
  return `${body}.${hmac("wa:" + body)}`;
}

export function verifyDraftLink(token: string): LinkDraft | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac("wa:" + body))) return null;
  try {
    const { d, e } = JSON.parse(Buffer.from(body, "base64url").toString()) as { d: LinkDraft; e: number };
    return e > Date.now() ? d : null;
  } catch { return null; }
}

/** The transfer-form draft the web app should open with. */
/** A WhatsApp draft may also point at one of the sender's saved recipients (used by /again and /recipients). */
export type LinkDraft = Draft & { savedRecipientId?: string; recipientProvider?: string; recipientMasked?: string };

export function toTransferDraft(d: LinkDraft) {
  const c = d.sourceCountry && d.destinationCountry ? CORRIDORS.find((k) => k.source === d.sourceCountry && k.destination === d.destinationCountry) : undefined;
  const sameCurrency = !d.amountCurrency || d.amountCurrency === country(d.sourceCountry ?? "")?.currency;
  const payoutMethod = c && d.payoutMethod && c.payoutMethods.includes(d.payoutMethod) ? d.payoutMethod : c?.payoutMethods[0];
  return {
    source: d.sourceCountry,
    destination: d.destinationCountry,
    amount: sameCurrency ? d.amount : undefined,
    recipientName: d.recipientName,
    recipient: !c || !d.recipientName || !payoutMethod ? undefined
      : d.savedRecipientId
        ? { displayName: d.recipientName, payoutMethod, provider: d.recipientProvider ?? "", identifier: "", savedRecipientId: d.savedRecipientId, masked: d.recipientMasked }
        : { displayName: d.recipientName, payoutMethod, provider: "", identifier: "" },
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
