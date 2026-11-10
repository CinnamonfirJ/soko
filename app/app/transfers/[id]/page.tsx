"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, CircleHelp, Copy, CreditCard, Download, ExternalLink, Hourglass, Landmark, Loader2, Lock, Share2, ShieldCheck, Smartphone } from "lucide-react";
import { api, ApiError, newKey, relTime } from "@/lib/client";
import { country } from "@/lib/corridors";
import { formatMinor, formatRate } from "@/lib/money";
import type { PublicTx } from "@/lib/engine";
import type { StageStatus } from "@/lib/types";
import { Banner, Flag, Row, StatusPill, type Tone } from "@/components/ui";
import { Ribbons, Sparkle } from "@/components/fx";

const TERMINAL = ["COMPLETED", "REFUNDED", "FAILED"];

function TransferPage() {
  const { id } = useParams<{ id: string }>();
  const method = useSearchParams().get("m") || "";
  const [tx, setTx] = useState<PublicTx | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let stop = false, t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await api<{ transaction: PublicTx; serverTime: string }>(`/api/transactions/${id}`);
        if (stop) return;
        setTx(r.transaction); setLastOk(r.serverTime); setOffline(false); setErr(null);
        if (TERMINAL.includes(r.transaction.state)) return;
      } catch (e) {
        const ae = e as ApiError;
        if (ae.status === 0) setOffline(true); else setErr(ae);
        if (ae.status === 404 || ae.status === 401) return;
      }
      t = setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [id]);

  if (err && !tx) return (
    <div className="mx-auto max-w-[560px] px-5 pt-10">
      <Banner tone="err" title={err.status === 401 ? "Please sign in to see this transfer." : "We couldn't find this transfer."} action={err.status === 401 ? <Link href={`/signin?next=/app/transfers/${id}`} className="btn btn-primary btn-sm">Sign in</Link> : <Link href="/app/activity" className="btn btn-ghost btn-sm">Go to activity</Link>} />
    </div>
  );
  if (!tx) return <div className="mx-auto max-w-[560px] space-y-3 px-5 pt-10"><div className="skeleton h-40" /><div className="skeleton h-72" /></div>;

  const showFunding = tx.state === "AWAITING_FUNDING";
  const showReceipt = tx.state === "COMPLETED";
  return (
    <div className="mx-auto max-w-[560px] px-5 pt-5 lg:pt-10">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/app/activity" className="grid h-10 w-10 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Back to activity"><ArrowLeft className="h-5 w-5" /></Link>
        <RefChip reference={tx.reference} />
      </div>
      {offline && <div className="mb-4"><Banner tone="warn" title="You're offline.">Showing the last confirmed status{lastOk ? ` from ${relTime(lastOk)}` : ""}. Nothing will be sent twice when you reconnect.</Banner></div>}
      <AnimatePresence mode="wait">
        {showFunding ? <Funding key="fund" tx={tx} initialMethod={method} onUpdate={setTx} />
          : showReceipt ? <Receipt key="receipt" tx={tx} />
          : <Tracking key="track" tx={tx} lastOk={lastOk} />}
      </AnimatePresence>
    </div>
  );
}
export default function Page() { return <Suspense><TransferPage /></Suspense>; }

function RefChip({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(reference); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="chip !h-9 hover:!text-ink" aria-label={`Copy reference ${reference}`}>
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : reference}
    </button>
  );
}

