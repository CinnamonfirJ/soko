import { createQuote } from "@/lib/engine";
import { body, fail, ok } from "@/lib/http";
import { currentUser, velocityOk } from "@/lib/security";
import { parseToMinor } from "@/lib/money";
import { corridorById } from "@/lib/corridors";

export async function POST(req: Request) {
  try {
    const b = await body<{ corridorId: string; amount: string; fundingMethod?: string }>(req);
    const user = await currentUser();
    const key = user?.id ?? req.headers.get("x-forwarded-for") ?? "anon";
    if (!velocityOk("quote:" + key, 30, 60_000)) return ok({ error: "Too many quote requests. Wait a moment and try again." }, 429);
    const c = corridorById(b.corridorId);
    if (!c) return ok({ error: "Unknown route." }, 404);
    const minor = parseToMinor(String(b.amount ?? ""), c.sourceCurrency);
    if (minor === null) return ok({ error: "Enter a valid amount.", fieldErrors: { amount: "Enter a valid amount." } }, 422);
    const q = await createQuote(user?.id ?? "anon", c.id, minor, b.fundingMethod);
    return ok({ quote: q });
  } catch (e) { return fail(e); }
}
