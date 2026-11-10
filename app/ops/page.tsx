"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Flag as FlagIcon, KeyRound, RefreshCcw, RotateCcw, Search, ShieldAlert, Undo2, X } from "lucide-react";
import { formatMinor } from "@/lib/money";
import type { PublicTx } from "@/lib/engine";
import type { TxEvent } from "@/lib/types";
import { Logo, StatusPill, type Tone } from "@/components/ui";
import { Aurora } from "@/components/fx";

type OpsTx = Omit<PublicTx, "events"> & { userPhone?: string; scenario: string; events: TxEvent[] };
type OpsData = { summary: Record<string, number>; transactions: OpsTx[] };

export default function Ops() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<OpsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<OpsTx | null>(null);

  useEffect(() => { try { const k = sessionStorage.getItem("soko_ops"); if (k) { setKey(k); setAuthed(true); } } catch {} }, []);
  const load = useCallback(async () => {
    const r = await fetch(`/api/ops/transactions${q ? `?q=${encodeURIComponent(q)}` : ""}`, { headers: { "x-ops-key": key }, cache: "no-store" });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); setAuthed(false); try { sessionStorage.removeItem("soko_ops"); } catch {} return; }
    setErr(null); setData(j);
    setSel((s) => (s ? j.transactions.find((t: OpsTx) => t.id === s.id) ?? null : null));
  }, [key, q]);
  useEffect(() => { if (!authed) return; load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [authed, load]);

  if (!authed) return (
    <main className="relative grid min-h-dvh place-items-center px-5">
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-60"><Aurora /></div>
      <form onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem("soko_ops", key); } catch {} setAuthed(true); }} className="glass relative w-full max-w-sm !rounded-[24px] p-7">
        <Logo />
        <h1 className="display mt-6 text-2xl">Operations console</h1>
        <p className="mt-1 text-sm text-ink-2">Restricted to the payments operations team. Every action is logged.</p>
        <label htmlFor="k" className="label mt-6">Ops access key</label>
        <div className="relative"><KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><input id="k" type="password" className="input !pl-11" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></div>
        {err && <p role="alert" className="mt-2 text-[13px] text-err">{err}</p>}
        <p className="mt-2 text-[12px] text-ink-3">Ask an administrator if you need access.</p>
        <button className="btn btn-primary mt-5 w-full">Enter</button>
      </form>
    </main>
  );

  const S = data?.summary;
  return (
    <main className="relative min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-white/5 bg-canvas/80 px-6 py-3 backdrop-blur-xl">
        <Logo />
        <span className="chip !text-coral">OPS</span>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input !min-h-[40px] !rounded-full !pl-10 !text-sm" placeholder="Search reference (SK-…)" aria-label="Search by transaction reference" />
        </div>
        <button onClick={() => { try { sessionStorage.removeItem("soko_ops"); } catch {} setAuthed(false); setKey(""); }} className="btn btn-ghost btn-sm">Lock</button>
      </header>
      <div className="mx-auto max-w-7xl p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { k: "active", l: "Active", i: Clock, c: "text-azure-soft" },
            { k: "pending", l: "Awaiting provider", i: RefreshCcw, c: "text-ink-2" },
            { k: "review", l: "Manual review", i: ShieldAlert, c: "text-warn" },
            { k: "failed", l: "Failed", i: AlertTriangle, c: "text-err" },
            { k: "completed", l: "Completed", i: CheckCircle2, c: "text-ok" },
          ].map((m, i) => (
            <motion.div key={m.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass p-4">
              <div className="flex items-center justify-between text-[12.5px] text-ink-3">{m.l}<m.i className={`h-4 w-4 ${m.c}`} /></div>
              <div className="display tabular mt-2 text-3xl">{S?.[m.k] ?? "–"}</div>
            </motion.div>
          ))}
        </div>

        <div className="glass mt-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-[12px] text-ink-3"><tr className="border-b border-white/5">{["Reference", "Created", "Sender", "Recipient", "Amount", "Funding", "Settlement", "Payout", "State"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {data?.transactions.map((t) => (
                <tr key={t.id} onClick={() => setSel(t)} className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03] ${sel?.id === t.id ? "bg-azure/10" : ""}`}>
                  <td className="px-4 py-3 font-mono text-[12px]">{t.reference}</td>
                  <td className="px-4 py-3 text-ink-3">{new Date(t.createdAt).toLocaleTimeString()}</td>
                  <td className="px-4 py-3 font-mono text-[12px]">{t.userPhone}</td>
                  <td className="px-4 py-3">{t.recipient?.displayName}</td>
                  <td className="tabular px-4 py-3">{formatMinor(t.totalAmountMinor, t.sourceCurrency)}</td>
                  {[t.fundingStatus, t.settlementStatus, t.payoutStatus].map((s, i) => <td key={i} className="px-4 py-3"><StageTag s={s} /></td>)}
                  <td className="px-4 py-3"><StatusPill tone={t.status.tone as Tone}>{t.state}</StatusPill></td>
                </tr>
              ))}
              {data && data.transactions.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-ink-3">No transactions found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <AnimatePresence>{sel && <Drawer tx={sel} opsKey={key} onClose={() => setSel(null)} onDone={load} />}</AnimatePresence>
    </main>
  );
}

function StageTag({ s }: { s: string }) {
  const c: Record<string, string> = { CONFIRMED: "text-ok", PENDING: "text-azure-soft", FAILED: "text-err", UNKNOWN: "text-warn", SKIPPED: "text-ink-3", NOT_STARTED: "text-ink-3" };
  return <span className={`font-mono text-[11px] ${c[s]}`}>{s.toLowerCase().replace("_", " ")}</span>;
}

function Drawer({ tx, opsKey, onClose, onDone }: { tx: OpsTx; opsKey: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const act = async (action: string) => {
    setErr(null);
    const r = await fetch(`/api/ops/transactions/${tx.id}`, { method: "POST", headers: { "content-type": "application/json", "x-ops-key": opsKey }, body: JSON.stringify({ action, note }) });
    const j = await r.json();
    if (!r.ok) setErr(j.error); else { setNote(""); onDone(); }
  };
  const review = tx.state === "MANUAL_REVIEW";
  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-canvas/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside role="dialog" aria-label={`Transaction ${tx.reference}`} className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-white/10 bg-surface p-6" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
        <div className="flex items-start justify-between">
          <div><div className="font-mono text-sm text-coral">{tx.reference}</div><div className="display mt-1 text-2xl">{tx.recipient?.displayName}</div><div className="text-sm text-ink-3">{tx.recipient?.provider} · {tx.recipient?.maskedIdentifier} · {tx.corridor?.id}</div></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><StatusPill tone={tx.status.tone as Tone}>{tx.state}</StatusPill></div>
        {tx.reviewNote && <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">{tx.reviewNote}</div>}

        <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
          {[["Sent", formatMinor(tx.sourceAmountMinor, tx.sourceCurrency)], ["Total charged", formatMinor(tx.totalAmountMinor, tx.sourceCurrency)], ["Payout", formatMinor(tx.destinationAmountMinor, tx.destinationCurrency)], ["Funding ref", tx.fundingReference ?? "—"], ["Payout ref", tx.payoutReference ?? "—"], ["Chain hash", tx.blockchainTxHash ? tx.blockchainTxHash.slice(0, 14) + "…" : "—"]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.03] p-3"><div className="text-[11px] text-ink-3">{k}</div><div className="tabular truncate font-mono text-[12.5px]">{v}</div></div>
          ))}
        </div>

        <h3 className="eyebrow mt-6">Authorized actions</h3>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input mt-2 !py-2.5 !text-sm" placeholder="Review note (required, saved to audit log)" aria-label="Review note" />
        {err && <p role="alert" className="mt-2 text-[13px] text-err">{err}</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button disabled={!review || tx.payoutStatus === "UNKNOWN"} onClick={() => act("retry_payout")} className="btn btn-ghost btn-sm" title={tx.payoutStatus === "UNKNOWN" ? "Reconcile first: outcome unknown" : ""}><RotateCcw className="h-4 w-4" /> Retry payout</button>
          <button disabled={!review} onClick={() => act("confirm_payout")} className="btn btn-ghost btn-sm"><CheckCircle2 className="h-4 w-4" /> Reconciled: paid</button>
          <button disabled={!(review || tx.state === "FUNDED")} onClick={() => act("refund")} className="btn btn-ghost btn-sm"><Undo2 className="h-4 w-4" /> Refund</button>
          <button disabled={review || ["COMPLETED", "REFUNDED", "AWAITING_AUTHORIZATION", "AWAITING_FUNDING", "QUOTE_EXPIRED", "REFUND_PENDING"].includes(tx.state)} onClick={() => act("flag")} className="btn btn-ghost btn-sm"><FlagIcon className="h-4 w-4" /> Flag for review</button>
        </div>

        <h3 className="eyebrow mt-6">Provider and audit events</h3>
        <ol className="mt-3 space-y-0 border-l border-white/10 pl-4">
          {tx.events.slice().reverse().map((e) => (
            <li key={e.id} className="relative pb-4">
              <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${e.source === "PROVIDER" || e.source === "CHAIN" ? "bg-azure-soft" : e.source === "OPS" ? "bg-coral" : "bg-ink-3"}`} />
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[12px]">{e.type}</span><span className="text-[11px] text-ink-3">{new Date(e.createdAt).toLocaleTimeString()}</span></div>
              <div className="text-[11.5px] text-ink-3">{e.source}{e.fromState ? ` · ${e.fromState} → ${e.toState}` : ""}</div>
              {Object.keys(e.payload ?? {}).length > 0 && <pre className="mt-1 overflow-x-auto rounded-lg bg-canvas/60 p-2 font-mono text-[10.5px] text-ink-2">{JSON.stringify(e.payload, null, 1)}</pre>}
            </li>
          ))}
        </ol>
      </motion.aside>
    </>
  );
}
