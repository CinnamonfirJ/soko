import { advanceSandbox, getOwnTx, publicTx } from "@/lib/engine";
import { fail, ok, requireUser } from "@/lib/http";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const tx = getOwnTx(u, (await ctx.params).id);
    advanceSandbox(tx); // applies only provider events that are already due
    return ok({ transaction: publicTx(tx), serverTime: new Date().toISOString() });
  } catch (e) { return fail(e); }
}
