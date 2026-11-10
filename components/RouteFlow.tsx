"use client";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Wallet, ShieldCheck, Coins, Smartphone, CheckCheck } from "lucide-react";

const NODES = [
  { icon: Wallet, title: "You pay", tag: "bank · card · momo", x: 70, y: 150 },
  { icon: ShieldCheck, title: "Payment verified", tag: "provider webhook", x: 260, y: 70 },
  { icon: Coins, title: "Moves as USDT", tag: "tether rail", x: 460, y: 170 },
  { icon: Smartphone, title: "Mobile money payout", tag: "MTN · M-Pesa · bank", x: 660, y: 80 },
  { icon: CheckCheck, title: "Money delivered", tag: "payout confirmed", x: 850, y: 160 },
];

/** Node-graph of the money path with glowing connectors and a travelling pulse (video: "handoffs" panel). */
export function RouteFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-80px" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setActive((a) => (a + 1) % NODES.length), 1400);
    return () => clearInterval(t);
  }, [inView, reduce]);
  const path = NODES.map((n, i) => {
    if (i === 0) return `M ${n.x} ${n.y}`;
    const p = NODES[i - 1];
    const mx = (p.x + n.x) / 2;
    return `C ${mx} ${p.y}, ${mx} ${n.y}, ${n.x} ${n.y}`;
  }).join(" ");
  return (
    <div ref={ref} className="relative">
      <div className="no-scrollbar overflow-x-auto">
        <div className="relative mx-auto h-[260px] w-[920px]">
          <svg viewBox="0 0 920 260" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="rf" x1="0" x2="1"><stop offset="0" stopColor="#4d7cff" /><stop offset=".5" stopColor="#feb192" /><stop offset="1" stopColor="#38c996" /></linearGradient>
              <filter id="rf-glow"><feGaussianBlur stdDeviation="4" /></filter>
            </defs>
            <path d={path} stroke="url(#rf)" strokeWidth="6" fill="none" opacity=".35" filter="url(#rf-glow)" />
            <path d={path} stroke="url(#rf)" strokeWidth="1.5" fill="none" className="flow-dash" />
            {!reduce && (
              <circle r="5" fill="#fff" style={{ filter: "drop-shadow(0 0 8px #feb192)" }}>
                <animateMotion dur="7s" repeatCount="indefinite" path={path} />
              </circle>
            )}
          </svg>
          {NODES.map((n, i) => {
            const Icon = n.icon;
            const on = i === active;
            return (
              <motion.div key={n.title} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: n.x, top: n.y }} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.6 }}>
                <div className={`glass flex w-[170px] items-center gap-3 p-3 transition-all duration-500 ${on ? "scale-105 shadow-[0_0_0_1px_rgba(254,177,146,.6),0_0_40px_-4px_rgba(254,177,146,.6)]" : ""}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-500 ${on ? "bg-coral text-canvas" : "bg-white/5 text-coral"}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-tight">{n.title}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-ink-3">{n.tag}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
