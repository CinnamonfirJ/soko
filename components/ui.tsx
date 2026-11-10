"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from "lucide-react";
import { Sparkle } from "./fx";

export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="SokoBot home">
      <span className="relative grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-azure via-[#2a54e8] to-[#0b1a52] shadow-[0_6px_24px_-6px_rgba(0,70,222,.9)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M5 15.5c2.5-6 11.5-6 14 0" stroke="#feb192" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="5" cy="15.5" r="2.1" fill="#fff" />
          <circle cx="19" cy="15.5" r="2.1" fill="#feb192" />
        </svg>
        <span className="absolute -right-1 -top-1 text-coral transition-transform duration-500 group-hover:rotate-90"><Sparkle size={10} /></span>
      </span>
      {!compact && <span className="display text-[19px] tracking-tight">Soko<span className="serif-accent text-coral text-[21px]">bot</span></span>}
    </Link>
  );
}

export type Tone = "ok" | "warn" | "err" | "info" | "muted";
const toneCls: Record<Tone, string> = {
  ok: "text-ok bg-ok/10 border-ok/30",
  warn: "text-warn bg-warn/10 border-warn/30",
  err: "text-err bg-err/10 border-err/30",
  info: "text-[#9db5ff] bg-azure/15 border-azure-soft/30",
  muted: "text-ink-3 bg-white/5 border-line",
};
const toneIcon: Record<Tone, React.ElementType> = { ok: CheckCircle2, warn: AlertTriangle, err: XCircle, info: CircleDashed, muted: Info };

export function StatusPill({ tone, children, pulse }: { tone: Tone; children: React.ReactNode; pulse?: boolean }) {
  const Icon = toneIcon[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${toneCls[tone]}`}>
      <Icon className={`h-3.5 w-3.5 ${pulse ? "animate-spin [animation-duration:3s]" : ""}`} aria-hidden />
      {children}
    </span>
  );
}

export function Field({ label, error, hint, id, children }: { label: string; error?: string; hint?: React.ReactNode; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-err"><XCircle className="h-3.5 w-3.5" aria-hidden />{error}</p>
      ) : hint ? <p className="mt-1.5 text-[12.5px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Steps({ step, total, labels }: { step: number; total: number; labels?: string[] }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Step ${step} of ${total}`}>
      <span className="font-mono text-[11px] tracking-widest text-ink-3">{String(step).padStart(2, "0")}/{String(total).padStart(2, "0")}</span>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-azure-soft to-coral" initial={false} animate={{ width: i < step ? "100%" : "0%" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        ))}
      </div>
      {labels && <span className="hidden text-[12px] text-ink-3 sm:inline">{labels[step - 1]}</span>}
    </div>
  );
}

export function Empty({ title, body, action, icon }: { title: string; body: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="glass relative overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-azure/30 blur-3xl" />
      <div className="relative mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-coral">{icon ?? <Sparkle size={22} />}</div>
      <h3 className="display relative text-xl">{title}</h3>
      <p className="relative mx-auto mt-1.5 max-w-xs text-sm text-ink-2">{body}</p>
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

/** SVG flag (emoji flags don't render on Windows). Decorative: country names are always shown as text nearby. */
export function Flag({ code, size = 24, className = "" }: { code: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://flagcdn.com/${code.toLowerCase()}.svg`} alt="" width={size} height={size} loading="lazy"
      className={`inline-block shrink-0 rounded-full object-cover ring-1 ring-white/15 ${className}`} style={{ width: size, height: size }} />
  );
}

export function Banner({ tone, title, children, action }: { tone: Tone; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <div role={tone === "err" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border p-4 ${toneCls[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-ink-2">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Row({ label, value, strong, hint }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="text-sm text-ink-2">{label}{hint && <div className="text-[12px] text-ink-3">{hint}</div>}</div>
      <div className={`tabular text-right ${strong ? "text-[15px] font-semibold text-ink" : "text-sm text-ink"}`}>{value}</div>
    </div>
  );
}
