"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { COUNTRIES } from "@/lib/corridors";
import { Aurora, ParticleGlobe } from "@/components/fx";
import { Field, Flag, Logo } from "@/components/ui";

function SignIn() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  const [countryCode, setCountry] = useState("NG");
  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [autoCode, setAutoCode] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "autofill">("autofill");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const c = COUNTRIES.find((x) => x.code === countryCode)!;

  // Code autofill (like SMS one-time-code autofill on phones): fills the boxes, then verifies.
  useEffect(() => {
    if (!autoCode || !e164) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setCode(autoCode.slice(0, i).split("").concat(Array(6 - i).fill("")));
      if (i >= 6) { clearInterval(t); setTimeout(() => verify(autoCode), 350); }
    }, 110);
    const start = setTimeout(() => {}, 0);
    return () => { clearInterval(t); clearTimeout(start); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCode, e164]);

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  async function requestCode(ev?: React.FormEvent) {
    ev?.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api<{ phone: string; autofillCode?: string; channel: "whatsapp" | "autofill" }>("/api/auth/otp", { method: "POST", json: { phone: c.dial + phone.replace(/^0/, ""), country: countryCode } });
      setE164(r.phone); setChannel(r.channel); setAutoCode(r.autofillCode ?? ""); setCooldown(30); setCode(["", "", "", "", "", ""]);
      setTimeout(() => refs.current[0]?.focus(), 100);
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  }

  async function verify(full: string) {
    setBusy(true); setErr(null);
    try {
      await api("/api/auth/verify", { method: "POST", json: { phone: e164, code: full, country: countryCode } });
      router.push(safeNext);
    } catch (e) { setErr((e as ApiError).message); setCode(["", "", "", "", "", ""]); refs.current[0]?.focus(); setBusy(false); }
  }

  function onDigit(i: number, v: string) {
    const digits = v.replace(/\D/g, "");
    if (digits.length > 1) { // paste
      const arr = digits.slice(0, 6).split("");
      const nc = [...code]; arr.forEach((d, k) => { nc[k] = d; });
      setCode(nc);
      if (nc.every(Boolean)) verify(nc.join("")); else refs.current[arr.length]?.focus();
      return;
    }
    const nc = [...code]; nc[i] = digits; setCode(nc);
    if (digits && i < 5) refs.current[i + 1]?.focus();
    if (nc.every(Boolean)) verify(nc.join(""));
  }

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-2">
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><Aurora /></div>
      <section className="relative z-10 flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <button onClick={() => (e164 ? setE164("") : router.back())} className="grid h-10 w-10 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <Logo />
          <span className="w-10" />
        </div>
        <div className="mx-auto mt-14 w-full max-w-sm flex-1">
          <AnimatePresence mode="wait">
            {!e164 ? (
              <motion.form key="phone" onSubmit={requestCode} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <h1 className="display text-[34px] leading-tight">Let's get you <span className="serif-accent text-gradient-coral">set up.</span></h1>
                <p className="mt-2 text-ink-2">We'll send a one-time code to your WhatsApp to confirm it's you. Your transfer details are kept while you sign in.</p>
                <div className="mt-8 space-y-4">
                  <Field id="country" label="Country">
                    <div className="relative">
                      <Flag code={countryCode} size={22} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <select id="country" className="input appearance-none !pl-12" value={countryCode} onChange={(e) => setCountry(e.target.value)}>
                        {COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.dial})</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                    </div>
                  </Field>
                  <Field id="phone" label="Phone number" error={err ?? undefined}>
                    <div className="flex gap-2">
                      <span className="input !w-auto shrink-0 grid place-items-center !px-3 text-ink-2">{c.dial}</span>
                      <input id="phone" className="input tabular" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="801 234 5678" aria-invalid={!!err} required />
                    </div>
                  </Field>
                </div>
                <button disabled={busy || !phone} className="btn btn-primary mt-6 w-full">{busy ? "Sending…" : "Continue"} <ArrowRight className="h-4 w-4" /></button>
                <p className="mt-4 flex gap-2 text-[12px] text-ink-3"><ShieldCheck className="h-4 w-4 shrink-0" />Signing in confirms your phone number. Identity checks for larger transfers are separate and handled by our payment partners.</p>
              </motion.form>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <h1 className="display text-[34px] leading-tight">Enter the <span className="serif-accent text-gradient-coral">code</span></h1>
                <p className="mt-2 text-ink-2">{channel === "whatsapp" ? "We sent it to WhatsApp on " : "Sent to "}<span className="tabular text-ink">{e164}</span>.</p>
                <div className="mt-6 flex justify-between gap-2" role="group" aria-label="One-time code">
                  {code.map((v, i) => (
                    <input key={i} ref={(el) => { refs.current[i] = el; }} value={v} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6}
                      aria-label={`Digit ${i + 1}`} onChange={(e) => onDigit(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Backspace" && !v && i > 0) refs.current[i - 1]?.focus(); }}
                      className="display tabular h-14 w-full min-w-0 rounded-xl border border-line bg-canvas/60 text-center text-2xl outline-none transition focus:border-azure-soft focus:shadow-[0_0_0_4px_rgba(0,70,222,.25)]" />
                  ))}
                </div>
                {err && <p role="alert" className="mt-3 text-[13px] text-err">{err}</p>}
                <div className="mt-6 flex items-center justify-between text-sm">
                  <button onClick={() => setE164("")} className="text-ink-3 hover:text-ink">Change number</button>
                  <button onClick={() => requestCode()} disabled={cooldown > 0 || busy} className="font-semibold text-coral disabled:text-ink-3">{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="mx-auto mt-10 max-w-sm text-center text-[12px] text-ink-3">By continuing you agree to our <Link href="/app/support#terms" className="underline">Terms</Link> and <Link href="/app/support#privacy" className="underline">Privacy policy</Link>.</p>
      </section>
      <section className="relative hidden items-center justify-center overflow-hidden border-l border-white/5 lg:flex">
        <div className="w-[80%] max-w-[520px]"><ParticleGlobe size={520} /></div>
        <div className="absolute bottom-12 left-12 right-12">
          <p className="display text-3xl leading-tight">Every step <span className="serif-accent text-coral">confirmed</span>, before we call it done.</p>
        </div>
      </section>
    </main>
  );
}

export default function Page() { return <Suspense><SignIn /></Suspense>; }
