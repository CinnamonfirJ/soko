import "server-only";
import crypto from "node:crypto";
import { commit, db, now, reference, uid } from "./store";
import { corridorById, country, isTransactable, mask, normalizePhone, type PayoutMethod } from "./corridors";
import { providerFor } from "./providers";
import { appendEvent, overallLabel, transition } from "./stateMachine";
import { authToken, signWebhook, verifyAuthToken, verifyWebhook } from "./security";
import type { Quote, Recipient, Transaction, User } from "./types";

export class PaymentError extends Error {
  constructor(message: string, public status = 400, public code = "BAD_REQUEST") { super(message); }
}

// ── Quotes ─────────────────────────────────────────────────────────────
export async function createQuote(userId: string, corridorId: string, sourceAmountMinor: number, fundingMethod?: string): Promise<Quote> {
  const c = corridorById(corridorId);
  if (!c) throw new PaymentError("Unknown route.", 404, "UNKNOWN_ROUTE");
  if (c.status === "MAINTENANCE") throw new PaymentError("This route is under maintenance. Funding is paused.", 409, "MAINTENANCE");
  if (!isTransactable(c)) throw new PaymentError("We can't send money on this route yet.", 409, "UNSUPPORTED");
  if (!Number.isSafeInteger(sourceAmountMinor) || sourceAmountMinor <= 0) throw new PaymentError("Enter an amount greater than zero.");
  if (sourceAmountMinor < c.minMinor || sourceAmountMinor > c.maxMinor) throw new PaymentError("Amount is outside the limits for this route.", 422, "LIMIT");

  const r = await providerFor(c).quote(c, sourceAmountMinor, fundingMethod);
  const totalFees = r.fundingFeeMinor + r.conversionFeeMinor + r.networkFeeMinor + r.payoutFeeMinor + r.platformFeeMinor;
  const q: Quote = {
    id: uid("qt"),
    userId,
    corridorId: c.id,
    sourceCurrency: c.sourceCurrency,
    destinationCurrency: c.destinationCurrency,
    sourceAmountMinor,
    destinationAmountMinor: r.destinationAmountMinor,
    fxRate: r.fxRate.toString(),
    fundingFeeMinor: r.fundingFeeMinor,
    conversionFeeMinor: r.conversionFeeMinor,
    networkFeeMinor: r.networkFeeMinor,
    payoutFeeMinor: r.payoutFeeMinor,
    platformFeeMinor: r.platformFeeMinor,
    totalFeesMinor: totalFees,
    totalAmountMinor: sourceAmountMinor + totalFees,
    providerReference: r.providerReference,
    provider: r.provider,
    guaranteed: r.guaranteed,
    createdAt: now(),
    expiresAt: new Date(Date.now() + r.ttlSeconds * 1000).toISOString(),
    status: "ACTIVE",
    sandbox: c.status !== "LIVE",
  };
  db().quotes.push(q);
  commit();
  return q;
}

export function quoteExpired(q: Quote) {
  return q.status === "EXPIRED" || Date.parse(q.expiresAt) <= Date.now();
}

// ── Recipients ─────────────────────────────────────────────────────────
export interface RecipientInput {
  displayName: string;
  nickname?: string;
  destinationCountry: string;
  payoutMethod: PayoutMethod;
  provider: string;
  identifier: string;
  save?: boolean;
  /** Pay an existing saved recipient (full identifier stays server-side). */
  savedRecipientId?: string;
}

export function validateRecipient(input: RecipientInput): { fieldErrors: Record<string, string>; normalized?: string } {
  const fieldErrors: Record<string, string> = {};
  const c = country(input.destinationCountry);
  if (!c) fieldErrors.destinationCountry = "Choose a destination country.";
  if (!input.displayName || input.displayName.trim().length < 2) fieldErrors.displayName = "Enter the recipient's full name.";
  if (!input.provider) fieldErrors.provider = "Choose a provider.";
  let normalized: string | undefined;
  if (input.payoutMethod === "MOBILE_MONEY" && c) {
    const r = normalizePhone(input.identifier ?? "", c.code);
    if (r.ok) normalized = r.e164; else fieldErrors.identifier = r.error;
  } else if (input.payoutMethod === "BANK") {
    const digits = (input.identifier ?? "").replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 18) fieldErrors.identifier = "Account numbers are 8–18 digits.";
    else normalized = digits;
  } else fieldErrors.payoutMethod = "Choose how they'll receive money.";
  return { fieldErrors, normalized };
}

