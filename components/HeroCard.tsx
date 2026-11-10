"use client";
import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Tilt, Sparkle } from "./fx";
import { Flag } from "./ui";

/** The transfer "card" standing on reflective water under a glowing arch (video: closing fintech hero). */
function CardFace() {
  return (
    <div className="card-face" style={{ background: "linear-gradient(155deg, #2b5bff 0%, #0046de 30%, #0a1f7a 62%, #050b2a 100%)" }}>
      <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-coral/50 blur-3xl" />
      <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[#7aa0ff]/40 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 200 300" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i} d={`M-10 ${210 + i * 9} C 60 ${150 + i * 12}, 120 ${260 - i * 4}, 210 ${170 + i * 10}`} stroke="rgba(255,255,255,.35)" strokeWidth=".5" fill="none" />
        ))}
      </svg>
      <div className="card-sheen" />
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[9px] tracking-[0.2em] text-white/70">SOKO · TRANSFER</span>
          <div className="h-7 w-9 rounded-md bg-gradient-to-br from-[#ffe1d3] via-coral to-[#c97a5b] opacity-90 shadow-inner" />
        </div>
        <div>
          <div className="text-[10px] text-white/60">Recipient gets</div>
          <div className="display tabular text-[26px] leading-none text-white">3,272.00 <span className="text-[12px] text-coral">GHS</span></div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-white/70">
            <span className="flex items-center gap-1"><Flag code="NG" size={12} /> Lagos</span>
            <span className="relative h-px flex-1 bg-white/30"><span className="absolute -top-[3px] left-0 h-[7px] w-[7px] animate-[flowdot_2.4s_linear_infinite] rounded-full bg-coral shadow-[0_0_10px_#feb192]" /></span>
            <span className="flex items-center gap-1">Accra <Flag code="GH" size={12} /></span>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <span className="serif-accent text-[22px] text-white/90">Soko</span>
          <span className="font-mono text-[9px] text-white/50">NGN → GHS</span>
        </div>
      </div>
      <style>{`@keyframes flowdot { from { left: 0 } to { left: calc(100% - 7px) } }`}</style>
    </div>
  );
}

/** The card rises out of (and sinks back into) a stack of three glowing platforms. */
export function HeroStage() {
  const reduce = useReducedMotion();
  // Each layer drifts on its own slow cycle (different lengths + offsets), so nothing moves in lockstep.
  const z1 = useMotionValue(0);
  const z2 = useMotionValue(0);
  const z3 = useMotionValue(0);
  const dip = useMotionValue(12); // px of the card's bottom edge tucked into the pit
  useEffect(() => {
    if (reduce) { z2.set(14); z3.set(26); dip.set(12); return; }
    const soft = { ease: "easeInOut" as const, repeat: Infinity, repeatType: "mirror" as const };
    const cs = [
      animate(z1, [0, 7], { ...soft, duration: 7.5 }),
      animate(z2, [2, 22], { ...soft, duration: 5.8, delay: 0.4 }),
      animate(z3, [4, 40], { ...soft, duration: 4.9, delay: 0.9 }),
      // Card breathes out of phase with the platforms: it lifts while they settle and vice versa.
      animate(dip, [20, 6], { ...soft, duration: 6.6, delay: 0.2 }),
    ];
    return () => cs.forEach((c) => c.stop());
  }, [reduce, z1, z2, z3, dip]);

  // Screen-space height of the pit's front lip, measured from the stage bottom.
  const LIP = 110;
  const lipBottom = useTransform(z3, (z) => LIP + z * 0.9);
  const cardBottom = useTransform(dip, (d) => -d);
  const glow = useTransform(z3, [4, 40], [0.7, 1]);

  return (
    <div className="relative mx-auto h-[540px] w-full max-w-[1000px] sm:h-[600px]" aria-hidden>
      <div className="arch" />

      {/* light beam rising from the pit */}
      <motion.div className="plat-beam" style={{ bottom: lipBottom, height: 320, opacity: glow }} />

      {/* the three platforms */}
      <div className="plat-scene absolute bottom-[24px] left-1/2 h-[250px] w-[min(92vw,460px)] -translate-x-1/2">
        <div className="plat-plane">
          <motion.div className="plat plat-1" style={{ z: z1 }} />
          <motion.div className="plat plat-2" style={{ z: z2 }} />
          <motion.div className="plat plat-3" style={{ z: z3, opacity: glow }} />
        </div>
      </div>

      {/* card, clipped at the pit's front lip so it looks like it goes inside */}
      <motion.div className="absolute inset-x-0 top-0" style={{ bottom: lipBottom, clipPath: "inset(-60px -40% 0 -40%)" }}>
        <motion.div className="card3d-stage absolute left-1/2 -translate-x-1/2" style={{ bottom: cardBottom }}>
          <Tilt max={14}>
            <motion.div
              className="card3d relative h-[300px] w-[200px] sm:h-[340px] sm:w-[226px]"
              initial={{ rotateY: -70, rotateX: 20, opacity: 0, scale: 0.8 }}
              animate={reduce ? { opacity: 1, rotateY: -12, rotateX: 4, scale: 1 } : { opacity: 1, scale: 1, rotateX: [6, 2, 6], rotateY: [-18, 14, -18] }}
              transition={reduce ? { duration: 0.4 } : { opacity: { duration: 0.9 }, scale: { duration: 1.2, ease: [0.22, 1, 0.36, 1] }, rotateX: { duration: 9, repeat: Infinity, ease: "easeInOut" }, rotateY: { duration: 9, repeat: Infinity, ease: "easeInOut" } }}
              style={{ filter: "drop-shadow(0 30px 50px rgba(0,30,120,.55))" }}
            >
              <CardFace />
            </motion.div>
          </Tilt>
        </motion.div>
        {/* light from the pit washing over the card's lower edge */}
        <motion.div className="pit-spill" style={{ opacity: glow }} />
      </motion.div>

      {/* glowing front rim of the pit, drawn over the card */}
      <motion.div className="pit-lip w-[min(64vw,318px)]" style={{ bottom: lipBottom }} />

      {/* floating satellites, one each side, level with each other */}
      <motion.div className="glass absolute left-[3%] top-[30%] hidden w-48 p-3.5 md:block" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0, y: [0, 8, 0] }} transition={{ delay: 1, duration: 0.8, y: { duration: 7, repeat: Infinity, ease: "easeInOut" } }}>
        <div className="eyebrow !text-[9px]">Exchange rate</div>
        <div className="tabular mt-1 text-sm font-semibold">1 NGN = 0.00935 GHS</div>
        <div className="mt-1 text-[11px] text-ink-3">Shown before you pay</div>
      </motion.div>
      <motion.div className="glass absolute right-[3%] top-[30%] hidden w-48 p-3.5 md:block" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0, y: [0, -8, 0] }} transition={{ delay: 1.2, duration: 0.8, y: { duration: 8, repeat: Infinity, ease: "easeInOut" } }}>
        <div className="flex items-center gap-2 text-[12px] font-semibold text-ok"><span className="pulse-dot h-2 w-2 rounded-full bg-ok text-ok" /> Payout confirmed</div>
        <div className="mt-1 text-[11px] text-ink-3">Only after the provider confirms it</div>
      </motion.div>
      <span className="absolute right-[20%] top-[4%] text-coral"><Sparkle size={22} /></span>
      <span className="absolute left-[18%] top-[58%] text-azure-soft"><Sparkle size={14} /></span>
    </div>
  );
}
