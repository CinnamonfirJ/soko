import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { body, fail, ok } from "@/lib/http";
import { normalizePhone } from "@/lib/corridors";
import { velocityOk } from "@/lib/security";
import { otpChannel, takeAutofillCode } from "@/lib/otp-delivery";

// Step 1 of phone sign-in: validate the number for its country, then ask Better Auth to issue a code.
// Better Auth stores the code in Postgres (`verification`) and calls our delivery hook (WhatsApp or autofill).
export async function POST(req: Request) {
  try {
    const b = await body<{ phone: string; country: string }>(req);
    const n = normalizePhone(b.phone ?? "", b.country ?? "");
    if (!n.ok) return ok({ error: n.error, fieldErrors: { phone: n.error } }, 422);
    if (!velocityOk("otp:" + n.e164, 5, 10 * 60_000)) return ok({ error: "Too many codes requested. Try again in a few minutes." }, 429);
    try {
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: n.e164 }, headers: req.headers });
    } catch (e) {
      console.error("send-otp failed", e);
      return NextResponse.json({ error: "We couldn't send your code. Please try again." }, { status: 502 });
    }
    const channel = otpChannel();
    return ok({ phone: n.e164, channel, autofillCode: takeAutofillCode(n.e164), expiresInSeconds: 300 });
  } catch (e) { return fail(e); }
}
