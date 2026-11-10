import { sandboxCheckout } from "@/lib/engine";
import { body, fail, ok, requireUser } from "@/lib/http";
import { db } from "@/lib/store";
import { formatMinor } from "@/lib/money";

// Stands in for a regulated provider's hosted checkout. Never touches real money.
export async function GET(req: Request) {
  try {
    const u = await requireUser();
    const id = new URL(req.url).searchParams.get("tx") ?? "";
    const tx = db().transactions.find((t) => t.id === id && t.userId === u.id);
    if (!tx) return ok({ error: "Checkout session not found." }, 404);
    return ok({ id: tx.id, reference: tx.reference, state: tx.state, amount: formatMinor(tx.totalAmountMinor, tx.sourceCurrency), fundingReference: tx.fundingReference });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const b = await body<{ tx: string; approve: boolean }>(req);
    const tx = db().transactions.find((t) => t.id === b.tx && t.userId === u.id);
    if (!tx) return ok({ error: "Checkout session not found." }, 404);
    sandboxCheckout(tx.id, !!b.approve);
    return ok({ returnUrl: `/app/transfers/${tx.id}` });
  } catch (e) { return fail(e); }
}
