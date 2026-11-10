import { db, commit, uid, now } from "@/lib/store";
import { body, fail, ok } from "@/lib/http";
import { safeEqual, setSession } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const b = await body<{ phone: string; code: string; country: string }>(req);
    const s = db();
    const o = s.otps.find((x) => x.phone === b.phone);
    if (!o || Date.parse(o.expiresAt) < Date.now()) return ok({ error: "That code has expired. Request a new one." }, 410);
    if (o.attempts >= 5) return ok({ error: "Too many attempts. Request a new code." }, 429);
    o.attempts++;
    if (!safeEqual(String(b.code ?? ""), o.code)) { commit(); return ok({ error: `That code isn't right. ${5 - o.attempts} attempts left.`, attemptsLeft: 5 - o.attempts }, 401); }
    s.otps = s.otps.filter((x) => x !== o);
    let u = s.users.find((x) => x.phone === b.phone);
    if (!u) { u = { id: uid("usr"), phone: b.phone, country: b.country, verificationStatus: "PHONE_VERIFIED", createdAt: now() }; s.users.push(u); }
    commit();
    await setSession(u.id);
    return ok({ user: u });
  } catch (e) { return fail(e); }
}
