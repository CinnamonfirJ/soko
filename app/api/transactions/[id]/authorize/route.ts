import { authorize, publicTx } from "@/lib/engine";
import { body, fail, ok, requireUser } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const b = await body<{ authorizationToken: string; confirm: boolean }>(req);
    if (b.confirm !== true) return ok({ error: "Explicit confirmation is required." }, 422);
    const tx = authorize(u, (await ctx.params).id, String(b.authorizationToken ?? ""));
    return ok({ transaction: publicTx(tx) });
  } catch (e) { return fail(e); }
}
