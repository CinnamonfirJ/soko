import "server-only";
import { pool } from "./db";
import { db } from "./store";
import { CORRIDORS, country, countryFromPhone, findCorridor, isTransactable } from "./corridors";
import { formatMinor, formatRate, parseToMinor } from "./money";
import { providerFor } from "./providers";
import { advanceSandbox, createQuote, PaymentError } from "./engine";
import { overallLabel } from "./stateMachine";
import { ruleExtract } from "./intent";
import { signDraftLink, type LinkDraft } from "./whatsapp";
import type { Transaction } from "./types";

// Slash commands for SokoBot on WhatsApp. Everything here is read-only or produces a draft link:
// no command moves money, and nothing asks for a PIN or password.

export interface CommandResult { reply: string; link?: string }
interface Ctx { from: string; origin: string; country?: string }

const B = (s: string) => `*${s}*`;

export const MENU = [
  `${B("SokoBot")} — send money home, from WhatsApp.`,
  "",
  `💸 ${B("Send money")}`,
  "• Start a transfer — /send",
  "• Or just type it: _send R500 to Tendai in Harare_",
  "• See what they'll receive — /quote 500 to Zimbabwe",
  "• Repeat your last transfer — /again",
  "• Your saved people — /recipients",
  "",
  `📍 ${B("Track")}`,
  "• Follow a transfer — /track SK-XXXX-XXXX",
  "• Your recent transfers — /history",
  "",
  `💱 ${B("Rates & routes")}`,
  "• Today's rates — /rates",
  "• Where you can send — /routes",
  "• How much you can send — /limits",
  "",
  `🛟 ${B("Help")}`,
  "• Talk to us — /support",
  "• Staying safe — /safety",
].join("\n");

const GREETINGS = /^(hi|hello|hey|start|menu|help|hallo|sawubona|howzit)\b[!. ]*$/i;

/** Returns null when the message isn't a command, so the assistant handles free text. */
export async function runCommand(text: string, ctx: Ctx): Promise<CommandResult | null> {
  const t = text.trim();
  if (GREETINGS.test(t)) return { reply: `Hi 👋 I'm Soko. I help you send money across Africa, straight to mobile money or a bank.\n\n${MENU}` };
  if (!t.startsWith("/")) return null;
  const [rawCmd, ...rest] = t.slice(1).split(/\s+/);
  const cmd = rawCmd.toLowerCase().replace(/[^a-z_]/g, "");
  const args = rest.join(" ").trim();
  switch (cmd) {
    case "menu": case "start": case "help": return { reply: MENU };
    case "send": return send(args, ctx);
    case "quote": return quote(args, ctx);
    case "again": return again(ctx);
    case "recipients": return recipients(ctx);
    case "track": case "status": return track(args, ctx);
    case "history": case "recent": return history(ctx);
    case "rates": return rates(ctx);
    case "routes": return routes(ctx);
    case "limits": return limits(ctx);
    case "support": return support(ctx);
    case "safety": return { reply: SAFETY };
    default: return { reply: `I don't know /${rawCmd}. Send /menu to see what I can do.` };
  }
}

// ── account lookup (a WhatsApp number maps to the Soko account with that verified phone) ──
async function userIdFor(from: string): Promise<string | null> {
  const phone = "+" + from.replace(/\D/g, "");
  const { rows } = await pool().query<{ id: string }>('select id from "user" where "phoneNumber" = $1 and "phoneNumberVerified" = true limit 1', [phone]);
  return rows[0]?.id ?? null;
}

const noAccount = (ctx: Ctx) => ({
  reply: `I can't find a Soko account for this number yet.\n\nSign up with this WhatsApp number in under a minute:\n${ctx.origin}/signin`,
});

const link = (ctx: Ctx, d: LinkDraft) => `${ctx.origin}/app/send?wa=${signDraftLink(d, ctx.from)}`;

