import { db, commit, uid, now } from "@/lib/store";
import { body, fail, ok, requireUser } from "@/lib/http";
import { appendEvent } from "@/lib/stateMachine";

export async function GET() {
  try { const u = await requireUser(); return ok({ cases: db().support.filter((s) => s.userId === u.id) }); } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const b = await body<{ transactionId?: string; category: string; message: string }>(req);
    if (!b.message || b.message.trim().length < 5) return ok({ error: "Tell us a little more so we can help.", fieldErrors: { message: "Tell us a little more." } }, 422);
    const tx = b.transactionId ? db().transactions.find((t) => t.id === b.transactionId && t.userId === u.id) : undefined;
    const c = { id: uid("sup"), transactionId: tx?.id, userId: u.id, category: b.category || "Other", message: b.message.slice(0, 2000), status: "OPEN" as const, createdAt: now() };
    db().support.push(c);
    if (tx) appendEvent({ transactionId: tx.id, type: "support.case_opened", source: "USER", payload: { caseId: c.id } });
    commit();
    return ok({ case: c }, 201);
  } catch (e) { return fail(e); }
}
