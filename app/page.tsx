"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Bot, Eye, Lock, MessageCircle, Receipt, ShieldCheck, Zap } from "lucide-react";
import { Aurora, Marquee, ParticleGlobe, Reveal, Ribbons, RiseText, Sparkle, Tilt } from "@/components/fx";
import { HeroStage } from "@/components/HeroCard";
import { RouteFlow } from "@/components/RouteFlow";
import { WhatsAppDemo } from "@/components/WhatsAppDemo";
import { Flag, Logo } from "@/components/ui";
import { CORRIDORS, COUNTRIES } from "@/lib/corridors";

const CITIES = ["Lagos", "Accra", "Nairobi", "Kampala", "Dar es Salaam", "Dakar", "Kigali", "Abuja", "Kumasi", "Mombasa", "Harare", "Johannesburg"];

export default function Landing() {
  return (
    <main className="relative overflow-hidden">
      {/* ── NAV ───────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full border border-white/10 bg-canvas/50 px-3 py-2 pl-4 backdrop-blur-xl sm:mt-4">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#routes" className="hover:text-ink">Routes</a>
            <a href="#assistant" className="hover:text-ink">Ask Soko</a>
            <a href="#whatsapp" className="hover:text-ink">WhatsApp</a>
            <Link href="/app/support" className="hover:text-ink">Help</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/signin" className="btn btn-ghost btn-sm hidden sm:inline-flex">Sign in</Link>
            <Link href="/app/send" className="btn btn-primary btn-sm">Send money <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────── */}
      <section className="relative min-h-[100dvh] pt-32 sm:pt-36">
        <Aurora />
        <div className="grid-fade absolute inset-0" />
        <Ribbons className="absolute inset-x-0 top-[30%] h-[60%] w-full opacity-70" />

        {/* giant marquee behind the card (video: "level · Template · Design" band) */}
        <div className="pointer-events-none absolute inset-x-0 top-[52%] -translate-y-1/2 opacity-[0.09] sm:top-[56%]">
          <Marquee duration={60} items={CITIES.map((c) => (
            <span key={c} className="display flex items-center whitespace-nowrap px-6 text-[90px] leading-none sm:text-[150px]">{c}<Sparkle size={40} className="ml-12 text-coral" /></span>
          ))} />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="chip mx-auto !h-8 !px-3">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-coral text-coral" />
            Cross-border payments, made for Africa
          </motion.div>
          <h1 className="display mx-auto mt-6 max-w-4xl text-[44px] leading-[0.98] sm:text-[76px] lg:text-[96px]">
            <RiseText text="Money moves." />
            <br />
            <span className="serif-accent text-gradient-coral pr-2 text-[52px] sm:text-[88px] lg:text-[112px]"><RiseText text="Borders don't." delay={0.25} /></span>
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.8 }} className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2 sm:text-lg">
            Send money to the people who matter, to their mobile money or bank. See the exact rate, every fee and what they get <em className="serif-accent text-[1.15em] text-ink not-italic">before</em> you pay.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6 }} className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/app/send" className="btn btn-primary w-full px-7 sm:w-auto">Send money <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/app/assistant" className="btn btn-ghost w-full sm:w-auto"><Bot className="h-4 w-4 text-coral" /> Ask Soko</Link>
          </motion.div>
        </div>

        <div className="relative mx-auto mt-10 max-w-5xl">
          <HeroStage />
        </div>
      </section>

      {/* ── TRUST STRIP ───────────────────────────── */}
      <section className="relative border-y border-white/5 bg-white/[0.015] py-5">
        <Marquee duration={45} reverse items={[
          [Eye, "Every fee shown up front"], [ShieldCheck, "Regulated payment partners"], [Lock, "You confirm every payment"], [Receipt, "Receipts only after confirmed payout"], [Zap, "Mobile money in minutes, where supported"], [MessageCircle, "Send straight from WhatsApp"], [MessageCircle, "Human support when needed"],
        ].map(([I, t], i) => {
          const Icon = I as React.ElementType;
          return <span key={i} className="flex items-center gap-2.5 whitespace-nowrap px-8 text-sm text-ink-2"><Icon className="h-4 w-4 text-coral" />{t as string}<Sparkle size={8} className="ml-8 text-ink-3" /></span>;
        })} />
      </section>

      {/* ── HOW IT WORKS ──────────────────────────── */}
      <section id="how" className="relative py-24 sm:py-32">
        <div className="pointer-events-none absolute left-1/2 top-20 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-azure/20 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="eyebrow">● How your money travels</div>
            <h2 className="display mt-4 max-w-3xl text-4xl leading-[1.02] sm:text-6xl">
              Every step, <span className="serif-accent text-gradient-azure">confirmed</span>. No step <span className="serif-accent text-coral">assumed.</span>
            </h2>
            <p className="mt-4 max-w-xl text-ink-2">We only mark a step done after the provider confirms it. A blockchain confirmation isn't "delivered", and a browser redirect isn't "paid".</p>
          </Reveal>
          <Reveal delay={0.1} className="mt-12">
            <RouteFlow />
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Tell us where it's going", d: "Pick the countries and amount, or just type “send 50,000 naira to my sister in Accra”." },
              { n: "02", t: "See the real numbers", d: "Rate, every fee, total to pay and what they receive. Quotes expire, so nothing changes behind your back." },
              { n: "03", t: "Confirm and follow it", d: "You authorize the exact transfer. Then follow each verified step until the payout is confirmed." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <Tilt max={6} className="h-full">
                  <div className="glass group h-full overflow-hidden p-6">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-coral/0 blur-2xl transition-colors duration-700 group-hover:bg-coral/25" />
                    <div className="font-mono text-xs text-coral">{s.n}</div>
                    <h3 className="display mt-6 text-xl">{s.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.d}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROUTES MOSAIC ─────────────────────────── */}
      <section id="routes" className="relative overflow-hidden py-24 sm:py-28">
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="eyebrow">● Routes</div>
              <h2 className="display mt-4 text-4xl leading-[1.02] sm:text-6xl">Local money, <span className="serif-accent text-gradient-coral">both ends.</span></h2>
            </div>
            <p className="max-w-sm text-ink-2">We only show a route as available when it really is. Routes still being approved are clearly marked.</p>
          </Reveal>
        </div>
        <div className="mosaic-stage relative mt-10 h-[460px] sm:h-[520px]">
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,#010511_75%)]" />
          <div className="mosaic absolute inset-x-[-20%] top-0 flex flex-col gap-4">
            {[0, 1, 2, 3].map((row) => (
              <Marquee key={row} duration={50 + row * 12} reverse={row % 2 === 1} items={[...CORRIDORS, ...CORRIDORS].slice(row, row + 8).map((c, i) => {
                const s = COUNTRIES.find((x) => x.code === c.source)!, d = COUNTRIES.find((x) => x.code === c.destination)!;
                const live = c.status === "SANDBOX" || c.status === "LIVE";
                return (
                  <div key={i} className="glass mx-2 w-[260px] p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Flag code={s.code} size={26} /><span className="text-sm text-ink-3">→</span><Flag code={d.code} size={26} /></span>
                      <span className={`chip !h-6 ${live ? "!text-ok !border-ok/30" : c.status === "MAINTENANCE" ? "!text-warn !border-warn/30" : ""}`}>{live ? "available" : c.status === "MAINTENANCE" ? "paused" : "coming later"}</span>
                    </div>
                    <div className="display mt-4 text-lg">{s.name} → {d.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-ink-3">{c.sourceCurrency} → {c.destinationCurrency}{c.settlement ? ` · via ${c.settlement.stablecoin}` : " · direct rail"}</div>
                  </div>
                );
              })} />
            ))}
          </div>
        </div>
      </section>

      {/* ── ASSISTANT ─────────────────────────────── */}
      <section id="assistant" className="relative py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal className="relative order-2 mx-auto w-full max-w-[460px] lg:order-1">
            <div className="absolute inset-0 rounded-full bg-coral/10 blur-3xl" />
            <ParticleGlobe />
          </Reveal>
          <div className="order-1 lg:order-2">
            <Reveal>
              <div className="eyebrow">● Soko Assistant</div>
              <h2 className="display mt-4 text-4xl leading-[1.02] sm:text-6xl">Just say it. <span className="serif-accent text-gradient-azure">We'll fill in the form.</span></h2>
              <p className="mt-4 max-w-md text-ink-2">Type it the way you'd say it. Soko turns it into a draft you can check and edit. It never sends money from a chat message. You always confirm the exact amount and recipient yourself.</p>
            </Reveal>
            <Reveal delay={0.1} className="mt-8 space-y-3">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-azure px-4 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(0,70,222,.8)]">Send 150,000 naira to my sister Ama in Ghana</div>
              <div className="ring-spin glass w-fit max-w-[92%] rounded-2xl rounded-bl-md p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 text-coral"><Sparkle size={12} /> <span className="font-mono text-[11px]">DRAFT · not sent</span></div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
                  <span className="text-ink-3">Amount</span><span className="tabular">150,000.00 NGN</span>
                  <span className="text-ink-3">To</span><span className="flex items-center gap-1.5">Ama · Ghana <Flag code="GH" size={14} /></span>
                  <span className="text-ink-3">Payout</span><span>Pick in next step</span>
                </div>
              </div>
              <Link href="/app/assistant" className="btn btn-coral mt-2">Try Soko <ArrowRight className="h-4 w-4" /></Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── WHATSAPP ──────────────────────────────── */}
      <section id="whatsapp" className="relative py-24 sm:py-32">
        <div className="pointer-events-none absolute right-0 top-1/3 h-[420px] w-[520px] rounded-full bg-ok/10 blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
          <div>
            <Reveal>
              <div className="eyebrow">● SokoBot on WhatsApp</div>
              <h2 className="display mt-4 text-4xl leading-[1.02] sm:text-6xl">Send money from the chat <span className="serif-accent text-gradient-coral">you already use.</span></h2>
              <p className="mt-4 max-w-md text-ink-2">Message SokoBot on WhatsApp the way you'd message a friend. Soko prepares the transfer and sends back a secure link where you see the exact rate and fees and confirm. Delivery updates arrive in the same chat.</p>
            </Reveal>
            <div className="mt-8 space-y-3">
              {[
                ["01", "Message Soko", "“Send R500 to my brother Tendai in Harare”"],
                ["02", "Confirm securely", "Tap the link, check the rate, fees and recipient, and pay with EFT, card or mobile money."],
                ["03", "Get updates in the chat", "Payment received, money on the way, money delivered, each one only once it's confirmed."],
              ].map(([n, t, d], i) => (
                <Reveal key={n} delay={i * 0.08}>
                  <div className="glass flex gap-4 p-4">
                    <span className="font-mono text-xs text-coral">{n}</span>
                    <div><div className="font-semibold">{t}</div><div className="mt-0.5 text-sm text-ink-2">{d}</div></div>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-5 flex items-center gap-2 text-[12.5px] text-ink-3"><Lock className="h-3.5 w-3.5 text-ok" /> Payments are always confirmed on SokoBot's secure page. Soko will never ask for your PIN or password in WhatsApp.</p>
          </div>
          <Reveal delay={0.1}><WhatsAppDemo /></Reveal>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────── */}
      <section className="relative px-5 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-white/10 px-6 py-16 text-center sm:py-24">
          <Aurora className="opacity-80" />
          <Ribbons className="absolute inset-0 h-full w-full opacity-60" />
          <div className="relative">
            <Sparkle size={28} className="mx-auto text-coral" />
            <h2 className="display mx-auto mt-6 max-w-3xl text-4xl leading-[1.02] sm:text-6xl">The people you love are <span className="serif-accent text-gradient-coral">one tap away.</span></h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/app/send" className="btn btn-primary px-8">Send money <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/app/assistant" className="btn btn-ghost">Ask Soko</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 text-sm text-ink-3 md:flex-row md:items-center">
          <Logo />
          <p className="max-w-md text-[12.5px]">SokoBot isn't a bank and doesn't hold deposits. Money moves through regulated payment partners.</p>
          <div className="flex gap-5"><Link href="/app/support" className="hover:text-ink">Help</Link><Link href="/app/support#privacy" className="hover:text-ink">Privacy</Link><Link href="/app/support#terms" className="hover:text-ink">Terms</Link></div>
        </div>
      </footer>
    </main>
  );
}
