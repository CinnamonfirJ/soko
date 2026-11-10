import "server-only";

// Delivers sign-in codes. WhatsApp (via WATI) when an approved AUTHENTICATION template is configured;
// otherwise the code is held briefly so the sign-in screen can autofill it.
//
// WATI: set WATI_API_KEY, WATI_API_URL (e.g. https://live-mt-server.wati.io/<tenantId>) and
// SOKO_WATI_OTP_TEMPLATE (an approved Authentication template whose body has the code as {{1}}).

const WATI_KEY = process.env.WATI_API_KEY;
const WATI_URL = process.env.WATI_API_URL;
const WATI_TEMPLATE = process.env.SOKO_WATI_OTP_TEMPLATE;

export type OtpChannel = "whatsapp" | "autofill";
export const otpChannel = (): OtpChannel => (WATI_KEY && WATI_URL && WATI_TEMPLATE ? "whatsapp" : "autofill");

const g = globalThis as unknown as { __otpAutofill?: Map<string, { code: string; exp: number }> };
const autofill = () => (g.__otpAutofill ??= new Map());

export async function deliverOtp(phoneNumber: string, code: string) {
  if (otpChannel() === "whatsapp") {
    const url = `${WATI_URL!.replace(/\/$/, "")}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(phoneNumber.replace(/^\+/, ""))}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${WATI_KEY!.replace(/^Bearer\s+/i, "")}` },
      body: JSON.stringify({ template_name: WATI_TEMPLATE, broadcast_name: "soko_login_otp", parameters: [{ name: "1", value: code }] }),
    });
    const body = (await res.json().catch(() => ({}))) as { result?: boolean; info?: string };
    if (!res.ok || body.result === false) throw new Error(`WhatsApp delivery failed (${res.status}${body.info ? `: ${body.info}` : ""})`);
    return;
  }
  autofill().set(phoneNumber, { code, exp: Date.now() + 5 * 60_000 });
}

/** One-time read of the autofill code for the sign-in screen. Never available in WhatsApp mode. */
export function takeAutofillCode(phoneNumber: string): string | undefined {
  if (otpChannel() !== "autofill") return undefined;
  const v = autofill().get(phoneNumber);
  autofill().delete(phoneNumber);
  return v && v.exp > Date.now() ? v.code : undefined;
}
