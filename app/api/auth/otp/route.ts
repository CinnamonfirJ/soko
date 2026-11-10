import crypto from "node:crypto";
import { db, commit } from "@/lib/store";
import { body, fail, ok } from "@/lib/http";
import { normalizePhone } from "@/lib/corridors";
import { velocityOk } from "@/lib/security";

// Sandbox OTP: no SMS provider is connected, so the code is returned to the client
// and labelled as a demo code. Replace with an SMS/WhatsApp OTP provider for production.
export async function POST(req: Request) {
  try {
    const b = await body<{ phone: string; country: string }>(req);
    const n = normalizePhone(b.phone ?? "", b.country ?? "");
    if (!n.ok) return ok({ error: n.error, fieldErrors: { phone: n.error } }, 422);
    if (!velocityOk("otp:" + n.e164, 5, 10 * 60_000)) return ok({ error: "Too many codes requested. Try again in a few minutes." }, 429);
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const s = db();
    s.otps = s.otps.filter((o) => o.phone !== n.e164);
    s.otps.push({ phone: n.e164, code, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), attempts: 0 });
    commit();
    return ok({ phone: n.e164, autofillCode: code, expiresInSeconds: 300 });
  } catch (e) { return fail(e); }
}
