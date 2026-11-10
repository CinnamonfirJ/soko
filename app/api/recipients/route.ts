import { db, commit } from "@/lib/store";
import { body, fail, ok, requireUser } from "@/lib/http";
import { publicRecipient, upsertRecipient, validateRecipient, type RecipientInput } from "@/lib/engine";

export async function GET() {
  try {
    const u = await requireUser();
    const list = db().recipients.filter((r) => r.ownerId === u.id && r.saved);
    return ok({ recipients: list.map(publicRecipient) });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const b = await body<RecipientInput & { validateOnly?: boolean }>(req);
    if (b.validateOnly) {
      const v = validateRecipient(b);
      const valid = Object.keys(v.fieldErrors).length === 0;
      return ok({ fieldErrors: v.fieldErrors, valid, masked: valid && v.normalized ? v.normalized.slice(0, 4) + " •••• " + v.normalized.slice(-4) : undefined }, valid ? 200 : 422);
    }
    const u = await requireUser();
    if (b.savedRecipientId) {
      const existing = db().recipients.find((x) => x.id === b.savedRecipientId && x.ownerId === u.id);
      if (!existing) return ok({ error: "Not found" }, 404);
      existing.saved = true;
      commit();
      return ok({ recipient: publicRecipient(existing) });
    }
    const r = upsertRecipient(u, { ...b, save: true });
    commit();
    return ok({ recipient: publicRecipient(r) }, 201);
  } catch (e) { return fail(e); }
}

export async function DELETE(req: Request) {
  try {
    const u = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    const r = db().recipients.find((x) => x.id === id && x.ownerId === u.id);
    if (!r) return ok({ error: "Not found" }, 404);
    r.saved = false; // record stays for transaction history; only removed from the saved list
    commit();
    return ok({ ok: true });
  } catch (e) { return fail(e); }
}
