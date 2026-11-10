"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, ArrowLeft, ArrowRight, Bot, Building2, MessageCircle, ChevronDown, Clock, Info, Lock, MapPinOff, RefreshCw, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { api, ApiError, clearDraft, loadDraft, newKey, saveDraft, type TransferDraft } from "@/lib/client";
import { CORRIDORS, country, findCorridor, isTransactable, sourceCountries } from "@/lib/corridors";
import { CURRENCIES, formatMinor, formatRate, parseToMinor } from "@/lib/money";
import type { Quote } from "@/lib/types";
import { CountrySheet } from "@/components/CountrySheet";
import { Banner, Field, Flag, Row, Steps } from "@/components/ui";
import { CountUp, Sparkle } from "@/components/fx";

const LABELS = ["Route & amount", "Recipient", "Quote", "Review"];
const slide = { initial: { opacity: 0, x: 40, filter: "blur(4px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: -40, filter: "blur(4px)" }, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } };

export default function SendPage() {
  const router = useRouter();
  const [d, setD] = useState<TransferDraft>({});
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<null | "source" | "destination">(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<ApiError | null>(null);
  const [user, setUser] = useState<{ id: string; country: string } | null | undefined>(undefined);
  const [waErr, setWaErr] = useState<string | null>(null);

  useEffect(() => {
    let draft = loadDraft();
    // Opened from a WhatsApp link: load the signed draft, then drop the token from the URL.
    const wa = new URLSearchParams(window.location.search).get("wa");
    const waDraft = wa
      ? api<{ draft: TransferDraft }>(`/api/drafts/whatsapp?t=${encodeURIComponent(wa)}`).then((r) => r.draft).catch((e) => { setWaErr((e as Error).message); return null; })
      : Promise.resolve(null);
    if (wa) window.history.replaceState(null, "", "/app/send");
    waDraft.then((w) => { if (w) { draft = { ...w, idempotencyKey: newKey() }; saveDraft(draft); } }).then(() => api<{ user: { id: string; country: string } | null }>("/api/auth/me")).then((r) => {
      setUser(r.user);
      setD({ source: r.user?.country && sourceCountries().some((c) => c.code === r.user!.country) ? r.user.country : "NG", step: 1, fundingMethod: undefined, ...draft, idempotencyKey: draft.idempotencyKey ?? newKey() });
      setReady(true);
    }).catch(() => { setUser(null); setD({ source: "NG", step: 1, ...draft, idempotencyKey: draft.idempotencyKey ?? newKey() }); setReady(true); });
  }, []);
  useEffect(() => { if (ready) saveDraft(d); }, [d, ready]);

  const update = (p: Partial<TransferDraft>) => setD((x) => ({ ...x, ...p }));
  const step = d.step ?? 1;
  const go = (s: number) => { setErrors({}); setSubmitErr(null); update({ step: s }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const src = country(d.source ?? "");
  const dst = country(d.destination ?? "");
  const corridor = d.source && d.destination ? findCorridor(d.source, d.destination) : undefined;
  const transactable = isTransactable(corridor);
  const minor = src && d.amount ? parseToMinor(d.amount, src.currency) : null;

  // ── Quote (step 3) ──
  const fetchQuote = useCallback(async () => {
    if (!corridor || !d.amount) return;
    setQuoting(true); setQuoteErr(null);
    try {
      const r = await api<{ quote: Quote }>("/api/quotes", { method: "POST", json: { corridorId: corridor.id, amount: d.amount, fundingMethod: d.fundingMethod } });
      setQuote(r.quote);
    } catch (e) { setQuoteErr((e as Error).message); setQuote(null); } finally { setQuoting(false); }
  }, [corridor, d.amount, d.fundingMethod]);
  useEffect(() => { if (step >= 3 && ready && (!quote || quote.corridorId !== corridor?.id || quote.sourceAmountMinor !== minor)) fetchQuote(); }, [step, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // Any change to route/amount/method invalidates the quote.
  useEffect(() => { setQuote(null); }, [d.source, d.destination, d.amount, d.fundingMethod]);

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secsLeft = quote ? Math.max(0, Math.floor((Date.parse(quote.expiresAt) - nowTs) / 1000)) : 0;
  const expired = !!quote && secsLeft <= 0;

  // ── Step 1 validation ──
  function continue1() {
    const e: Record<string, string> = {};
    if (!d.destination) e.destination = "Choose where the money is going.";
    if (!corridor || !transactable) e.route = "route";
    if (minor === null || minor <= 0) e.amount = "Enter an amount greater than zero.";
    else if (corridor && (minor < corridor.minMinor || minor > corridor.maxMinor)) e.amount = `Send between ${formatMinor(corridor.minMinor, corridor.sourceCurrency)} and ${formatMinor(corridor.maxMinor, corridor.sourceCurrency)}.`;
    if (corridor && !d.fundingMethod) e.fundingMethod = "Choose how you'll pay.";
    setErrors(e);
    if (Object.keys(e).length === 0) go(2);
  }

  // ── Step 2 validation (server-side rules) ──
  async function continue2() {
    const r = d.recipient;
    if (r?.savedRecipientId) return go(3);
    const e: Record<string, string> = {};
    if (!r?.payoutMethod) e.payoutMethod = "Choose how they'll receive money.";
    if (!r?.provider) e.provider = "Choose a provider.";
    if (!r?.displayName || r.displayName.trim().length < 2) e.displayName = "Enter the recipient's full name.";
    if (!r?.identifier) e.identifier = r?.payoutMethod === "BANK" ? "Enter their account number." : "Enter their mobile money number.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const v = await api<{ masked: string }>("/api/recipients", { method: "POST", json: { ...r, destinationCountry: d.destination, validateOnly: true } });
      update({ recipient: { ...r!, masked: v.masked } });
      go(3);
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.fieldErrors ?? { identifier: ae.message });
    } finally { setBusy(false); }
  }

  // ── Step 4: authorize + pay ──
  async function confirmAndPay() {
    if (!quote || expired || !d.recipient) return;
    setBusy(true); setSubmitErr(null);
    try {
      const r = await api<{ transaction: { id: string }; authorizationToken: string }>("/api/transactions", {
        method: "POST",
        json: { quoteId: quote.id, idempotencyKey: d.idempotencyKey, recipient: { ...d.recipient, destinationCountry: d.destination } },
      });
      await api(`/api/transactions/${r.transaction.id}/authorize`, { method: "POST", json: { authorizationToken: r.authorizationToken, confirm: true } });
      clearDraft();
      router.push(`/app/transfers/${r.transaction.id}?m=${encodeURIComponent(d.fundingMethod ?? "")}`);
    } catch (e) {
      const ae = e as ApiError;
      // Expired/used quote: never reuse it. New idempotency key + fresh quote, then the user must confirm again.
      if (ae.code === "QUOTE_EXPIRED" || ae.code === "QUOTE_USED") { setQuote(null); update({ idempotencyKey: newKey() }); fetchQuote(); }
      setSubmitErr(ae);
      setBusy(false);
    }
  }

  if (!ready) return <div className="mx-auto max-w-xl px-5 pt-10"><div className="skeleton h-[420px]" /></div>;

  return (
    <div className="mx-auto max-w-[560px] px-5 pt-5 lg:pt-10">
      <div className="mb-5 flex items-center gap-3">
        {step > 1 ? (
          <button onClick={() => go(step - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        ) : (
          <Link href="/app" className="grid h-10 w-10 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Back to home"><ArrowLeft className="h-5 w-5" /></Link>
        )}
        <div className="flex-1"><Steps step={step} total={4} labels={LABELS} /></div>
      </div>

      {d.fromAssistant && step <= 2 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-coral/25 bg-coral/5 px-3 py-2 text-[13px] text-ink-2">
          {d.channel === "whatsapp" ? <MessageCircle className="h-4 w-4 text-ok" /> : <Bot className="h-4 w-4 text-coral" />}
          Filled in from your {d.channel === "whatsapp" ? "WhatsApp chat" : "chat"} with Soko. Check every detail below.
        </div>
      )}
      {waErr && <div className="mb-4"><Banner tone="warn" title="This WhatsApp link has expired.">{waErr}</Banner></div>}

      <AnimatePresence mode="wait">
        {/* ─────────────── STEP 1 ─────────────── */}
        {step === 1 && (
          <motion.section key="s1" {...slide}>
            <h1 className="display text-[32px] leading-tight">Send <span className="serif-accent text-coral">money</span></h1>
            <p className="mt-1 text-ink-2">Choose the route and how much you'd like to send.</p>

            <div className="glass mt-6 p-2">
              <button onClick={() => setSheet("source")} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5" aria-label={`Sending from ${src?.name}. Change`}>
                {src && <Flag code={src.code} size={36} />}
                <span className="flex-1"><span className="eyebrow block !text-[10px]">From</span><span className="font-semibold">{src?.name}</span> <span className="text-ink-3">· {src?.currency}</span></span>
                <ChevronDown className="h-4 w-4 text-ink-3" />
              </button>
              <div className="relative my-1 h-px bg-white/5">
                <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink-3"><ArrowDownUp className="h-3.5 w-3.5" /></span>
              </div>
              <button onClick={() => setSheet("destination")} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5" aria-label={dst ? `Sending to ${dst.name}. Change` : "Choose destination"}>
                {dst ? <Flag code={dst.code} size={36} /> : <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line-strong text-ink-3">?</span>}
                <span className="flex-1"><span className="eyebrow block !text-[10px]">To</span>{dst ? <><span className="font-semibold">{dst.name}</span> <span className="text-ink-3">· {dst.currency}</span></> : <span className="text-ink-2">Choose a country</span>}</span>
                <ChevronDown className="h-4 w-4 text-ink-3" />
              </button>
            </div>
            {errors.destination && <p role="alert" className="mt-2 text-[13px] text-err">{errors.destination}</p>}

            {d.destination && corridor && !transactable && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <div className="glass overflow-hidden p-6 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warn/10 text-warn"><MapPinOff className="h-6 w-6" /></div>
                  <h2 className="display mt-4 text-xl">{corridor.status === "MAINTENANCE" ? "This route is paused right now." : "Not available for this route yet."}</h2>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{corridor.status === "MAINTENANCE" ? "Payments on this route are paused for maintenance, so you can't start a transfer here right now." : `We can't send money from ${src?.name} to ${dst?.name} yet.`}</p>
                  <div className="mt-5 flex justify-center gap-2"><button onClick={() => setSheet("destination")} className="btn btn-primary btn-sm">Choose another destination</button><Link href="/app" className="btn btn-ghost btn-sm">Home</Link></div>
                </div>
              </motion.div>
            )}
            {d.destination && !corridor && (
              <div className="mt-4"><Banner tone="warn" title="We can't send money on this route yet." action={<button onClick={() => setSheet("destination")} className="btn btn-ghost btn-sm">Choose another destination</button>} /></div>
            )}

            {transactable && corridor && src && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-5">
                <div className={`glass p-5 ${errors.amount ? "ring-1 ring-err/50" : ""}`}>
                  <label htmlFor="amount" className="eyebrow">You send</label>
                  <div className="mt-2 flex items-baseline gap-3">
                    <input id="amount" inputMode="decimal" autoComplete="off" value={d.amount ?? ""} onChange={(e) => update({ amount: e.target.value.replace(/[^\d.,]/g, "") })}
                      placeholder="0" aria-invalid={!!errors.amount} aria-describedby="amount-help"
                      className="display tabular w-full min-w-0 bg-transparent text-[44px] leading-none outline-none placeholder:text-white/20 sm:text-[52px]" />
                    <span className="display text-xl text-coral">{src.currency}</span>
                  </div>
                  <p id="amount-help" className={`mt-3 text-[12.5px] ${errors.amount ? "text-err" : "text-ink-3"}`} role={errors.amount ? "alert" : undefined}>
                    {errors.amount ?? `Limits: ${formatMinor(corridor.minMinor, corridor.sourceCurrency)} – ${formatMinor(corridor.maxMinor, corridor.sourceCurrency)}. They'll receive ${dst?.currency}; you'll see the exact amount on the quote.`}
                  </p>
                </div>

                <fieldset>
                  <legend className="label">How you'll pay</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {corridor.fundingMethods.map((m) => (
                      <button key={m} type="button" onClick={() => update({ fundingMethod: m })} aria-pressed={d.fundingMethod === m}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${d.fundingMethod === m ? "border-azure-soft bg-azure/20 shadow-[0_0_0_4px_rgba(0,70,222,.18)]" : "border-line bg-white/[0.02] hover:border-line-strong"}`}>
                        <span className="font-semibold">{m}</span>
                        <span className="block text-[12px] text-ink-3">{m === "Card" ? "Higher funding fee" : "Lower funding fee"}</span>
                      </button>
                    ))}
                  </div>
                  {errors.fundingMethod && <p role="alert" className="mt-2 text-[13px] text-err">{errors.fundingMethod}</p>}
                </fieldset>

                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                  {corridor.settlement ? <span className="chip">settles via {corridor.settlement.stablecoin}</span> : <span className="chip">direct mobile-money rail</span>}
                  {corridor.etaMinutes && <span className="chip"><Clock className="h-3 w-3" /> est. {corridor.etaMinutes[0]}–{corridor.etaMinutes[1]} min</span>}
                </div>
              </motion.div>
            )}

            <div className="sticky bottom-0 -mx-5 mt-8 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-5 pt-6 lg:static lg:mx-0 lg:bg-none lg:p-0 lg:pt-2">
              <button onClick={continue1} disabled={!transactable} className="btn btn-primary w-full">Continue <ArrowRight className="h-4 w-4" /></button>
            </div>
          </motion.section>
        )}

        {/* ─────────────── STEP 2 ─────────────── */}
        {step === 2 && dst && corridor && (
          <motion.section key="s2" {...slide}>
            <h1 className="display text-[32px] leading-tight">Who are you <span className="serif-accent text-coral">paying?</span></h1>
            <p className="mt-1 flex items-center gap-2 text-ink-2">Sending to <Flag code={dst.code} size={18} /> {dst.name}</p>

            {d.recipient?.savedRecipientId ? (
              <div className="glass mt-6 flex items-center gap-4 p-5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-coral to-coral-deep font-bold text-canvas">{d.recipient.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                <div className="flex-1"><div className="font-semibold">{d.recipient.displayName}</div><div className="font-mono text-[12px] text-ink-3">{d.recipient.provider} · {d.recipient.masked}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => update({ recipient: { displayName: "", payoutMethod: corridor.payoutMethods[0], provider: "", identifier: "" } })}>Change</button>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <fieldset>
                  <legend className="label">How they'll receive it</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {corridor.payoutMethods.map((m) => {
                      const on = d.recipient?.payoutMethod === m;
                      const Icon = m === "MOBILE_MONEY" ? Smartphone : Building2;
                      return (
                        <button key={m} type="button" aria-pressed={on} onClick={() => update({ recipient: { displayName: d.recipient?.displayName ?? d.recipientName ?? "", nickname: d.recipient?.nickname, payoutMethod: m, provider: "", identifier: "" } })}
                          className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${on ? "border-azure-soft bg-azure/20 shadow-[0_0_0_4px_rgba(0,70,222,.18)]" : "border-line bg-white/[0.02] hover:border-line-strong"}`}>
                          <Icon className={`h-5 w-5 ${on ? "text-coral" : "text-ink-3"}`} />
                          <span className="text-sm font-semibold">{m === "MOBILE_MONEY" ? "Mobile money" : "Bank account"}</span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.payoutMethod && <p role="alert" className="mt-2 text-[13px] text-err">{errors.payoutMethod}</p>}
                </fieldset>

                {d.recipient?.payoutMethod && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <Field id="provider" label={d.recipient.payoutMethod === "BANK" ? "Bank" : "Mobile money provider"} error={errors.provider}>
                      <select id="provider" className="input appearance-none" value={d.recipient.provider} aria-invalid={!!errors.provider}
                        onChange={(e) => update({ recipient: { ...d.recipient!, provider: e.target.value } })}>
                        <option value="">Choose…</option>
                        {(d.recipient.payoutMethod === "BANK" ? BANKS[dst.code] ?? ["Other bank"] : dst.mobileMoney).map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </Field>
                    <Field id="name" label="Recipient's full name" error={errors.displayName} hint="As registered on their account.">
                      <input id="name" className="input" autoComplete="off" value={d.recipient.displayName} aria-invalid={!!errors.displayName}
                        onChange={(e) => update({ recipient: { ...d.recipient!, displayName: e.target.value } })} placeholder="e.g. Ama Mensah" />
                    </Field>
                    <Field id="identifier" label={d.recipient.payoutMethod === "BANK" ? "Account number" : "Mobile money number"} error={errors.identifier}
                      hint={d.recipient.payoutMethod === "BANK" ? "8–18 digits." : <>Include the country code {dst.dial}, or start with 0.</>}>
                      <div className="flex gap-2">
                        {d.recipient.payoutMethod === "MOBILE_MONEY" && <span className="input !w-auto shrink-0 grid place-items-center !px-3 text-ink-2">{dst.dial}</span>}
                        <input id="identifier" className="input tabular" inputMode="tel" autoComplete="off" value={d.recipient.identifier} aria-invalid={!!errors.identifier} aria-describedby={errors.identifier ? "identifier-err" : undefined}
                          onChange={(e) => update({ recipient: { ...d.recipient!, identifier: e.target.value } })} placeholder={d.recipient.payoutMethod === "BANK" ? "0123456789" : "24 123 4567"} />
                      </div>
                    </Field>
                    <Field id="nick" label="Nickname (optional)">
                      <input id="nick" className="input" value={d.recipient.nickname ?? ""} onChange={(e) => update({ recipient: { ...d.recipient!, nickname: e.target.value } })} placeholder="e.g. Sis" />
                    </Field>
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-ink-2">
                      <input type="checkbox" className="h-5 w-5 accent-[#0046de]" checked={!!d.recipient.save} onChange={(e) => update({ recipient: { ...d.recipient!, save: e.target.checked } })} />
                      Save this recipient for next time
                    </label>
                    <div className="flex gap-3 rounded-xl border border-line bg-white/[0.02] p-3 text-[13px] text-ink-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-azure-soft" />
                      We check the number's format, but we can't confirm the name on the account yet. Double-check it before you pay.
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <div className="sticky bottom-0 -mx-5 mt-8 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-5 pt-6 lg:static lg:mx-0 lg:bg-none lg:p-0 lg:pt-2">
              <button onClick={continue2} disabled={busy} className="btn btn-primary w-full">{busy ? "Checking…" : "See the quote"} <ArrowRight className="h-4 w-4" /></button>
            </div>
          </motion.section>
        )}

        {/* ─────────────── STEP 3 ─────────────── */}
        {step === 3 && src && dst && (
          <motion.section key="s3" {...slide}>
            <h1 className="display text-[32px] leading-tight">Here's the <span className="serif-accent text-coral">breakdown</span></h1>
            {quoting && !quote ? (
              <div className="mt-6 space-y-3" aria-busy="true">
                <p className="text-sm text-ink-3" role="status">Checking available rates…</p>
                <div className="skeleton h-40" /><div className="skeleton h-56" />
              </div>
            ) : quoteErr ? (
              <div className="mt-6"><Banner tone="err" title="We couldn't get a quote." action={<div className="flex gap-2"><button onClick={fetchQuote} className="btn btn-primary btn-sm"><RefreshCw className="h-4 w-4" /> Try again</button><button onClick={() => go(1)} className="btn btn-ghost btn-sm">Edit amount</button></div>}>{quoteErr}</Banner></div>
            ) : quote && (
              <QuoteView quote={quote} secsLeft={secsLeft} expired={expired} refreshing={quoting} onRefresh={fetchQuote} />
            )}
            <div className="sticky bottom-0 -mx-5 mt-8 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-5 pt-6 lg:static lg:mx-0 lg:bg-none lg:p-0 lg:pt-2">
              {expired ? (
                <button onClick={fetchQuote} className="btn btn-coral w-full"><RefreshCw className="h-4 w-4" /> Refresh quote</button>
              ) : (
                <button onClick={() => (user ? go(4) : router.push("/signin?next=/app/send"))} disabled={!quote} className="btn btn-primary w-full">
                  {user ? "Review transfer" : "Sign in to continue"} <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.section>
        )}

        {/* ─────────────── STEP 4 ─────────────── */}
        {step === 4 && src && dst && d.recipient && (
          <motion.section key="s4" {...slide}>
            <h1 className="display text-[32px] leading-tight">Review your <span className="serif-accent text-coral">transfer</span></h1>
            <p className="mt-1 text-ink-2">Check everything. Once you pay, it can't be changed.</p>

            {submitErr && <div className="mt-6"><Banner tone={submitErr.code === "QUOTE_EXPIRED" || submitErr.code === "QUOTE_USED" ? "warn" : "err"} title={submitErr.code === "QUOTE_EXPIRED" || submitErr.code === "QUOTE_USED" ? "Your rate has expired." : "We couldn't start this transfer."}
                  action={submitErr.status === 401 ? <Link href="/signin?next=/app/send" className="btn btn-primary btn-sm">Sign in</Link> : undefined}>
                  {submitErr.code === "QUOTE_EXPIRED" || submitErr.code === "QUOTE_USED" ? "Nothing was charged. We've fetched the latest rate below. Review it and confirm again." : submitErr.message}</Banner></div>}
            {!quote ? <div className="skeleton mt-6 h-80" aria-label="Loading latest quote" /> : (
              <>
                <div className="ring-spin glass mt-6 overflow-hidden !rounded-[22px] p-5">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-azure/30 blur-3xl" />
                  <div className="eyebrow">Recipient</div>
                  <div className="mt-3 flex items-center gap-4">
                    <span className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-coral to-coral-deep text-lg font-bold text-canvas">
                      {d.recipient.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      <Flag code={dst.code} size={20} className="absolute -bottom-1 -right-1" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">{d.recipient.displayName}</div>
                      <div className="text-sm text-ink-2">{d.recipient.provider} · <span className="font-mono">{d.recipient.masked}</span></div>
                      <div className="mt-1 inline-flex items-center gap-1 text-[12px] text-warn"><UserRound className="h-3 w-3" /> Name not verified with provider</div>
                    </div>
                  </div>
                  <div className="my-5 h-px bg-white/10" />
                  <div className="text-center">
                    <div className="text-sm text-ink-3">They receive</div>
                    <div className="display tabular mt-1 text-[38px] leading-none">{formatMinor(quote.destinationAmountMinor, quote.destinationCurrency, { code: false })} <span className="text-lg text-coral">{quote.destinationCurrency}</span></div>
                    <div className="mt-1 text-[12px] text-ink-3">{CURRENCIES[quote.destinationCurrency].name}</div>
                  </div>
                  <div className="mt-5 divide-y divide-white/5">
                    <Row label="Route" value={<span className="inline-flex items-center gap-1.5"><Flag code={src.code} size={16} /> {src.name} → <Flag code={dst.code} size={16} /> {dst.name}</span>} />
                    <Row label="You send" value={formatMinor(quote.sourceAmountMinor, quote.sourceCurrency)} />
                    <Row label="Total fees" value={formatMinor(quote.totalFeesMinor, quote.sourceCurrency)} />
                    <Row label="Exchange rate" value={formatRate(quote.fxRate, quote.sourceCurrency, quote.destinationCurrency)} />
                    <Row label="Pay with" value={d.fundingMethod} />
                    <Row label="Total to pay" value={formatMinor(quote.totalAmountMinor, quote.sourceCurrency)} strong />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-ink-2"><Clock className="h-4 w-4" /> {expired ? "Rate expired" : "Rate held for"}</span>
                  <span className={`tabular font-semibold ${expired ? "text-err" : secsLeft < 30 ? "text-warn" : ""}`}>{expired ? "Refresh to continue" : `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, "0")}`}</span>
                </div>

                <p className="mt-4 flex gap-2 text-[12.5px] leading-relaxed text-ink-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                  By tapping Confirm &amp; pay, you authorize SokoBot to send exactly {formatMinor(quote.totalAmountMinor, quote.sourceCurrency)} so that {d.recipient.displayName} receives {formatMinor(quote.destinationAmountMinor, quote.destinationCurrency)}. If anything changes, you'll need to confirm again. Payouts that have been delivered may not be reversible.
                </p>


              </>
            )}

            <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-5 pt-6 lg:static lg:mx-0 lg:bg-none lg:p-0 lg:pt-2">
              {expired ? (
                <button onClick={fetchQuote} className="btn btn-coral w-full"><RefreshCw className="h-4 w-4" /> Refresh quote</button>
              ) : (
                <button onClick={confirmAndPay} disabled={busy || !quote} className="btn btn-primary w-full text-[16px]">
                  <Lock className="h-4 w-4" /> {busy ? "Securing your transfer…" : "Confirm & pay"}
                </button>
              )}
              <button onClick={() => go(1)} className="btn mt-2 w-full text-ink-2 hover:text-ink">Edit details</button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <CountrySheet open={sheet !== null} mode={sheet ?? "source"} source={d.source} value={sheet === "source" ? d.source : d.destination}
        onClose={() => setSheet(null)}
        onPick={(c) => {
          if (sheet === "source") update({ source: c.code, destination: d.destination === c.code ? undefined : d.destination, amount: undefined, fundingMethod: undefined });
          else update({ destination: c.code, fundingMethod: undefined, recipient: d.recipient?.savedRecipientId ? undefined : d.recipient });
        }} />
    </div>
  );
}

const BANKS: Record<string, string[]> = {
  NG: ["Access Bank", "GTBank", "Zenith Bank", "First Bank", "UBA", "Kuda"],
  GH: ["GCB Bank", "Ecobank Ghana", "Fidelity Bank", "Stanbic Ghana"],
  KE: ["Equity Bank", "KCB", "Co-operative Bank"],
  ZA: ["Capitec", "Standard Bank", "FNB", "Absa", "Nedbank", "TymeBank"],
};

function QuoteView({ quote, secsLeft, expired, refreshing, onRefresh }: { quote: Quote; secsLeft: number; expired: boolean; refreshing: boolean; onRefresh: () => void }) {
  const sc = quote.sourceCurrency;
  const pct = Math.max(0, Math.min(1, secsLeft / 120));
  const fees = [
    { l: "Funding fee", v: quote.fundingFeeMinor, h: "Charged by the payment provider" },
    { l: "Conversion fee", v: quote.conversionFeeMinor, h: "For changing currency" },
    { l: "Network fee", v: quote.networkFeeMinor, h: "Stablecoin settlement" },
    { l: "Payout fee", v: quote.payoutFeeMinor, h: "Recipient's provider" },
    { l: "SokoBot fee", v: quote.platformFeeMinor },
  ].filter((f) => f.v > 0);
  const [open, setOpen] = useState(false);
  const corridor = useMemo(() => CORRIDORS.find((c) => c.id === quote.corridorId), [quote.corridorId]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-4">
      <div className={`relative overflow-hidden rounded-[22px] p-6 text-center ${expired ? "opacity-50" : ""}`} style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(0,70,222,.55), rgba(12,18,34,.9) 60%)" }}>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-coral/25 blur-3xl" />
        <Sparkle size={16} className="absolute right-6 top-6 text-coral" />
        <div className="relative text-sm text-ink-2">Recipient gets</div>
        <div className="display relative mt-2 text-[44px] leading-none sm:text-[54px]">
          <CountUp value={quote.destinationAmountMinor} format={(n) => formatMinor(n, quote.destinationCurrency, { code: false })} />
          <span className="ml-2 text-xl text-coral">{quote.destinationCurrency}</span>
        </div>
        <div className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] tabular">{formatRate(quote.fxRate, sc, quote.destinationCurrency)}</div>
      </div>

      <div className="glass p-5">
        <Row label="You send" value={formatMinor(quote.sourceAmountMinor, sc)} />
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between py-2.5 text-left text-sm text-ink-2">
          <span>Fees</span>
          <span className="flex items-center gap-1.5 tabular text-ink">{formatMinor(quote.totalFeesMinor, sc)} <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} /></span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mb-2 rounded-xl bg-white/[0.03] px-4">
                {fees.map((f) => <Row key={f.l} label={f.l} hint={f.h} value={formatMinor(f.v, sc)} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="my-1 h-px bg-white/10" />
        <Row label="Total to pay" value={formatMinor(quote.totalAmountMinor, sc)} strong />
        {corridor?.etaMinutes && <Row label="Estimated arrival" value={`${corridor.etaMinutes[0]}–${corridor.etaMinutes[1]} minutes`} hint="Estimate from provider route data" />}
      </div>

      <div className="glass flex items-center gap-4 p-4">
        <div className="relative h-11 w-11 shrink-0">
          <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" /><circle cx="18" cy="18" r="15" fill="none" stroke={expired ? "#f47788" : secsLeft < 30 ? "#f6c56a" : "#feb192"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct * 94.2} 94.2`} style={{ transition: "stroke-dasharray 1s linear" }} /></svg>
          <span className="tabular absolute inset-0 grid place-items-center text-[11px] font-semibold">{secsLeft}s</span>
        </div>
        <div className="flex-1 text-sm">
          {expired ? <><div className="font-semibold text-err">Your rate has expired.</div><div className="text-ink-3">Refresh the quote to see the latest available price.</div></>
            : <><div className="font-semibold">Your quote is ready.</div><div className="text-ink-3">Locked until the timer runs out.</div></>}
        </div>
        <button onClick={onRefresh} disabled={refreshing} className="grid h-10 w-10 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Refresh quote"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button>
      </div>
      <p className="px-1 font-mono text-[10.5px] text-ink-3">Quote {quote.providerReference} · {quote.provider}</p>
    </motion.div>
  );
}
