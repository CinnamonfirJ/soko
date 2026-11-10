"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { useApi } from "@/lib/client";
import type { PublicTx } from "@/lib/engine";
import { Empty } from "@/components/ui";
import { TxRow } from "@/components/TxRow";

const FILTERS = [
  { k: "all", l: "All" },
  { k: "progress", l: "In progress", f: (t: PublicTx) => !["COMPLETED", "FAILED", "REFUNDED", "QUOTE_EXPIRED", "MANUAL_REVIEW", "AWAITING_AUTHORIZATION"].includes(t.state) },
  { k: "done", l: "Delivered", f: (t: PublicTx) => t.state === "COMPLETED" },
  { k: "attention", l: "Needs attention", f: (t: PublicTx) => ["FAILED", "MANUAL_REVIEW", "REFUND_PENDING", "REFUNDED"].includes(t.state) },
];

export default function Activity() {
  const me = useApi<{ user: unknown }>("/api/auth/me");
  const { data, loading } = useApi<{ transactions: PublicTx[] }>(me.data?.user ? "/api/transactions" : null, [!!me.data?.user]);
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const groups = useMemo(() => {
    const flt = FILTERS.find((x) => x.k === f)?.f;
    const list = (data?.transactions ?? []).filter((t) => (!flt || flt(t)) && (!q || (t.reference + (t.recipient?.displayName ?? "")).toLowerCase().includes(q.toLowerCase())));
    const g = new Map<string, PublicTx[]>();
    for (const t of list) {
      const d = new Date(t.createdAt);
      const today = new Date(); const yest = new Date(Date.now() - 864e5);
      const key = d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === yest.toDateString() ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      g.set(key, [...(g.get(key) ?? []), t]);
    }
    return [...g.entries()];
  }, [data, q, f]);

  return (
    <div className="mx-auto max-w-3xl px-5 pt-6 lg:pt-10">
      <h1 className="display text-[34px]">Activity</h1>
      {!me.loading && !me.data?.user ? (
        <div className="mt-6"><Empty title="Sign in to see your transfers." body="Every transfer and its verified status lives here." action={<Link href="/signin?next=/app/activity" className="btn btn-primary">Sign in</Link>} /></div>
      ) : (
        <>
          <div className="relative mt-5">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input !rounded-full !pl-11" placeholder="Search by name or reference" aria-label="Search transfers" />
          </div>
          <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5" role="tablist">
            {FILTERS.map((x) => (
              <button key={x.k} role="tab" aria-selected={f === x.k} onClick={() => setF(x.k)} className={`relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${f === x.k ? "text-canvas" : "text-ink-2 hover:text-ink"}`}>
                {f === x.k && <motion.span layoutId="act-filter" className="absolute inset-0 rounded-full bg-coral" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className="relative font-medium">{x.l}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-6">
            {loading || me.loading ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[72px]" />)
              : groups.length === 0 ? (
                (data?.transactions.length ?? 0) === 0
                  ? <Empty title="Your first transfer starts here." body="Send money across borders and track every step." action={<Link href="/app/send" className="btn btn-primary">Send money <ArrowRight className="h-4 w-4" /></Link>} />
                  : <Empty title="No matches found." body="Try another name or reference." />
              ) : groups.map(([day, list], gi) => (
                <motion.section key={day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05 }}>
                  <h2 className="eyebrow mb-2">{day}</h2>
                  <div className="glass divide-y divide-white/5 overflow-hidden">{list.map((t) => <TxRow key={t.id} t={t} />)}</div>
                </motion.section>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
