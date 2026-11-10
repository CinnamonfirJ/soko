import { publicTx, startFunding } from "@/lib/engine";
import { body, fail, ok, requireUser } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const b = await body<{ method: string; idempotencyKey: string }>(req);
    const { tx, checkoutUrl } = startFunding(u, (await ctx.params).id, b.method, b.idempotencyKey);
    return ok({ transaction: publicTx(tx), checkoutUrl });
  } catch (e) { return fail(e); }
}
