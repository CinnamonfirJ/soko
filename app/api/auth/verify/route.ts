import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { body } from "@/lib/http";

const MESSAGES: Record<string, string> = {
  OTP_EXPIRED: "That code has expired. Request a new one.",
  OTP_NOT_FOUND: "That code has expired. Request a new one.",
  INVALID_OTP: "That code isn't right. Check it and try again.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Request a new code.",
};

// Step 2: verify the code. On first sign-in Better Auth creates the user (phone-only sign-up), then sets the
// session cookie. We return Better Auth's response so its Set-Cookie headers reach the browser.
export async function POST(req: Request) {
  let b: { phone: string; code: string };
  try { b = await body(req); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const res = await auth.api.verifyPhoneNumber({
    body: { phoneNumber: String(b.phone ?? ""), code: String(b.code ?? "") },
    headers: req.headers,
    asResponse: true,
  });
  if (res.ok) {
    const data = (await res.json()) as { user?: { id: string; phoneNumber?: string } };
    const out = NextResponse.json({ user: { id: data.user?.id, phone: data.user?.phoneNumber } });
    res.headers.getSetCookie().forEach((c) => out.headers.append("set-cookie", c));
    return out;
  }
  const err = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  return NextResponse.json({ error: MESSAGES[err.code ?? ""] ?? err.message ?? "We couldn't verify that code.", code: err.code }, { status: res.status === 403 ? 429 : 401 });
}
