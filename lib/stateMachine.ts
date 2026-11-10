import "server-only";
import type { Transaction, TxEvent, TxState } from "./types";
import { db, now, uid } from "./store";

// Allowed transitions (PRD §10). Anything not listed is rejected.
const T: Record<TxState, TxState[]> = {
  DRAFT: ["QUOTE_REQUESTED", "AWAITING_AUTHORIZATION"],
  QUOTE_REQUESTED: ["QUOTE_READY", "FAILED"],
  QUOTE_READY: ["AWAITING_AUTHORIZATION", "QUOTE_EXPIRED"],
  QUOTE_EXPIRED: ["QUOTE_REQUESTED"],
  AWAITING_AUTHORIZATION: ["AWAITING_FUNDING", "QUOTE_EXPIRED", "FAILED"],
  AWAITING_FUNDING: ["FUNDING_PENDING", "FAILED", "QUOTE_EXPIRED"],
  FUNDING_PENDING: ["FUNDED", "FAILED", "MANUAL_REVIEW"],
  FUNDED: ["SETTLEMENT_PENDING", "PAYOUT_PENDING", "MANUAL_REVIEW", "REFUND_PENDING"],
  SETTLEMENT_PENDING: ["SETTLED", "MANUAL_REVIEW"],
  SETTLED: ["PAYOUT_PENDING", "MANUAL_REVIEW"],
  PAYOUT_PENDING: ["PAYOUT_CONFIRMED", "MANUAL_REVIEW", "FAILED"],
  PAYOUT_CONFIRMED: ["COMPLETED"],
  COMPLETED: [],
  FAILED: ["REFUND_PENDING", "MANUAL_REVIEW"],
  MANUAL_REVIEW: ["PAYOUT_PENDING", "PAYOUT_CONFIRMED", "REFUND_PENDING", "FAILED"],
  REFUND_PENDING: ["REFUNDED", "MANUAL_REVIEW"],
  REFUNDED: [],
};

export class TransitionError extends Error {}

export function canTransition(from: TxState, to: TxState) {
  return T[from].includes(to);
}

export function appendEvent(e: Omit<TxEvent, "id" | "createdAt">): TxEvent {
  const ev: TxEvent = { ...e, id: uid("evt"), createdAt: now() };
  db().events.push(ev); // append-only audit log
  return ev;
}

export function transition(
  tx: Transaction,
  to: TxState,
  source: TxEvent["source"],
  type: string,
  payload: Record<string, unknown> = {},
  patch: Partial<Transaction> = {}
) {
  if (!canTransition(tx.state, to)) throw new TransitionError(`Illegal transition ${tx.state} → ${to}`);
  const from = tx.state;
  Object.assign(tx, patch, { state: to, updatedAt: now() });
  if (to === "COMPLETED") tx.completedAt = now();
  appendEvent({ transactionId: tx.id, type, source, fromState: from, toState: to, payload });
}

export const TERMINAL: TxState[] = ["COMPLETED", "REFUNDED"];

/** User-facing view of the state — never claims delivery before payout confirmation. */
export function overallLabel(tx: Transaction): { tone: "ok" | "warn" | "err" | "info"; label: string } {
  switch (tx.state) {
    case "COMPLETED": return { tone: "ok", label: "Money delivered" };
    case "AWAITING_AUTHORIZATION": return { tone: "info", label: "Awaiting your confirmation" };
    case "AWAITING_FUNDING": return { tone: "info", label: "Awaiting payment" };
    case "FUNDING_PENDING": return { tone: "info", label: "Confirming your payment" };
    case "FUNDED": case "SETTLEMENT_PENDING": case "SETTLED": return { tone: "info", label: "Transfer processing" };
    case "PAYOUT_PENDING": return { tone: "info", label: "Paying recipient" };
    case "PAYOUT_CONFIRMED": return { tone: "ok", label: "Payout confirmed" };
    case "MANUAL_REVIEW": return { tone: "warn", label: "Needs attention" };
    case "FAILED": return { tone: "err", label: "Not completed" };
    case "REFUND_PENDING": return { tone: "warn", label: "Refund pending" };
    case "REFUNDED": return { tone: "info", label: "Refunded" };
    case "QUOTE_EXPIRED": return { tone: "warn", label: "Quote expired" };
    default: return { tone: "info", label: "Draft" };
  }
}
