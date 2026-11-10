"use client";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Lock, MessageCircle } from "lucide-react";
import { Sparkle } from "./fx";

type Bubble = { me?: boolean; body: React.ReactNode; time: string };

const SCRIPT: Bubble[] = [
  { me: true, time: "09:41", body: "Send R500 to my brother Tendai in Harare" },
  {
    time: "09:41",
    body: (
      <>
        Got it. A transfer to Tendai in Zimbabwe.
        <div className="mt-2 space-y-0.5 text-[12.5px] text-white/75">
          <div>Amount: <b className="text-white">R500.00</b></div>
          <div>Route: South Africa → Zimbabwe</div>
          <div>Payout: EcoCash</div>
        </div>
        <div className="mt-3 rounded-xl bg-white/10 p-2.5">
          <div className="text-[11px] text-white/60">sokobot.app</div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Lock className="h-3.5 w-3.5" /> Review rate &amp; confirm</div>
        </div>
      </>
    ),
  },
  { me: true, time: "09:42", body: "Done ✅" },
  {
    time: "09:44",
    body: (
      <>
        <span className="font-semibold">Money delivered.</span> Tendai received <b>ZiG 744.45</b> on EcoCash.
        <div className="mt-1 font-mono text-[11px] text-white/60">Ref SK-7QH2-MX4P</div>
      </>
    ),
  },
];

/** Animated WhatsApp conversation in a phone frame. */
export function WhatsAppDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-120px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? SCRIPT.length : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= SCRIPT.length) clearInterval(t);
    }, 1300);
    return () => clearInterval(t);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[340px]">
      <div className="absolute -inset-10 rounded-full bg-ok/15 blur-3xl" aria-hidden />
      <div className="relative overflow-hidden rounded-[38px] border border-white/15 bg-[#0b141a] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,.9)]">
        <div className="overflow-hidden rounded-[30px] bg-[#0b141a]">
          {/* header */}
          <div className="flex items-center gap-3 bg-[#1f2c34] px-4 pb-3 pt-5">
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-azure to-[#0b1a52]">
              <Sparkle size={14} className="text-coral" />
            </span>
            <div className="flex-1">
              <div className="text-[14px] font-semibold">SokoBot</div>
              <div className="text-[11px] text-white/55">business account</div>
            </div>
            <MessageCircle className="h-5 w-5 text-ok" />
          </div>
          {/* chat */}
          <div className="min-h-[420px] space-y-2.5 px-3 py-4" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "14px 14px" }} aria-live="polite">
            {SCRIPT.slice(0, shown).map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={`flex ${b.me ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug ${b.me ? "rounded-br-sm bg-[#005c4b]" : "rounded-bl-sm bg-[#1f2c34]"}`}>
                  {b.body}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/45">{b.time}{b.me && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}</div>
                </div>
              </motion.div>
            ))}
            {shown < SCRIPT.length && shown > 0 && !SCRIPT[shown]?.me && (
              <div className="flex gap-1 px-2 pt-1" aria-hidden>
                {[0, 1, 2].map((k) => <motion.span key={k} className="h-1.5 w-1.5 rounded-full bg-white/50" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: k * 0.15 }} />)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 bg-[#1f2c34] px-3 py-2.5">
            <div className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-[13px] text-white/40">Message</div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#00a884]"><Check className="h-4 w-4" /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