export function upsertRecipient(user: User, input: RecipientInput): Recipient {
  const { fieldErrors, normalized } = validateRecipient(input);
  if (Object.keys(fieldErrors).length || !normalized) throw Object.assign(new PaymentError("Check the recipient details.", 422, "INVALID_RECIPIENT"), { fieldErrors });
  const existing = db().recipients.find((r) => r.ownerId === user.id && r.destinationIdentifier === normalized && r.payoutMethod === input.payoutMethod);
  if (existing) {
    existing.displayName = input.displayName.trim();
    existing.nickname = input.nickname?.trim() || existing.nickname;
    existing.provider = input.provider;
    existing.saved = existing.saved || !!input.save;
    return existing;
  }
  const r: Recipient = {
    id: uid("rcp"),
    ownerId: user.id,
    displayName: input.displayName.trim(),
    nickname: input.nickname?.trim() || undefined,
    destinationCountry: input.destinationCountry,
    payoutMethod: input.payoutMethod,
    provider: input.provider,
    destinationIdentifier: normalized,
    maskedIdentifier: mask(normalized),
    verificationStatus: "UNVERIFIED",
    saved: !!input.save,
    createdAt: now(),
  };
  db().recipients.push(r);
  return r;
}

export const publicRecipient = ({ destinationIdentifier: _d, ...r }: Recipient) => r;

// ── Transactions ───────────────────────────────────────────────────────
function scenarioFor(identifier: string): Transaction["scenario"] {
  if (identifier.endsWith("0000")) return "PAYOUT_FAIL";
  if (identifier.endsWith("9999")) return "PAYOUT_UNKNOWN";
  return "HAPPY";
}

export function createTransfer(user: User, quoteId: string, recipientInput: RecipientInput, idempotencyKey: string) {
  if (!idempotencyKey || idempotencyKey.length < 8) throw new PaymentError("Missing idempotency key.");
  const existing = db().transactions.find((t) => t.userId === user.id && t.idempotencyKey === idempotencyKey);
  if (existing) return { tx: existing, token: authToken({ txId: existing.id, quoteId: existing.quoteId, recipientId: existing.recipientId, totalMinor: existing.totalAmountMinor, userId: user.id }), replay: true };

  const q = db().quotes.find((x) => x.id === quoteId);
  if (!q) throw new PaymentError("Quote not found.", 404);
  if (q.userId !== user.id && q.userId !== "anon") throw new PaymentError("Quote not found.", 404);
  if (quoteExpired(q)) { q.status = "EXPIRED"; commit(); throw new PaymentError("Your rate has expired. Refresh the quote to see the latest available price.", 409, "QUOTE_EXPIRED"); }
  if (q.status === "CONSUMED") throw new PaymentError("This quote was already used. Request a new quote.", 409, "QUOTE_USED");
  const c = corridorById(q.corridorId)!;
  if (!recipientInput.savedRecipientId) {
    if (recipientInput.destinationCountry !== c.destination) throw new PaymentError("Recipient country doesn't match this route.", 422);
    if (!c.payoutMethods.includes(recipientInput.payoutMethod)) throw new PaymentError("That payout method isn't available on this route.", 422);
  }

  let rcp: Recipient;
  if (recipientInput.savedRecipientId) {
    const saved = db().recipients.find((r) => r.id === recipientInput.savedRecipientId && r.ownerId === user.id);
    if (!saved) throw new PaymentError("Saved recipient not found.", 404);
    if (saved.destinationCountry !== c.destination || !c.payoutMethods.includes(saved.payoutMethod)) throw new PaymentError("This recipient can't be paid on this route.", 422);
    rcp = saved;
  } else {
    rcp = upsertRecipient(user, recipientInput);
  }
  q.userId = user.id;
  const tx: Transaction = {
    id: uid("tx"),
    reference: reference(),
    userId: user.id,
    quoteId: q.id,
    recipientId: rcp.id,
    corridorId: c.id,
    sourceCurrency: q.sourceCurrency,
    destinationCurrency: q.destinationCurrency,
    sourceAmountMinor: q.sourceAmountMinor,
    destinationAmountMinor: q.destinationAmountMinor,
    totalAmountMinor: q.totalAmountMinor,
    totalFeesMinor: q.totalFeesMinor,
    state: "DRAFT",
    fundingStatus: "NOT_STARTED",
    settlementStatus: c.settlement ? "NOT_STARTED" : "SKIPPED",
    payoutStatus: "NOT_STARTED",
    idempotencyKey,
    createdAt: now(),
    updatedAt: now(),
    sandbox: q.sandbox,
    scenario: scenarioFor(rcp.destinationIdentifier),
  };
  db().transactions.push(tx);
  appendEvent({ transactionId: tx.id, type: "transfer.created", source: "USER", toState: "DRAFT", payload: { quoteId: q.id, recipient: rcp.maskedIdentifier } });
  transition(tx, "AWAITING_AUTHORIZATION", "SYSTEM", "quote.attached", { quoteId: q.id, expiresAt: q.expiresAt });
  commit();
  return { tx, token: authToken({ txId: tx.id, quoteId: q.id, recipientId: rcp.id, totalMinor: tx.totalAmountMinor, userId: user.id }), replay: false };
}

