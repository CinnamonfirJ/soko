import { opsAction, publicTx } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { isOps } from "@/lib/security";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isOps(req)) return ok({ error: "Ops access required." }, 403);
  try {
    const b = await body<{ action: "retry_payout" | "confirm_payout" | "refund" | "flag"; note: string }>(req);
    const tx = opsAction((await ctx.params).id, b.action, b.note, "ops-console");
    return ok({ transaction: publicTx(tx) });
  } catch (e) { return fail(e); }
}