const myTransfers = (userId: string) =>
  db().transactions.filter((x) => x.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

function needCountry(ctx: Ctx): CommandResult | null {
  if (ctx.country && CORRIDORS.some((c) => c.source === ctx.country && isTransactable(c))) return null;
  return { reply: "I can't tell which country you're sending from by this number. You can send from South Africa, Nigeria, Ghana or Kenya. Start here instead:\n" + `${ctx.origin}/app/send` };
}

// ── /send [n] ──
async function send(args: string, ctx: Ctx): Promise<CommandResult> {
  const n = Number(args);
  if (args && Number.isInteger(n) && n > 0) {
    const userId = await userIdFor(ctx.from);
    if (!userId) return noAccount(ctx);
    const r = savedRecipients(userId)[n - 1];
    if (!r) return { reply: `You don't have a recipient #${n}. Send /recipients to see your list.` };
    const l = link(ctx, { sourceCountry: ctx.country, destinationCountry: r.destinationCountry, recipientName: r.displayName, payoutMethod: r.payoutMethod, savedRecipientId: r.id, recipientProvider: r.provider, recipientMasked: r.maskedIdentifier });
    return { reply: `Sending to ${B(r.displayName)} (${r.provider} ${r.maskedIdentifier}).\n\nChoose the amount, check the rate and fees, and confirm here:\n${l}`, link: l };
  }
  if (args) return { reply: "To send to someone you've saved, use /send followed by their number from /recipients, e.g. /send 1. Or just type it: _send R500 to Tendai in Harare_." };
  const l = link(ctx, { sourceCountry: ctx.country });
  return { reply: `Let's send money 💸\n\nTell me who and how much, like:\n_send R500 to my brother Tendai in Harare_\n\nOr fill it in yourself here:\n${l}`, link: l };
}

// ── /quote 500 to Zimbabwe ──
async function quote(args: string, ctx: Ctx): Promise<CommandResult> {
  const nc = needCountry(ctx); if (nc) return nc;
  const src = country(ctx.country!)!;
  if (!args) return { reply: `Tell me the amount and where, e.g.\n/quote 500 to Zimbabwe\n\nAmounts are in ${src.currency}.` };
  const { draft } = ruleExtract(args, { sourceCountry: src.code });
  if (!draft.destinationCountry) return { reply: "Where is the money going? e.g. /quote 500 to Zimbabwe. Send /routes to see where you can send." };
  if (!draft.amount) return { reply: `How much? e.g. /quote 500 to ${country(draft.destinationCountry)?.name ?? "Zimbabwe"}` };
  if (draft.amountCurrency && draft.amountCurrency !== src.currency) return { reply: `Quotes are in ${src.currency}, the currency you send. Try: /quote ${draft.amount} to ${country(draft.destinationCountry)?.name}` };
  const c = findCorridor(src.code, draft.destinationCountry);
  if (!isTransactable(c)) return { reply: `We can't send from ${src.name} to ${country(draft.destinationCountry)?.name ?? "there"} yet. Send /routes to see where you can send.` };
  const minor = parseToMinor(draft.amount, src.currency);
  if (minor === null) return { reply: "That amount doesn't look right. Try something like /quote 500 to Zimbabwe." };
  try {
    const q = await createQuote((await userIdFor(ctx.from)) ?? "anon", c!.id, minor, c!.fundingMethods[0]);
    const dst = country(c!.destination)!;
    const l = link(ctx, { ...draft, sourceCountry: src.code });
    return {
      link: l,
      reply: [
        `${B("Your quote")} · ${src.name} → ${dst.name}`,
        "",
        `They receive: ${B(formatMinor(q.destinationAmountMinor, q.destinationCurrency))}`,
        `You send: ${formatMinor(q.sourceAmountMinor, q.sourceCurrency)}`,
        `Fees: ${formatMinor(q.totalFeesMinor, q.sourceCurrency)}`,
        `Total to pay: ${B(formatMinor(q.totalAmountMinor, q.sourceCurrency))}`,
        `Rate: ${formatRate(q.fxRate, q.sourceCurrency, q.destinationCurrency)}`,
        "",
        "Fees shown are for paying by " + c!.fundingMethods[0] + ". Your rate is locked when you confirm.",
        "",
        `Send it now:\n${l}`,
      ].join("\n"),
    };
  } catch (e) {
    return { reply: e instanceof PaymentError ? e.message : "I couldn't get a quote right now. Please try again in a moment." };
  }
}

// ── /again ──
async function again(ctx: Ctx): Promise<CommandResult> {
  const userId = await userIdFor(ctx.from);
  if (!userId) return noAccount(ctx);
  const last = myTransfers(userId).find((x) => ["COMPLETED", "PAYOUT_PENDING", "PAYOUT_CONFIRMED", "SETTLED", "SETTLEMENT_PENDING", "FUNDED", "FUNDING_PENDING", "AWAITING_FUNDING"].includes(x.state));
  if (!last) return { reply: "You haven't sent any money yet. Send /send to start your first transfer." };
  const r = db().recipients.find((x) => x.id === last.recipientId);
  const c = CORRIDORS.find((x) => x.id === last.corridorId);
  if (!r || !c || !isTransactable(c)) return { reply: "That route isn't available right now. Send /routes to see where you can send." };
  const amount = formatMinor(last.sourceAmountMinor, last.sourceCurrency, { code: false });
  const l = link(ctx, { sourceCountry: c.source, destinationCountry: c.destination, amount, amountCurrency: last.sourceCurrency, recipientName: r.displayName, payoutMethod: r.payoutMethod, savedRecipientId: r.id, recipientProvider: r.provider, recipientMasked: r.maskedIdentifier });
  return {
    link: l,
    reply: `Send ${B(amount + " " + last.sourceCurrency)} to ${B(r.displayName)} again (${r.provider} ${r.maskedIdentifier})?\n\nYou'll get today's rate and confirm before anything is paid:\n${l}`,
  };
}

// ── /recipients ──
function savedRecipients(userId: string) {
  return db().recipients.filter((r) => r.ownerId === userId && r.saved).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function recipients(ctx: Ctx): Promise<CommandResult> {
  const userId = await userIdFor(ctx.from);
  if (!userId) return noAccount(ctx);
  const list = savedRecipients(userId).slice(0, 9);
  if (!list.length) return { reply: "You haven't saved anyone yet. After a transfer, you can save the recipient so next time is one tap." };
  return {
    reply: [
      B("Your recipients"),
      "",
      ...list.map((r, i) => `${i + 1}. ${r.displayName} — ${country(r.destinationCountry)?.name}, ${r.provider} ${r.maskedIdentifier}`),
      "",
      "Reply /send 1 (or another number) to send to them.",
    ].join("\n"),
  };
}

// ── /track [ref] ──
const STAGE_ICON: Record<string, string> = { CONFIRMED: "✅", SKIPPED: "✅", PENDING: "⏳", FAILED: "⚠️", UNKNOWN: "❔", NOT_STARTED: "▫️" };

function describe(tx: Transaction) {
  const r = db().recipients.find((x) => x.id === tx.recipientId);
  const s = overallLabel(tx);
  return {
    head: `${B(tx.reference)} · ${s.label}`,
    line: `${tx.reference} · ${r?.displayName ?? "Recipient"} · ${formatMinor(tx.destinationAmountMinor, tx.destinationCurrency)} · ${s.label}`,
    stages: [
      `${STAGE_ICON[tx.fundingStatus]} Payment received`,
      `${STAGE_ICON[tx.settlementStatus]} Money on the way (USDT)`,
      `${STAGE_ICON[tx.payoutStatus]} Paying ${r?.displayName ?? "recipient"}${r ? ` on ${r.provider}` : ""}`,
      `${tx.state === "COMPLETED" ? "✅" : "▫️"} Money delivered`,
    ],
    to: r ? `To ${r.displayName} · ${formatMinor(tx.destinationAmountMinor, tx.destinationCurrency)}` : "",
  };
}

async function track(args: string, ctx: Ctx): Promise<CommandResult> {
  const userId = await userIdFor(ctx.from);
  if (!userId) return noAccount(ctx);
  const mine = myTransfers(userId).filter((x) => x.state !== "AWAITING_AUTHORIZATION" && x.state !== "QUOTE_EXPIRED");
  const ref = args.toUpperCase().replace(/\s+/g, "");
  const tx = ref ? mine.find((x) => x.reference.replace(/-/g, "") === ref.replace(/-/g, "")) : mine.find((x) => !["COMPLETED", "REFUNDED", "FAILED"].includes(x.state)) ?? mine[0];
  if (!tx) return { reply: ref ? `I couldn't find ${ref} on your account. Send /history to see your transfers.` : "You don't have any transfers yet. Send /send to start one." };
  advanceSandbox(tx);
  const d = describe(tx);
  const extra = tx.state === "MANUAL_REVIEW" ? "\n\nThis transfer needs attention. Your money is safe and our team is on it. Send /support if you have questions."
    : tx.state === "AWAITING_FUNDING" ? `\n\nWaiting for your payment. Finish paying here:\n${ctx.origin}/app/transfers/${tx.id}` : "";
  return { reply: `${d.head}\n${d.to}\n\n${d.stages.join("\n")}${extra}\n\nFull details: ${ctx.origin}/app/transfers/${tx.id}` };
}

// ── /history ──
async function history(ctx: Ctx): Promise<CommandResult> {
  const userId = await userIdFor(ctx.from);
  if (!userId) return noAccount(ctx);
  const list = myTransfers(userId).filter((x) => x.state !== "AWAITING_AUTHORIZATION" && x.state !== "QUOTE_EXPIRED").slice(0, 5);
  if (!list.length) return { reply: "No transfers yet. Send /send to start your first one." };
  list.forEach(advanceSandbox);
  return { reply: [B("Your recent transfers"), "", ...list.map((x) => "• " + describe(x).line), "", "Send /track followed by a reference for the details."].join("\n") };
}

// ── /rates, /routes, /limits ──
async function rates(ctx: Ctx): Promise<CommandResult> {
  const nc = needCountry(ctx); if (nc) return nc;
  const src = country(ctx.country!)!;
  const lines = await Promise.all(
    CORRIDORS.filter((c) => c.source === src.code && isTransactable(c)).map(async (c) => {
      const q = await providerFor(c).quote(c, c.minMinor);
      return `• ${country(c.destination)?.name}: ${formatRate(q.fxRate, c.sourceCurrency, c.destinationCurrency)}`;
    }),
  );
  return { reply: [B(`Today's rates from ${src.name}`), "", ...lines, "", "Rates move during the day. Your exact rate and fees are shown and locked before you pay. Try /quote 500 to Zimbabwe."].join("\n") };
}

function routes(ctx: Ctx): CommandResult {
  const nc = needCountry(ctx); if (nc) return nc;
  const src = country(ctx.country!)!;
  const lines = CORRIDORS.filter((c) => c.source === src.code && isTransactable(c)).map((c) => {
    const d = country(c.destination)!;
    const how = c.payoutMethods.map((m) => (m === "MOBILE_MONEY" ? (d.mobileMoney.length ? d.mobileMoney.join(", ") : "mobile money") : "bank account")).join(" or ");
    return `• ${d.name} (${d.currency}) — ${how}${c.etaMinutes ? `, usually ${c.etaMinutes[0]}–${c.etaMinutes[1]} min` : ""}`;
  });
  return { reply: [B(`Where you can send from ${src.name}`), "", ...lines, "", "Pay with " + [...new Set(CORRIDORS.filter((c) => c.source === src.code).flatMap((c) => c.fundingMethods))].join(", ") + "."].join("\n") };
}

function limits(ctx: Ctx): CommandResult {
  const nc = needCountry(ctx); if (nc) return nc;
  const src = country(ctx.country!)!;
  const c = CORRIDORS.find((x) => x.source === src.code && isTransactable(x))!;
  return { reply: `${B("Transfer limits")}\n\nFrom ${src.name}, each transfer can be between ${formatMinor(c.minMinor, c.sourceCurrency)} and ${formatMinor(c.maxMinor, c.sourceCurrency)}.\n\nLarger amounts may need extra ID checks by our payment partners.` };
}

// ── /support, /safety ──
function support(ctx: Ctx): CommandResult {
  return { reply: `${B("We're here to help")} 🛟\n\nOpen a request here and include your reference (SK-…):\n${ctx.origin}/app/support\n\nTo check a transfer yourself, send /track.` };
}

const SAFETY = [
  B("Staying safe with Soko"),
  "",
  "• Soko will never ask for your PIN, password or one-time code in WhatsApp.",
  "• You always confirm payments on Soko's secure page, never by replying in chat.",
  "• Check the recipient's name and number before you pay.",
  "• Every transfer has a reference (SK-…). Use it if you contact us.",
  "• \"Delivered\" only appears once the recipient's provider confirms the payout.",
].join("\n");

export const countryForSender = (from: string) => countryFromPhone(from);
