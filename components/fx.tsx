"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, animate } from "framer-motion";

export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`aurora ${className}`}>
      <i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" />
    </div>
  );
}

export function Sparkle({ size = 24, className = "", color = "currentColor" }: { size?: number; className?: string; color?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={`sparkle ${className}`}>
      <path d="M12 0c.8 6.6 4.4 10.4 12 12-7.6 1.6-11.2 5.4-12 12-.8-6.6-4.4-10.4-12-12C7.6 10.4 11.2 6.6 12 0Z" fill={color} />
    </svg>
  );
}

export function Marquee({ items, duration = 40, reverse = false, className = "" }: { items: React.ReactNode[]; duration?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden>
      <div className={`marquee ${reverse ? "marquee-rev" : ""}`} style={{ ["--dur" as string]: `${duration}s` }}>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {items.map((it, i) => <div key={i} className="shrink-0">{it}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Light ribbons — layered glowing curves that draw in, then sway (video: "handoffs" panel streaks). */
export function Ribbons({ className = "" }: { className?: string }) {
  const paths = [
    "M-50 420 C 200 260, 420 520, 700 300 S 1100 120, 1400 260",
    "M-50 460 C 240 320, 460 560, 720 340 S 1080 170, 1400 300",
    "M-50 500 C 260 380, 500 600, 760 380 S 1060 220, 1400 340",
    "M-50 380 C 180 220, 380 470, 660 260 S 1120 80, 1400 220",
  ];
  const strokes = ["url(#rb-coral)", "url(#rb-azure)", "url(#rb-azure)", "url(#rb-coral)"];
  return (
    <svg aria-hidden viewBox="0 0 1400 700" preserveAspectRatio="xMidYMid slice" className={`pointer-events-none ${className}`}>
      <defs>
        <linearGradient id="rb-coral" x1="0" x2="1"><stop offset="0" stopColor="#feb192" stopOpacity="0" /><stop offset=".45" stopColor="#feb192" /><stop offset=".7" stopColor="#ffe5d8" /><stop offset="1" stopColor="#feb192" stopOpacity="0" /></linearGradient>
        <linearGradient id="rb-azure" x1="0" x2="1"><stop offset="0" stopColor="#4d7cff" stopOpacity="0" /><stop offset=".5" stopColor="#4d7cff" /><stop offset=".8" stopColor="#c9d7ff" /><stop offset="1" stopColor="#0046de" stopOpacity="0" /></linearGradient>
        <filter id="rb-glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g filter="url(#rb-glow)" fill="none">
        {paths.map((d, i) => (
          <path key={i} d={d} stroke={strokes[i]} strokeWidth={i % 2 ? 1.2 : 2.2} className="ribbon" style={{ animationDelay: `${i * 0.25}s, ${3.2 + i * 0.6}s` }} opacity={0.9 - i * 0.12} />
        ))}
      </g>
    </svg>
  );
}

/** Particle sphere with a sparkle core (video frame 4). Canvas, DPR-aware, pauses offscreen. */
export function ParticleGlobe({ size = 420, className = "" }: { size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const N = 1400;
    const pts: { x: number; y: number; z: number; c: string; s: number }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const jitter = 1 + (Math.random() - 0.5) * 0.18;
      pts.push({ x: Math.cos(th) * r * jitter, y: y * jitter, z: Math.sin(th) * r * jitter, c: Math.random() < 0.55 ? "254,177,146" : Math.random() < 0.6 ? "120,150,255" : "255,255,255", s: Math.random() * 1.2 + 0.4 });
    }
    let raf = 0, t = 0, visible = true, w = 0;
    const resize = () => { w = cv.clientWidth; cv.width = w * dpr; cv.height = w * dpr; };
    resize();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(cv);
    window.addEventListener("resize", resize);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      t += reduce ? 0 : 0.0035;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, w);
      const R = w * 0.36, cx = w / 2, cy = w / 2;
      const cosA = Math.cos(t), sinA = Math.sin(t), tilt = 0.42, cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      for (const p of pts) {
        const breathe = 1 + Math.sin(t * 6 + p.y * 4) * 0.035;
        let x = p.x * cosA - p.z * sinA, z = p.x * sinA + p.z * cosA, y = p.y;
        const y2 = y * cosT - z * sinT; z = y * sinT + z * cosT; y = y2;
        const depth = (z + 1.2) / 2.2;
        const px = cx + x * R * breathe, py = cy + y * R * breathe;
        ctx.fillStyle = `rgba(${p.c},${0.15 + depth * 0.8})`;
        ctx.beginPath(); ctx.arc(px, py, p.s * (0.5 + depth), 0, Math.PI * 2); ctx.fill();
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
      g.addColorStop(0, "rgba(255,240,230,.55)"); g.addColorStop(0.4, "rgba(254,177,146,.12)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    };
    draw();
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", resize); };
  }, [reduce]);
  return (
    <div className={`relative ${className}`} style={{ width: "100%", maxWidth: size, aspectRatio: "1" }}>
      <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 grid place-items-center"><Sparkle size={34} color="#fff" /></div>
    </div>
  );
}

/** Pointer-tilt wrapper with spring physics. */
export function Tilt({ children, max = 12, className = "" }: { children: React.ReactNode; max?: number; className?: string }) {
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 120, damping: 14 });
  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
    >{children}</motion.div>
  );
}

/** Animated count-up for money values (display only; value is already exact). */
export function CountUp({ value, format, className = "" }: { value: number; format: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const reduce = useReducedMotion();
  const prev = useRef(value);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const c = animate(prev.current, value, { duration: 0.7, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]);
  return <span className={`tabular ${className}`} aria-live="polite">{format(shown)}</span>;
}

/** Fade/slide in when scrolled into view. */
export function Reveal({ children, delay = 0, className = "", y = 24 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y, filter: "blur(6px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** Split headline: each word rises in. */
export function RiseText({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom" aria-hidden>
          <motion.span className="inline-block" initial={{ y: "110%", rotate: 4 }} animate={{ y: 0, rotate: 0 }} transition={{ duration: 0.9, delay: delay + i * 0.07, ease: [0.22, 1, 0.36, 1] }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}