function Summary({ tx }: { tx: PublicTx }) {
  const d = country(tx.recipient?.destinationCountry ?? "");
  return (
    <div className="relative overflow-hidden rounded-[22px] p-6" style={{ background: "radial-gradient(120% 100% at 0% 0%, rgba(0,70,222,.5), rgba(12,18,34,.92) 60%)" }}>
      <Ribbons className="absolute inset-0 h-full w-full opacity-40" />
      <div className="relative flex items-center gap-4">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral to-coral-deep text-lg font-bold text-canvas">
          {tx.recipient?.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          {d && <Flag code={d.code} size={20} className="absolute -bottom-1 -right-1" />}
        </span>
        <div className="min-w-0">
          <div className="text-sm text-ink-2">To {tx.recipient?.displayName}</div>
          <div className="display tabular text-[30px] leading-tight">{formatMinor(tx.destinationAmountMinor, tx.destinationCurrency, { code: false })} <span className="text-base text-coral">{tx.destinationCurrency}</span></div>
          <div className="text-[12.5px] text-ink-3">{tx.recipient?.provider} · <span className="font-mono">{tx.recipient?.maskedIdentifier}</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── S10 Funding ────────────────────────────────────────────────────────
function Funding({ tx, initialMethod, onUpdate }: { tx: PublicTx; initialMethod: string; onUpdate: (t: PublicTx) => void }) {
  const router = useRouter();
  const methods = tx.corridor?.fundingMethods ?? [];
  const [method, setMethod] = useState(methods.includes(initialMethod) ? initialMethod : methods[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newKey()); // one key per screen: double taps reuse it
  const Icon = (m: string) => (m === "Card" ? CreditCard : m === "Bank transfer" ? Landmark : Smartphone);
  async function pay() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ checkoutUrl: string; transaction: PublicTx }>(`/api/transactions/${tx.id}/fund`, { method: "POST", json: { method, idempotencyKey: key.current } });
      onUpdate(r.transaction);
      router.push(r.checkoutUrl);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <h1 className="display text-[32px] leading-tight">Complete your <span className="serif-accent text-coral">payment</span></h1>
      <p className="mt-1 text-ink-2">Your transfer is confirmed. Now pay securely through our payment partner.</p>
      <div className="mt-6"><Summary tx={tx} /></div>
      <div className="glass mt-4 p-5">
        <div className="text-sm text-ink-2">Amount due</div>
        <div className="display tabular mt-1 text-3xl">{formatMinor(tx.totalAmountMinor, tx.sourceCurrency)}</div>
        <div className="mt-1 text-[12.5px] text-ink-3">Includes {formatMinor(tx.totalFeesMinor, tx.sourceCurrency)} in fees</div>
      </div>
      <fieldset className="mt-5">
        <legend className="label">Pay with</legend>
        <div className="space-y-2">
          {methods.map((m) => {
            const I = Icon(m);
            return (
              <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${method === m ? "border-azure-soft bg-azure/20 shadow-[0_0_0_4px_rgba(0,70,222,.18)]" : "border-line bg-white/[0.02] hover:border-line-strong"}`}>
                <I className={`h-5 w-5 ${method === m ? "text-coral" : "text-ink-3"}`} />
                <span className="flex-1 font-medium">{m}</span>
                <span className={`h-5 w-5 rounded-full border-2 ${method === m ? "border-coral bg-coral shadow-[inset_0_0_0_3px_#0c1222]" : "border-line-strong"}`} />
              </button>
            );
          })}
        </div>
      </fieldset>
      {err && <div className="mt-4"><Banner tone="err" title="Your payment wasn't started.">{err}</Banner></div>}
      <div className="mt-5 flex items-center gap-2 text-[12.5px] text-ink-3"><ShieldCheck className="h-4 w-4 text-ok" /> You'll pay on our partner's secure page. SokoBot never sees your card or bank PIN.</div>
      <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-5 pt-6 lg:static lg:mx-0 lg:bg-none lg:p-0">
        <button onClick={pay} disabled={busy || !method} className="btn btn-primary w-full"><Lock className="h-4 w-4" /> {busy ? "Opening secure checkout…" : `Pay ${formatMinor(tx.totalAmountMinor, tx.sourceCurrency)}`}</button>
        <Link href="/app/support" className="btn mt-1 w-full text-sm text-ink-3">Need help?</Link>
      </div>
    </motion.div>
  );
}

// ─── S11 Tracking + S19 Recovery ────────────────────────────────────────
type Stage = { key: string; title: string; detail: string; status: StageStatus };
function stagesFor(tx: PublicTx): Stage[] {
  const pending = ["FUNDING_PENDING"].includes(tx.state);
  const s: Stage[] = [
    { key: "fund", title: "Payment received", detail: tx.fundingStatus === "CONFIRMED" ? "Confirmed by the payment provider" : tx.fundingStatus === "FAILED" ? "Payment wasn't completed" : pending ? "Confirming your payment…" : "Waiting for payment", status: tx.fundingStatus },
    { key: "settle", title: "Transfer processing", detail: tx.settlementStatus === "SKIPPED" ? "Direct mobile-money rail, no conversion step" : tx.settlementStatus === "CONFIRMED" ? `Moved across the border as USDT${tx.blockchainChain ? " on " + tx.blockchainChain : ""}` : tx.settlementStatus === "PENDING" ? "Converting your money to USDT and sending it" : "Starts after payment is confirmed", status: tx.settlementStatus },
    { key: "payout", title: "Paying recipient", detail: tx.payoutStatus === "CONFIRMED" ? `Paid to ${tx.recipient?.provider}` : tx.payoutStatus === "FAILED" ? "The recipient's provider didn't accept the payout" : tx.payoutStatus === "UNKNOWN" ? "We're confirming the outcome with the provider" : tx.payoutStatus === "PENDING" ? `Sending to ${tx.recipient?.provider}` : "Starts after processing", status: tx.payoutStatus },
    { key: "done", title: "Money delivered", detail: tx.state === "COMPLETED" ? "Your recipient has been paid" : "Only shown once the payout is confirmed", status: tx.state === "COMPLETED" ? "CONFIRMED" : "NOT_STARTED" },
  ];
  return s;
}

function Tracking({ tx, lastOk }: { tx: PublicTx; lastOk: string | null }) {
  const stages = stagesFor(tx);
  const head: Record<string, { title: React.ReactNode; body: string; tone: Tone; icon: React.ReactNode }> = {
    FUNDING_PENDING: { title: <>Confirming your <span className="serif-accent text-coral">payment…</span></>, body: "This can take a moment. Please don't make another payment while we verify it.", tone: "info", icon: <Loader2 className="h-6 w-6 animate-spin" /> },
    FUNDED: { title: <>Payment <span className="serif-accent text-coral">received.</span></>, body: "Your transfer is now being processed.", tone: "info", icon: <Check className="h-6 w-6" /> },
    SETTLEMENT_PENDING: { title: <>Your money is <span className="serif-accent text-coral">moving.</span></>, body: "Your transfer is being processed.", tone: "info", icon: <Loader2 className="h-6 w-6 animate-spin" /> },
    SETTLED: { title: <>Almost <span className="serif-accent text-coral">there.</span></>, body: "Processing is done. Paying your recipient next.", tone: "info", icon: <Loader2 className="h-6 w-6 animate-spin" /> },
    PAYOUT_PENDING: { title: <>Paying your <span className="serif-accent text-coral">recipient.</span></>, body: `Sending to ${tx.recipient?.provider}. We'll confirm when it lands.`, tone: "info", icon: <Loader2 className="h-6 w-6 animate-spin" /> },
    PAYOUT_CONFIRMED: { title: <>Payout <span className="serif-accent text-coral">confirmed.</span></>, body: "Finalizing your receipt.", tone: "ok", icon: <Check className="h-6 w-6" /> },
    MANUAL_REVIEW: tx.payoutStatus === "UNKNOWN"
      ? { title: "We're confirming what happened.", body: "Please don't make another payment while we verify this transfer. Your reference is saved and our team is checking with the provider.", tone: "warn", icon: <Hourglass className="h-6 w-6" /> }
      : { title: "Your transfer needs attention.", body: "Your payment was received, but the recipient payout wasn't completed. Your money is safe with us and we're reviewing the next steps. We'll refund you or retry the payout.", tone: "warn", icon: <AlertTriangle className="h-6 w-6" /> },
    FAILED: { title: "Your payment wasn't completed.", body: "No money was taken for this transfer. Check your payment method before trying again.", tone: "err", icon: <AlertTriangle className="h-6 w-6" /> },
    REFUND_PENDING: { title: "Refund pending.", body: "We're returning your money to your original payment method. Refunds can take a few days, depending on your provider.", tone: "warn", icon: <Hourglass className="h-6 w-6" /> },
    REFUNDED: { title: "Refunded.", body: "Your money was returned to your original payment method.", tone: "info", icon: <Check className="h-6 w-6" /> },
    QUOTE_EXPIRED: { title: "This quote expired before payment.", body: "Nothing was charged. Start a new transfer to get a fresh rate.", tone: "warn", icon: <Hourglass className="h-6 w-6" /> },
    AWAITING_AUTHORIZATION: { title: "Not confirmed yet.", body: "This transfer was never confirmed, so nothing was charged. Start a new transfer to get a fresh quote.", tone: "muted", icon: <CircleHelp className="h-6 w-6" /> },
  };
  const h = head[tx.state] ?? head.FUNDING_PENDING;
  const toneBg: Record<Tone, string> = { info: "bg-azure/20 text-azure-soft", ok: "bg-ok/15 text-ok", warn: "bg-warn/15 text-warn", err: "bg-err/15 text-err", muted: "bg-white/5 text-ink-3" };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="flex items-start gap-4">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${toneBg[h.tone]}`}>{h.icon}</span>
        <div aria-live="polite">
          <h1 className="display text-[28px] leading-tight">{h.title}</h1>
          <p className="mt-1 text-ink-2">{h.body}</p>
        </div>
      </div>
      <div className="mt-6"><Summary tx={tx} /></div>

      <ol className="glass mt-4 p-5" aria-label="Transfer progress">
        {stages.map((s, i) => <StageRow key={s.key} s={s} last={i === stages.length - 1} />)}
      </ol>

      <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-ink-3">
        <span>Last confirmed update: {lastOk ? relTime(lastOk) : "—"}</span>
      </div>


      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {["FAILED", "QUOTE_EXPIRED", "AWAITING_AUTHORIZATION"].includes(tx.state) ? <Link href="/app/send" className="btn btn-primary flex-1">Start a new transfer</Link> : null}
        <Link href={`/app/support?tx=${tx.id}`} className="btn btn-ghost flex-1"><CircleHelp className="h-4 w-4" /> Contact support</Link>
      </div>
    </motion.div>
  );
}

function StageRow({ s, last }: { s: Stage; last: boolean }) {
  const done = s.status === "CONFIRMED" || s.status === "SKIPPED";
  const active = s.status === "PENDING";
  const bad = s.status === "FAILED";
  const unknown = s.status === "UNKNOWN";
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && (
        <span className="absolute left-[15px] top-8 h-[calc(100%-28px)] w-0.5 overflow-hidden rounded bg-white/10" aria-hidden>
          <motion.span className="block w-full bg-gradient-to-b from-coral to-azure-soft" initial={false} animate={{ height: done ? "100%" : "0%" }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </span>
      )}
      <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-colors duration-500 ${done ? "border-coral bg-coral text-canvas" : active ? "border-azure-soft bg-azure/30 text-white" : bad ? "border-err bg-err/20 text-err" : unknown ? "border-warn bg-warn/15 text-warn" : "border-line-strong bg-surface text-ink-3"}`}>
        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : active ? <span className="pulse-dot h-2 w-2 rounded-full bg-white text-azure-soft" /> : bad ? "!" : unknown ? "?" : <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />}
      </span>
      <div className="pt-1">
        <div className={`font-semibold ${done || active ? "text-ink" : "text-ink-3"}`}>{s.title}
          <span className="sr-only"> — {done ? "complete" : active ? "in progress" : bad ? "failed" : unknown ? "outcome unknown" : "not started"}</span>
        </div>
        <div className="text-[13px] text-ink-3">{s.detail}</div>
      </div>
    </li>
  );
}

// ─── S12 Success & Receipt ──────────────────────────────────────────────
function Receipt({ tx }: { tx: PublicTx }) {
  const q = tx.quote;
  const src = country(tx.corridor?.source ?? ""), dst = country(tx.recipient?.destinationCountry ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const share = async () => {
    const text = `SokoBot receipt ${tx.reference}\n${tx.recipient?.displayName} received ${formatMinor(tx.destinationAmountMinor, tx.destinationCurrency)}\nCompleted ${new Date(tx.completedAt!).toLocaleString()}`;
    try { if (navigator.share) await navigator.share({ title: "SokoBot receipt", text }); else { await navigator.clipboard.writeText(text); setSaved("Receipt copied"); } } catch {}
  };
  const saveRecipient = async () => {
    try { await api("/api/recipients", { method: "POST", json: { ...tx.recipient, identifier: "", savedRecipientId: tx.recipient?.id } }); } catch {}
    setSaved("Recipient saved.");
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="relative py-6 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-ok/20 blur-3xl" />
        <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-ok to-[#1f9d72] shadow-[0_0_60px_rgba(56,201,150,.55)]">
          <motion.svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="#010511" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.5 }} /></motion.svg>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span key={i} className="absolute text-coral" initial={{ opacity: 0, x: 0, y: 0 }} animate={{ opacity: [0, 1, 0], x: Math.cos((i / 6) * Math.PI * 2) * 70, y: Math.sin((i / 6) * Math.PI * 2) * 70 }} transition={{ delay: 0.4, duration: 0.9 }}><Sparkle size={12} /></motion.span>
          ))}
        </motion.div>
        <h1 className="display relative mt-6 text-[34px]">Money <span className="serif-accent text-gradient-coral">delivered.</span></h1>
        <p className="relative mt-1 text-ink-2">{tx.recipient?.displayName} has received the transfer.</p>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-surface">
        <div className="relative overflow-hidden p-6 text-center" style={{ background: "radial-gradient(100% 120% at 50% 0%, rgba(0,70,222,.45), transparent 70%)" }}>
          <div className="text-sm text-ink-3">Recipient received</div>
          <div className="display tabular mt-1 text-[40px] leading-none">{formatMinor(tx.destinationAmountMinor, tx.destinationCurrency, { code: false })} <span className="text-lg text-coral">{tx.destinationCurrency}</span></div>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-ink-2">{src && <Flag code={src.code} size={16} />} {src?.name} → {dst && <Flag code={dst.code} size={16} />} {dst?.name}</div>
        </div>
        <div className="relative h-0 border-t border-dashed border-white/15"><span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-canvas" /><span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-canvas" /></div>
        <div className="divide-y divide-white/5 px-6 py-3">
          <Row label="Recipient" value={<>{tx.recipient?.displayName}<div className="font-mono text-[11.5px] text-ink-3">{tx.recipient?.provider} · {tx.recipient?.maskedIdentifier}</div></>} />
          <Row label="You sent" value={formatMinor(tx.sourceAmountMinor, tx.sourceCurrency)} />
          <Row label="Fees" value={formatMinor(tx.totalFeesMinor, tx.sourceCurrency)} />
          <Row label="Total paid" value={formatMinor(tx.totalAmountMinor, tx.sourceCurrency)} strong />
          {q && <Row label="Exchange rate" value={formatRate(q.fxRate, tx.sourceCurrency, tx.destinationCurrency)} />}
          <Row label="Completed" value={new Date(tx.completedAt!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} />
          <Row label="Reference" value={<span className="font-mono">{tx.reference}</span>} />
          <Row label="Payout reference" value={<span className="font-mono text-[12px]">{tx.payoutReference}</span>} />
          <Row label="Status" value={<StatusPill tone="ok">Payout confirmed</StatusPill>} />
        </div>
      </div>

      {saved && <p role="status" className="mt-3 text-center text-sm text-ok">{saved}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={share} className="btn btn-ghost"><Share2 className="h-4 w-4" /> Share</button>
        <button onClick={() => window.print()} className="btn btn-ghost"><Download className="h-4 w-4" /> Download</button>
      </div>
      {tx.recipient && !(tx.recipient as { saved?: boolean }).saved && <button onClick={saveRecipient} className="btn btn-ghost mt-2 w-full">Save {tx.recipient.displayName.split(" ")[0]} as a recipient</button>}
      <Link href="/app" className="btn btn-primary mt-2 w-full">Back to home</Link>
      <Link href={`/app/support?tx=${tx.id}`} className="mt-3 flex items-center justify-center gap-1 text-sm text-ink-3 hover:text-ink">Something wrong? Contact support <ExternalLink className="h-3 w-3" /></Link>
    </motion.div>
  );
}
