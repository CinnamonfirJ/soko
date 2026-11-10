import { db } from "@/lib/store";
import { ok } from "@/lib/http";
import { isOps } from "@/lib/security";
import { advanceSandbox, publicTx } from "@/lib/engine";

export async function GET(req: Request) {
  if (!isOps(req)) return ok({ error: "Ops access required." }, 403);
  const s = db();
  s.transactions.forEach(advanceSandbox);
  const q = new URL(req.url).searchParams.get("q")?.toUpperCase().trim();
  const txs = s.transactions
    .filter((t) => !q || t.reference.includes(q) || t.id.toUpperCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = (f: (t: (typeof txs)[number]) => boolean) => s.transactions.filter(f).length;
  return ok({
    summary: {
      active: count((t) => !["COMPLETED", "FAILED", "REFUNDED", "MANUAL_REVIEW"].includes(t.state)),
      pending: count((t) => ["FUNDING_PENDING", "SETTLEMENT_PENDING", "PAYOUT_PENDING"].includes(t.state)),
      failed: count((t) => t.state === "FAILED"),
      review: count((t) => t.state === "MANUAL_REVIEW"),
      completed: count((t) => t.state === "COMPLETED"),
    },
    transactions: txs.map((t) => ({
      ...publicTx(t),
      userPhone: s.users.find((u) => u.id === t.userId)?.phone.replace(/\d(?=\d{3})/g, "•"),
      scenario: t.scenario,
      events: s.events.filter((e) => e.transactionId === t.id),
    })),
    support: s.support,
  });
}
