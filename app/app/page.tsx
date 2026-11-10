"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bot, ChevronRight, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useApi, relTime, saveDraft } from "@/lib/client";
import { formatMinor } from "@/lib/money";
import { COUNTRIES, country } from "@/lib/corridors";
import type { PublicTx } from "@/lib/engine";
import type { Recipient } from "@/lib/types";
import { Empty, Flag } from "@/components/ui";
import { TxRow } from "@/components/TxRow";
import { Ribbons, Sparkle, Tilt } from "@/components/fx";
import { useRouter } from "next/navigation";

type Me = { user: { id: string; phone: string; country: string } | null };

export default function Home() {
  const router = useRouter();
  const me = useApi<Me>("/api/auth/me");
  const signedIn = !!me.data?.user;
  const txs = useApi<{ transactions: PublicTx[] }>(signedIn ? "/api/transactions" : null, [signedIn]);
  const rcp = useApi<{ recipients: Omit<Recipient, "destinationIdentifier">[] }>(signedIn ? "/api/recipients" : null, [signedIn]);
  const list = txs.data?.transactions ?? [];
  const active = list.find((t) => !["COMPLETED", "REFUNDED", "FAILED", "QUOTE_EXPIRED", "AWAITING_AUTHORIZATION"].includes(t.state));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 lg:px-10 lg:pt-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-ink-3">{greet}{!me.loading && !me.data?.user ? ". You're browsing as a guest" : ""}</p>
        <h1 className="display mt-1 text-[34px] leading-[1.05] sm:text-5xl">Where are we <span className="serif-accent text-gradient-coral">sending</span> today?</h1>
      </motion.div>

      <div className="mt-7 grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <Tilt max={5}>
          <Link href="/app/send" className="ring-spin group relative block h-full min-h-[210px] overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1b47e8] via-azure to-[#06144a] p-6 shadow-[0_30px_60px_-30px_rgba(0,70,222,.9)]">
            <Ribbons className="absolute inset-0 h-full w-full opacity-60" />
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-coral/40 blur-3xl transition-transform duration-700 group-hover:scale-125" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur"><Send className="h-5 w-5" /></span>
                <ArrowUpRight className="h-6 w-6 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </div>
              <div>
                <div className="display text-3xl">Send money</div>
                <p className="mt-1 text-sm text-white/75">Choose a route, see the full cost, then confirm.</p>
              </div>
            </div>
          </Link>
        </Tilt>
        <Link href="/app/assistant" className="glass group relative flex min-h-[150px] flex-col justify-between overflow-hidden p-6">
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-coral/20 blur-2xl" />
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-coral/15 text-coral"><Bot className="h-5 w-5" /></span>
          <div className="relative">
            <div className="display flex items-center gap-2 text-xl">Ask Soko <Sparkle size={12} className="text-coral" /></div>
            <p className="mt-1 text-sm text-ink-2">“Send 200 cedis to Kofi in Lagos”</p>
          </div>
        </Link>
      </div>

      {active && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <h2 className="eyebrow mb-3">Active transfer</h2>
          <Link href={`/app/transfers/${active.id}`} className="glass flex items-center gap-4 p-4 hover:bg-white/[0.03]">
            <span className="pulse-dot grid h-3 w-3 shrink-0 place-items-center rounded-full bg-azure-soft text-azure-soft" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{active.recipient?.displayName} · <span className="tabular">{formatMinor(active.destinationAmountMinor, active.destinationCurrency)}</span></div>
              <div className="text-sm text-ink-3">{active.status.label} · {active.reference}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-ink-3" />
          </Link>
        </motion.div>
      )}

      {(rcp.data?.recipients.length ?? 0) > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between"><h2 className="eyebrow">Send again</h2><Link href="/app/recipients" className="text-sm text-ink-3 hover:text-ink">All</Link></div>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
            {rcp.data!.recipients.map((r, i) => {
              const c = country(r.destinationCountry);
              return (
                <motion.button key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => { saveDraft({ destination: r.destinationCountry, recipient: { displayName: r.displayName, nickname: r.nickname, payoutMethod: r.payoutMethod, provider: r.provider, identifier: "", savedRecipientId: r.id, masked: r.maskedIdentifier }, step: 1 }); router.push("/app/send"); }}
                  className="glass flex w-[132px] shrink-0 flex-col items-center gap-2 p-4 text-center hover:bg-white/[0.04]">
                  <span className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-coral to-coral-deep font-bold text-canvas">
                    {r.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    {c && <Flag code={c.code} size={18} className="absolute -bottom-1 -right-1" />}
                  </span>
                  <span className="w-full truncate text-sm font-medium">{r.nickname || r.displayName}</span>
                  <span className="font-mono text-[10px] text-ink-3">{r.maskedIdentifier}</span>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between"><h2 className="eyebrow">Recent activity</h2>{list.length > 0 && <Link href="/app/activity" className="text-sm text-ink-3 hover:text-ink">See all</Link>}</div>
        {!signedIn && !me.loading ? (
          <Empty title="Your first transfer starts here." body="Send money across borders and track every step." action={<Link href="/app/send" className="btn btn-primary">Send money <ArrowRight className="h-4 w-4" /></Link>} />
        ) : txs.loading || me.loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px]" />)}</div>
        ) : list.length === 0 ? (
          <Empty title="Your first transfer starts here." body="Send money across borders and track every step." action={<Link href="/app/send" className="btn btn-primary">Send money <ArrowRight className="h-4 w-4" /></Link>} />
        ) : (
          <div className="glass divide-y divide-white/5 overflow-hidden">
            {list.slice(0, 5).map((t) => <TxRow key={t.id} t={t} />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="eyebrow mb-3">Where you can send</h2>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {COUNTRIES.map((c) => <span key={c.code} className="chip !h-9 shrink-0 !text-[12px]"><Flag code={c.code} size={18} />{c.name}</span>)}
        </div>
      </section>
    </div>
  );
}

