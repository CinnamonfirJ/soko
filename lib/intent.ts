import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { COUNTRIES, CORRIDORS } from "./corridors";
import type { CurrencyCode } from "./money";

// The assistant turns language into a DRAFT. It never prices, authorizes, or executes.
export interface Draft {
  amount?: string; // decimal string as typed — converted to minor units by the payment engine
  amountCurrency?: CurrencyCode | "USD";
  sourceCountry?: string;
  destinationCountry?: string;
  recipientName?: string;
  recipientRelation?: string;
  payoutMethod?: "MOBILE_MONEY" | "BANK";
}

export interface AssistantReply {
  intent: "SEND" | "QUOTE_QUESTION" | "STATUS" | "HELP" | "OTHER";
  draft: Draft;
  missing: (keyof Draft)[];
  message: string;
  extractedBy: "llm" | "rules";
  clarification?: string;
  routeNote?: string;
}

const COUNTRY_ALIASES: Record<string, string> = {
  nigeria: "NG", naija: "NG", lagos: "NG", abuja: "NG",
  ghana: "GH", accra: "GH", kumasi: "GH",
  kenya: "KE", nairobi: "KE", mombasa: "KE",
  uganda: "UG", kampala: "UG",
  "south africa": "ZA", johannesburg: "ZA", joburg: "ZA", "cape town": "ZA",
  tanzania: "TZ", "dar es salaam": "TZ",
  senegal: "SN", dakar: "SN",
  rwanda: "RW", kigali: "RW",
  zimbabwe: "ZW", harare: "ZW",
  egypt: "EG", cairo: "EG",
};

const CURRENCY_WORDS: [RegExp, CurrencyCode | "USD"][] = [
  [/\b(usd|dollars?|bucks|\$)/i, "USD"],
  [/\b(ngn|naira|₦)/i, "NGN"],
  [/\b(ghs|cedis?|gh₵)/i, "GHS"],
  [/\b(kes|ksh|kenyan shillings?)/i, "KES"],
  [/\b(ugx|ugandan shillings?)/i, "UGX"],
  [/\b(zar|rands?)/i, "ZAR"],
  [/\b(tzs|tanzanian shillings?)/i, "TZS"],
];

const RELATIONS = ["mother", "mum", "mom", "father", "dad", "sister", "brother", "aunt", "uncle", "cousin", "wife", "husband", "son", "daughter", "friend", "supplier", "vendor", "landlord", "freelancer", "grandma", "grandmother"];

