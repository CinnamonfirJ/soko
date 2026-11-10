import { ok } from "@/lib/http";
import { clearSession } from "@/lib/security";
export async function POST() { await clearSession(); return ok({ ok: true }); }