export function authorize(user: User, txId: string, token: string) {
  const tx = ownTx(user, txId);
  if (tx.state !== "AWAITING_AUTHORIZATION") {
    if (tx.authorizedAt) return tx; // idempotent re-submit
    throw new PaymentError("This transfer can't be authorized in its current state.", 409);
  }
  const q = db().quotes.find((x) => x.id === tx.quoteId)!;
  if (quoteExpired(q)) {
    q.status = "EXPIRED";
    transition(tx, "QUOTE_EXPIRED", "SYSTEM", "quote.expired", {});
    commit();
    throw new PaymentError("Your rate has expired. Refresh the quote before paying.", 409, "QUOTE_EXPIRED");
  }
  const err = verifyAuthToken(token, { txId: tx.id, quoteId: tx.quoteId, recipientId: tx.recipientId, totalMinor: tx.totalAmountMinor, userId: user.id });
  if (err) throw new PaymentError(err, 403, "AUTH_INVALID");
  q.status = "CONSUMED";
  transition(tx, "AWAITING_FUNDING", "USER", "transfer.authorized", { totalMinor: tx.totalAmountMinor }, { authorizedAt: now() });
  commit();
  return tx;
}

export function startFunding(user: User, txId: string, method: string, idempotencyKey: string) {
  const tx = ownTx(user, txId);
  if (tx.fundingIdempotencyKey && tx.fundingIdempotencyKey === idempotencyKey) return { tx, checkoutUrl: `/checkout/${tx.id}` };
  if (tx.state === "FUNDING_PENDING") return { tx, checkoutUrl: `/checkout/${tx.id}` }; // never create a second charge
  if (tx.state !== "AWAITING_FUNDING") throw new PaymentError("Payment has already been started for this transfer.", 409, "ALREADY_FUNDING");
  const c = corridorById(tx.corridorId)!;
  if (!c.fundingMethods.includes(method)) throw new PaymentError("That payment method isn't available for this route.", 422);
  transition(tx, "FUNDING_PENDING", "USER", "funding.initiated", { method }, {
    fundingStatus: "PENDING",
    fundingIdempotencyKey: idempotencyKey,
    fundingReference: "pay_" + crypto.randomBytes(6).toString("hex"),
  });
  commit();
  return { tx, checkoutUrl: `/checkout/${tx.id}` };
}

function ownTx(user: User, txId: string) {
  const tx = db().transactions.find((t) => t.id === txId);
  if (!tx || tx.userId !== user.id) throw new PaymentError("Transfer not found.", 404, "NOT_FOUND");
  return tx;
}
export const getOwnTx = ownTx;

// ── Provider webhooks (verified, idempotent) ───────────────────────────
export interface ProviderEvent {
  id: string;
  type: "funding.succeeded" | "funding.failed" | "settlement.pending" | "settlement.confirmed" | "payout.pending" | "payout.succeeded" | "payout.failed" | "payout.unknown" | "refund.succeeded";
  transactionId: string;
  data?: Record<string, unknown>;
}

