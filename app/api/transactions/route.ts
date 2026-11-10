import { createTransfer, publicTx, advanceSandbox, type RecipientInput } from "@/lib/engine";
import { db } from "@/lib/store";
import { body, fail, ok, requireUser } from "@/lib/http";
import { velocityOk } from "@/lib/security";

export async function GET() {
  try {
    const u = await requireUser();
    const txs = db().transactions.filter((t) => t.userId === u.id);
    txs.forEach(advanceSandbox);
    return ok({ transactions: txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicTx) });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    if (!velocityOk("tx:" + u.id, 10, 10 * 60_000)) return ok({ error: "You've started several transfers quickly. Please wait a few minutes." }, 429);
    const b = await body<{ quoteId: string; recipient: RecipientInput; idempotencyKey: string }>(req);
    const { tx, token, replay } = createTransfer(u, b.quoteId, b.recipient, b.idempotencyKey);
    return ok({ transaction: publicTx(tx), authorizationToken: token, replay }, replay ? 200 : 201);
  } catch (e) { return fail(e); }
}
