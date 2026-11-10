"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Send, Trash2, Users } from "lucide-react";
import { api, saveDraft, useApi } from "@/lib/client";
import { country } from "@/lib/corridors";
import type { Recipient } from "@/lib/types";
import { Empty, Flag } from "@/components/ui";

type R = Omit<Recipient, "destinationIdentifier">;

export default function Recipients() {
  const router = useRouter();
  const me = useApi<{ user: unknown }>("/api/auth/me");
  const { data, loading, reload } = useApi<{ recipients: R[] }>(me.data?.user ? "/api/recipients" : null, [!!me.data?.user]);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<R | null>(null);
  const groups = useMemo(() => {
    const g = new Map<string, R[]>();
    for (const r of data?.recipients ?? []) {
      if (q && !(r.displayName + (r.nickname ?? "")).toLowerCase().includes(q.toLowerCase())) continue;
      g.set(r.destinationCountry, [...(g.get(r.destinationCountry) ?? []), r]);
    }
    return [...g.entries()];
  }, [data, q]);

  const pay = (r: R) => {
    saveDraft({ destination: r.destinationCountry, step: 1, recipient: { displayName: r.displayName, nickname: r.nickname, payoutMethod: r.payoutMethod, provider: r.provider, identifier: "", savedRecipientId: r.id, masked: r.maskedIdentifier } });
    router.push("/app/send");
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pt-6 lg:pt-10">
      <div className="flex items-end justify-between">
        <h1 className="display text-[34px]">Recipients</h1>
        <Link href="/app/send" className="btn btn-ghost btn-sm"><Plus className="h-4 w-4" /> Add recipient</Link>
      </div>
      {!me.loading && !me.data?.user ? (
        <div className="mt-6"><Empty icon={<Users className="h-6 w-6" />} title="Sign in to see your recipients." body="People you've saved will appear here." action={<Link href="/signin?next=/app/recipients" className="btn btn-primary">Sign in</Link>} /></div>
      ) : (
        <>
          <div className="relative mt-5">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input !rounded-full !pl-11" placeholder="Search recipients" aria-label="Search recipients" />
          </div>
          <div className="mt-6 space-y-6">
            {loading || me.loading ? [0, 1, 2].map((i) => <div key={i} className="skeleton h-[72px]" />)
              : (data?.recipients.length ?? 0) === 0 ? <Empty icon={<Users className="h-6 w-6" />} title="No recipients yet." body="People you've saved will appear here." action={<Link href="/app/send" className="btn btn-primary"><Plus className="h-4 w-4" /> Add recipient</Link>} />
              : groups.length === 0 ? <Empty title="No matches found." body="Try another name or country." />
              : groups.map(([cc, list]) => {
                const c = country(cc);
                return (
                  <section key={cc}>
                    <h2 className="eyebrow mb-2 flex items-center gap-2"><Flag code={cc} size={14} /> {c?.name}</h2>
                    <div className="glass divide-y divide-white/5 overflow-hidden">
                      <AnimatePresence>
                        {list.map((r) => (
                          <motion.div key={r.id} layout exit={{ opacity: 0, x: -30 }} className="flex items-center gap-3 p-4">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral to-coral-deep font-bold text-canvas">{r.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{r.displayName}{r.nickname && <span className="text-ink-3"> · {r.nickname}</span>}</div>
                              <div className="truncate font-mono text-[12px] text-ink-3">{r.provider} · {r.maskedIdentifier}</div>
                            </div>
                            <button onClick={() => pay(r)} className="btn btn-primary btn-sm" aria-label={`Send to ${r.displayName}`}><Send className="h-4 w-4" /><span className="hidden sm:inline">Send</span></button>
                            <button onClick={() => setConfirm(r)} className="grid h-10 w-10 place-items-center rounded-full text-ink-3 hover:bg-err/10 hover:text-err" aria-label={`Remove ${r.displayName}`}><Trash2 className="h-4 w-4" /></button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </section>
                );
              })}
          </div>
        </>
      )}
      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-[70] grid place-items-center p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={() => setConfirm(null)} />
            <motion.div role="alertdialog" aria-modal="true" aria-labelledby="del-t" className="glass relative w-full max-w-sm !rounded-[24px] p-6" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}>
              <h2 id="del-t" className="display text-xl">Remove {confirm.displayName}?</h2>
              <p className="mt-2 text-sm text-ink-2">They'll be removed from your saved list. Past transfers and receipts won't change.</p>
              <div className="mt-5 flex gap-2">
                <button className="btn btn-ghost flex-1" onClick={() => setConfirm(null)} autoFocus>Cancel</button>
                <button className="btn flex-1 bg-err text-canvas" onClick={async () => { await api(`/api/recipients?id=${confirm.id}`, { method: "DELETE" }); setConfirm(null); reload(); }}>Remove</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