export function handleProviderWebhook(rawBody: string, ts: string | null, sig: string | null): { ok: boolean; status: number; message: string } {
  if (!verifyWebhook(rawBody, ts, sig)) return { ok: false, status: 401, message: "Invalid signature" };
  const ev = JSON.parse(rawBody) as ProviderEvent;
  const store = db();
  if (store.processedWebhooks.includes(ev.id)) return { ok: true, status: 200, message: "Duplicate ignored" };
  const tx = store.transactions.find((t) => t.id === ev.transactionId);
  if (!tx) return { ok: false, status: 404, message: "Unknown transaction" };
  store.processedWebhooks.push(ev.id);
  const c = corridorById(tx.corridorId)!;
  const P = "PROVIDER" as const;
  const at = (ms: number) => new Date(Date.now() + ms).toISOString();
  try {
    switch (ev.type) {
      case "funding.succeeded":
        if (tx.state !== "FUNDING_PENDING") break; // out-of-order / repeated: reconcile, never double-advance
        transition(tx, "FUNDED", P, ev.type, { fundingReference: tx.fundingReference }, { fundingStatus: "CONFIRMED", nextProviderEventAt: at(2500) });
        break;
      case "funding.failed":
        if (tx.state !== "FUNDING_PENDING") break;
        transition(tx, "FAILED", P, ev.type, ev.data ?? {}, { fundingStatus: "FAILED", nextProviderEventAt: undefined });
        break;
      case "settlement.pending":
        if (tx.state !== "FUNDED") break;
        transition(tx, "SETTLEMENT_PENDING", P, ev.type, { chain: c.settlement?.chain, asset: c.settlement?.stablecoin }, { settlementStatus: "PENDING", blockchainChain: c.settlement?.chain, nextProviderEventAt: at(3500) });
        break;
      case "settlement.confirmed":
        if (tx.state !== "SETTLEMENT_PENDING") break;
        transition(tx, "SETTLED", "CHAIN", ev.type, ev.data ?? {}, { settlementStatus: "CONFIRMED", blockchainTxHash: String(ev.data?.hash), blockchainSimulated: true, nextProviderEventAt: at(1500) });
        break;
      case "payout.pending":
        if (tx.state !== "SETTLED" && tx.state !== "FUNDED") break;
        transition(tx, "PAYOUT_PENDING", P, ev.type, {}, { payoutStatus: "PENDING", payoutReference: "po_" + crypto.randomBytes(5).toString("hex"), nextProviderEventAt: at(4500) });
        break;
      case "payout.succeeded":
        if (tx.state !== "PAYOUT_PENDING" && tx.state !== "MANUAL_REVIEW") break;
        transition(tx, "PAYOUT_CONFIRMED", P, ev.type, {}, { payoutStatus: "CONFIRMED", nextProviderEventAt: undefined });
        transition(tx, "COMPLETED", "SYSTEM", "transfer.completed", {});
        break;
      case "payout.failed":
        if (tx.state !== "PAYOUT_PENDING") break;
        transition(tx, "MANUAL_REVIEW", P, ev.type, { reason: "Recipient wallet rejected the payout." }, { payoutStatus: "FAILED", nextProviderEventAt: undefined, reviewNote: "Payout rejected after funding. Funds held; refund or re-route required." });
        break;
      case "payout.unknown":
        if (tx.state !== "PAYOUT_PENDING") break;
        // Unknown is NOT failure. Hold and reconcile.
        transition(tx, "MANUAL_REVIEW", P, ev.type, { reason: "Provider timed out; outcome unknown." }, { payoutStatus: "UNKNOWN", nextProviderEventAt: undefined, reviewNote: "Provider timeout. Reconcile against provider records before any retry." });
        break;
      case "refund.succeeded":
        if (tx.state !== "REFUND_PENDING") break;
        transition(tx, "REFUNDED", P, ev.type, {}, { nextProviderEventAt: undefined });
        break;
    }
  } catch (e) {
    appendEvent({ transactionId: tx.id, type: "reconciliation.flag", source: "SYSTEM", payload: { event: ev.type, error: String(e) } });
  }
  commit();
  return { ok: true, status: 200, message: "Processed" };
}

/** Sandbox-only: emits the provider's next webhook through the same verified handler. */
export function emitSandbox(type: ProviderEvent["type"], tx: Transaction, data?: Record<string, unknown>) {
  const body = JSON.stringify({ id: "sbx_evt_" + crypto.randomBytes(8).toString("hex"), type, transactionId: tx.id, data } satisfies ProviderEvent);
  const ts = Date.now();
  return handleProviderWebhook(body, String(ts), signWebhook(body, ts));
}