export function ruleExtract(text: string, prev: Draft = {}): { intent: AssistantReply["intent"]; draft: Draft } {
  const t = text.toLowerCase();
  const d: Draft = { ...prev };
  let intent: AssistantReply["intent"] = "OTHER";
  if (/\b(send|pay|transfer|remit|wire)\b/.test(t)) intent = "SEND";
  else if (/\b(how much|cost|fee|rate|charge)\b/.test(t)) intent = "QUOTE_QUESTION";
  else if (/\b(status|where is|track|arrived|received)\b/.test(t)) intent = "STATUS";
  else if (/\b(help|support|problem|stuck)\b/.test(t)) intent = "HELP";

  const amt = t.match(/(?:[$₦]\s?)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(k|thousand|m|million)?/);
  if (amt) {
    let whole = BigInt(amt[1].replace(/,/g, ""));
    const mult = amt[3];
    if (mult === "k" || mult === "thousand") whole *= 1000n;
    if (mult === "m" || mult === "million") whole *= 1_000_000n;
    d.amount = mult ? whole.toString() : whole.toString() + (amt[2] ? "." + amt[2] : "");
  }
  for (const [re, cur] of CURRENCY_WORDS) if (re.test(text)) { d.amountCurrency = cur; break; }

  // "to/in X" → destination, "from X" → source
  const names = Object.keys(COUNTRY_ALIASES).sort((a, b) => b.length - a.length);
  for (const n of names) {
    const fromRe = new RegExp(`\\bfrom\\s+(?:\\w+\\s+){0,2}${n}\\b`);
    const toRe = new RegExp(`\\b(?:to|in|into)\\s+(?:\\w+\\s+){0,3}${n}\\b`);
    if (fromRe.test(t)) d.sourceCountry = COUNTRY_ALIASES[n];
    else if (toRe.test(t) || (t.includes(n) && !d.destinationCountry)) d.destinationCountry = COUNTRY_ALIASES[n];
  }
  if (d.sourceCountry && d.sourceCountry === d.destinationCountry) delete d.sourceCountry;

  const rel = RELATIONS.find((r) => new RegExp(`\\b(my|our)\\s+${r}\\b`).test(t));
  if (rel) d.recipientRelation = rel;
  const relNamed = rel ? text.match(new RegExp(`\\b${rel}\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)`, "i")) : null;
  const introduced = text.match(/\b(?:name is|named|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const named = introduced ?? relNamed ?? text.match(/\b(?:to|for|pay)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (named) {
    const nm = named[1].split(/\s+/).filter((w) => !COUNTRY_ALIASES[w.toLowerCase()] && !["in", "at", "from"].includes(w.toLowerCase())).join(" ");
    if (nm && /^[A-Z]/.test(nm)) d.recipientName = nm;
  }
  if (/\b(m-?pesa|momo|mobile money|wallet|ecocash|airtel)\b/.test(t)) d.payoutMethod = "MOBILE_MONEY";
  if (/\b(bank|account)\b/.test(t)) d.payoutMethod = "BANK";
  // A follow-up ("his name is Tendai") continues the transfer already being drafted.
  if (intent === "OTHER" && (prev.destinationCountry || prev.amount)) intent = "SEND";
  return { intent, draft: d };
}

const LlmSchema = z.object({
  intent: z.enum(["SEND", "QUOTE_QUESTION", "STATUS", "HELP", "OTHER"]),
  amount: z.string().nullable().describe("Decimal amount exactly as the user stated, digits only, e.g. '200' or '1500.50'. null if not stated."),
  amountCurrency: z.enum(["USD", "NGN", "GHS", "KES", "UGX", "ZAR", "TZS"]).nullable(),
  sourceCountry: z.string().nullable().describe("ISO-2 code of the sender's country if stated"),
  destinationCountry: z.string().nullable().describe("ISO-2 code of the recipient's country if stated"),
  recipientName: z.string().nullable(),
  recipientRelation: z.string().nullable(),
  payoutMethod: z.enum(["MOBILE_MONEY", "BANK"]).nullable(),
  ambiguity: z.string().nullable().describe("A single short clarifying question if something is ambiguous, else null"),
});

async function llmExtract(text: string, prev: Draft) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const res = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(LlmSchema) },
      system:
        "You extract cross-border payment intent for SokoBot. Only extract what the user explicitly said; never invent amounts, rates, fees, or countries. " +
        `Supported country codes: ${COUNTRIES.map((c) => `${c.code}=${c.name}`).join(", ")}. ` +
        `Current partial draft (may be empty): ${JSON.stringify(prev)}. Merge: keep prior values unless the user changes them.`,
      messages: [{ role: "user", content: text }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return null;
    return res.parsed_output;
  } catch {
    return null; // fall back to deterministic rules
  }
}

export async function interpret(text: string, prev: Draft = {}, userCountry?: string): Promise<AssistantReply> {
  let extractedBy: AssistantReply["extractedBy"] = "rules";
  let { intent, draft } = ruleExtract(text, prev);
  let clarification: string | undefined;
  const llm = await llmExtract(text, prev);
  if (llm) {
    extractedBy = "llm";
    intent = llm.intent;
    const clean = <T,>(v: T | null) => (v === null ? undefined : v);
    draft = {
      ...prev,
      ...Object.fromEntries(Object.entries({
        amount: clean(llm.amount), amountCurrency: clean(llm.amountCurrency), sourceCountry: clean(llm.sourceCountry),
        destinationCountry: clean(llm.destinationCountry), recipientName: clean(llm.recipientName),
        recipientRelation: clean(llm.recipientRelation), payoutMethod: clean(llm.payoutMethod),
      }).filter(([, v]) => v !== undefined)),
    } as Draft;
    if (draft.destinationCountry && !COUNTRIES.some((c) => c.code === draft.destinationCountry)) delete draft.destinationCountry;
    if (draft.sourceCountry && !COUNTRIES.some((c) => c.code === draft.sourceCountry)) delete draft.sourceCountry;
    clarification = clean(llm.ambiguity);
  }
  if (!draft.sourceCountry && userCountry) draft.sourceCountry = userCountry;
  // "naira" implies sending from Nigeria, etc. — only when the currency belongs to exactly one sending country.
  if (!draft.sourceCountry && draft.amountCurrency && draft.amountCurrency !== "USD") {
    const match = COUNTRIES.filter((c) => c.currency === draft.amountCurrency && CORRIDORS.some((k) => k.source === c.code));
    if (match.length === 1 && match[0].code !== draft.destinationCountry) draft.sourceCountry = match[0].code;
  }

  const missing: (keyof Draft)[] = [];
  if (!draft.destinationCountry) missing.push("destinationCountry");
  if (!draft.sourceCountry) missing.push("sourceCountry");
  if (!draft.amount) missing.push("amount");
  if (!draft.recipientName) missing.push("recipientName");

  let routeNote: string | undefined;
  if (draft.sourceCountry && draft.destinationCountry) {
    const c = CORRIDORS.find((k) => k.source === draft.sourceCountry && k.destination === draft.destinationCountry);
    const s = COUNTRIES.find((x) => x.code === draft.sourceCountry)!;
    const dd = COUNTRIES.find((x) => x.code === draft.destinationCountry)!;
    if (!c || c.status === "UNAVAILABLE") routeNote = `We can't send from ${s.name} to ${dd.name} yet. You can pick another destination.`;
    else if (c.status === "MAINTENANCE") routeNote = `${s.name} → ${dd.name} is paused for maintenance right now.`;
    if (draft.amountCurrency && draft.amountCurrency !== s.currency && draft.amountCurrency !== dd.currency) {
      clarification ??= `You said ${draft.amountCurrency}. Transfers on this route are sent in ${s.currency}. What amount in ${s.currency} would you like to send?`;
      if (!missing.includes("amount")) missing.push("amount");
    } else if (draft.amountCurrency === dd.currency && draft.amountCurrency !== s.currency) {
      clarification ??= `Is ${draft.amount} ${dd.currency} what your recipient should get? I'll send in ${s.currency}, so please tell me the amount in ${s.currency} you want to send.`;
      if (!missing.includes("amount")) missing.push("amount");
    }
  }

  const who = draft.recipientName ?? (draft.recipientRelation ? `your ${draft.recipientRelation}` : "your recipient");
  const where = draft.destinationCountry ? COUNTRIES.find((c) => c.code === draft.destinationCountry)?.name : undefined;
  let message: string;
  if (intent === "STATUS") message = "You can see every transfer and its verified status under Activity. Open a transfer to see each confirmed step.";
  else if (intent === "HELP") message = "I can help. If a transfer is stuck, open it from Activity: your reference stays saved, and Support can look it up.";
  else if (routeNote) message = routeNote;
  else if (clarification) message = clarification;
  else if (missing.length === 0) message = `Got it. A transfer to ${who}${where ? ` in ${where}` : ""}. Continue to add their payout details. You'll see the exact rate and fees before anything is paid.`;
  else {
    const ask: Record<string, string> = { destinationCountry: "which country they're in", sourceCountry: "which country you're sending from", amount: "how much you'd like to send", recipientName: `${who === "your recipient" ? "the recipient's" : who + "'s"} full name` };
    message = `Sure. I just need ${missing.map((m) => ask[m]).filter(Boolean).join(", ").replace(/, ([^,]*)$/, " and $1")}.`;
    if (intent === "QUOTE_QUESTION") message = "I'll fetch a real quote once I know the route and amount. " + message;
  }
  return { intent, draft, missing, message, extractedBy, clarification, routeNote };
}
