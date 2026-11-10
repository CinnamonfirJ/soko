"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, MessageCircle, Search } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client";
import type { PublicTx } from "@/lib/engine";
import { Field } from "@/components/ui";
import { Sparkle } from "@/components/fx";

const FAQ = [
  { q: "When is my money \"delivered\"?", a: "Only when the recipient's provider confirms the payout. Before that, you'll see each verified step: payment received, processing, paying recipient." },
  { q: "My transfer says \"needs attention\". Is my money lost?", a: "No. It means a step didn't complete as expected, for example the recipient's wallet rejected the payout. Your reference is saved and our team either retries the payout or refunds you." },
  { q: "Can I cancel a transfer?", a: "Before you pay, yes. Just leave the flow. After the payout is confirmed, transfers usually can't be reversed. Contact support with your reference and we'll see what's possible." },
  { q: "Why did my rate change?", a: "Quotes are held for a short time. If one expires, we fetch a fresh rate and ask you to confirm again. We never change the price after you confirm." },
  { q: "Will Soko ever ask for my PIN or password?", a: "Never. Soko and our team will never ask for card PINs, bank passwords or wallet keys." },
  { q: "Does the recipient need SokoBot?", a: "No. They receive local money straight into their mobile money wallet or bank account." },
];

function Support() {
  const txParam = useSearchParams().get("tx") ?? "";
  const me = useApi<{ user: unknown }>("/api/auth/me");
  const txs = useApi<{ transactions: PublicTx[] }>(me.data?.user ? "/api/transactions" : null, [!!me.data?.user]);
  const [open, setOpen] = useState<number | null>(0);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ transactionId: txParam, category: "Transfer is delayed", message: "" });
  const [sent, setSent] = useState<{ id: string } | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const active = txs.data?.transactions.find((t) => !["COMPLETED", "REFUNDED"].includes(t.state) && t.state !== "AWAITING_AUTHORIZATION");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api<{ case: { id: string } }>("/api/support", { method: "POST", json: form }); setSent(r.case); } catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 lg:pt-10">
      <h1 className="display text-[34px] leading-tight">How can we <span className="serif-accent text-gradient-coral">help?</span></h1>
      <div className="relative mt-5">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input !rounded-full !pl-11" placeholder="Search help" aria-label="Search help articles" />
      </div>

      {active && (
        <Link href={`/app/transfers/${active.id}`} className="glass mt-5 flex items-center gap-3 p-4">
          <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-warn text-warn" />
          <div className="flex-1 text-sm"><div className="font-semibold">Your transfer to {active.recipient?.displayName}</div><div className="text-ink-3">{active.status.label} · {active.reference}</div></div>
          <span className="text-sm text-coral">Open</span>
        </Link>
      )}

      <div className="glass mt-5 divide-y divide-white/5 overflow-hidden">
        {FAQ.filter((f) => !q || (f.q + f.a).toLowerCase().includes(q.toLowerCase())).map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 p-4 text-left font-medium">
              {f.q}<ChevronDown className={`h-4 w-4 shrink-0 text-ink-3 transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pb-4 text-sm text-ink-2">{f.a}</motion.p>}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="display flex items-center gap-2 text-xl"><MessageCircle className="h-5 w-5 text-coral" /> Contact support</h2>
        <p className="mt-1 text-sm text-ink-2">We usually reply within a few hours. Include your transfer reference if you have one.</p>
        {!me.loading && !me.data?.user ? (
          <div className="glass mt-4 p-5 text-sm text-ink-2">Please <Link href="/signin?next=/app/support" className="text-coral underline">sign in</Link> so we can link your request to your transfers.</div>
        ) : sent ? (
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass mt-4 flex items-center gap-4 p-5" role="status">
            <CheckCircle2 className="h-8 w-8 text-ok" />
            <div><div className="font-semibold">We've received your request.</div><div className="font-mono text-[12px] text-ink-3">Case {sent.id}</div></div>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="glass mt-4 space-y-4 p-5">
            <Field id="tx" label="Transfer (optional)">
              <select id="tx" className="input" value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })}>
                <option value="">Not about a specific transfer</option>
                {txs.data?.transactions.map((t) => <option key={t.id} value={t.id}>{t.reference} · {t.recipient?.displayName}</option>)}
              </select>
            </Field>
            <Field id="cat" label="What's it about?">
              <select id="cat" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["Transfer is delayed", "Recipient hasn't received money", "Payment failed", "Refund", "Wrong details", "Account and sign-in", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="msg" label="Message" error={err?.fieldErrors?.message ?? (err && !err.fieldErrors ? err.message : undefined)}>
              <textarea id="msg" rows={4} className="input !py-3" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us what happened" aria-invalid={!!err} />
            </Field>
            <button disabled={busy} className="btn btn-primary w-full">{busy ? "Sending…" : "Send request"}</button>
          </form>
        )}
      </section>

      <section id="privacy" className="mt-10 scroll-mt-20 text-sm text-ink-2">
        <h2 className="display mb-2 flex items-center gap-2 text-lg text-ink"><Sparkle size={12} className="text-coral" /> Privacy</h2>
        <p>We collect only what we need to move your money and meet legal duties: your phone number, recipient payout details and transfer records. Payout numbers are masked wherever they're shown. Card and bank details are handled by our payment partners, never by SokoBot.</p>
      </section>
      <section id="terms" className="mt-6 scroll-mt-20 pb-8 text-sm text-ink-2">
        <h2 className="display mb-2 flex items-center gap-2 text-lg text-ink"><Sparkle size={12} className="text-coral" /> Terms</h2>
        <p>SokoBot isn't a bank and doesn't hold deposits. Payments are collected and paid out by regulated payment partners, and each transfer is shown with its full cost before you confirm it. Completed payouts may not be reversible.</p>
      </section>
    </div>
  );
}
export default function Page() { return <Suspense><Support /></Suspense>; }