/** Drives the sandbox provider timeline when due (stands in for real async provider callbacks). */
export function advanceSandbox(tx: Transaction) {
  if (!tx.sandbox || !tx.nextProviderEventAt || Date.parse(tx.nextProviderEventAt) > Date.now()) return;
  const c = corridorById(tx.corridorId)!;
  switch (tx.state) {
    case "FUNDING_PENDING": emitSandbox("funding.succeeded", tx); break;
    case "FUNDED": emitSandbox(c.settlement ? "settlement.pending" : "payout.pending", tx); break;
    case "SETTLEMENT_PENDING": emitSandbox("settlement.confirmed", tx, { hash: "0x" + crypto.randomBytes(32).toString("hex") }); break;
    case "SETTLED": emitSandbox("payout.pending", tx); break;
    case "PAYOUT_PENDING":
      emitSandbox(tx.scenario === "PAYOUT_FAIL" ? "payout.failed" : tx.scenario === "PAYOUT_UNKNOWN" ? "payout.unknown" : "payout.succeeded", tx);
      break;
    case "REFUND_PENDING": emitSandbox("refund.succeeded", tx); break;
  }
}

export function sandboxCheckout(txId: string, approve: boolean) {
  const tx = db().transactions.find((t) => t.id === txId);
  if (!tx) throw new PaymentError("Checkout session not found.", 404);
  if (tx.state !== "FUNDING_PENDING") return tx;
  if (approve) {
    tx.nextProviderEventAt = new Date(Date.now() + 3000).toISOString(); // provider confirms asynchronously
    appendEvent({ transactionId: tx.id, type: "checkout.returned", source: "USER", payload: { note: "Browser return is not proof of funding; awaiting provider webhook." } });
  } else {
    emitSandbox("funding.failed", tx, { reason: "Payment declined at checkout." });
  }
  commit();
  return tx;
}

// ── Ops ────────────────────────────────────────────────────────────────
export function opsAction(txId: string, action: "retry_payout" | "confirm_payout" | "refund" | "flag", note: string, actor: string) {
  const tx = db().transactions.find((t) => t.id === txId);
  if (!tx) throw new PaymentError("Not found", 404);
  if (!note || note.trim().length < 4) throw new PaymentError("A review note is required for every ops action.");
  const at = (ms: number) => new Date(Date.now() + ms).toISOString();
  const p = { note, actor };
  switch (action) {
    case "flag":
      if (tx.state === "MANUAL_REVIEW") throw new PaymentError("Already in review.");
      transition(tx, "MANUAL_REVIEW", "OPS", "ops.flagged", p, { reviewNote: note, nextProviderEventAt: undefined });
      break;
    case "retry_payout":
      if (tx.payoutStatus === "UNKNOWN") throw new PaymentError("Payout outcome is unknown. Reconcile with the provider before retrying.", 409);
      transition(tx, "PAYOUT_PENDING", "OPS", "ops.payout_retry", p, { payoutStatus: "PENDING", scenario: "HAPPY", nextProviderEventAt: at(4000) });
      break;
    case "confirm_payout":
      transition(tx, "PAYOUT_CONFIRMED", "OPS", "ops.payout_reconciled", p, { payoutStatus: "CONFIRMED" });
      transition(tx, "COMPLETED", "SYSTEM", "transfer.completed", {});
      break;
    case "refund":
      transition(tx, "REFUND_PENDING", "OPS", "ops.refund_initiated", p, { nextProviderEventAt: at(5000) });
      break;
  }
  commit();
  return tx;
}

// ── Serialisation ──────────────────────────────────────────────────────
export function publicTx(tx: Transaction) {
  const rcp = db().recipients.find((r) => r.id === tx.recipientId);
  const q = db().quotes.find((x) => x.id === tx.quoteId);
  const events = db().events.filter((e) => e.transactionId === tx.id).map(({ payload: _p, ...e }) => e);
  const { scenario: _s, idempotencyKey: _i, fundingIdempotencyKey: _f, ...rest } = tx;
  return { ...rest, status: overallLabel(tx), recipient: rcp ? publicRecipient(rcp) : null, quote: q ?? null, corridor: corridorById(tx.corridorId) ? { ...corridorById(tx.corridorId)!, midRate: undefined } : null, events };
}
export type PublicTx = ReturnType<typeof publicTx>;
