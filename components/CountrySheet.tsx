"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COUNTRIES, CORRIDORS, type Country } from "@/lib/corridors";
import { Flag } from "./ui";

/** S06 — country & corridor selector. Never implies a route is live just because a country is listed. */
export function CountrySheet({ open, onClose, mode, source, value, onPick }: {
  open: boolean; onClose: () => void; mode: "source" | "destination"; source?: string; value?: string; onPick: (c: Country) => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => ref.current?.focus(), 50); } }, [open]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  const list = COUNTRIES.filter((c) => (c.name + c.currency + c.code).toLowerCase().includes(q.toLowerCase()));
  const statusFor = (c: Country) => {
    if (mode === "source") return CORRIDORS.some((k) => k.source === c.code && (k.status === "SANDBOX" || k.status === "LIVE")) ? "ok" : "none";
    const k = CORRIDORS.find((x) => x.source === source && x.destination === c.code);
    if (!k || k.status === "UNAVAILABLE") return "none";
    if (k.status === "MAINTENANCE") return "maint";
    return "ok";
  };
  const avail = list.filter((c) => statusFor(c) === "ok" && c.code !== (mode === "destination" ? source : ""));
  const other = list.filter((c) => statusFor(c) !== "ok" && c.code !== (mode === "destination" ? source : ""));

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label="Choose a country"
            className="glass relative flex max-h-[85dvh] w-full max-w-md flex-col !rounded-b-none !rounded-t-[24px] sm:!rounded-[24px]"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 32 }}>
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="display text-xl">{mode === "source" ? "Sending from" : "Sending to"}</h2>
              <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/5" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative px-5 py-3">
              <Search className="absolute left-9 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} className="input !pl-11" placeholder="Search country or currency" aria-label="Search countries" />
            </div>
            <div className="overflow-y-auto px-3 pb-5">
              {avail.length > 0 && <div className="eyebrow px-2 pb-2 pt-1">Available</div>}
              {avail.map((c) => (
                <button key={c.code} onClick={() => { onPick(c); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-white/5">
                  <Flag code={c.code} size={32} />
                  <span className="flex-1"><span className="block font-medium">{c.name}</span><span className="text-[12.5px] text-ink-3">{c.currency}{c.mobileMoney.length ? " · " + c.mobileMoney.join(", ") : ""}</span></span>
                  {value === c.code && <Check className="h-5 w-5 text-coral" />}
                </button>
              ))}
              {other.length > 0 && <div className="eyebrow px-2 pb-2 pt-4">Not available {mode === "destination" ? "from here " : ""}yet</div>}
              {other.map((c) => {
                const s = statusFor(c);
                return (
                  <div key={c.code} aria-disabled="true" className="flex w-full items-center gap-3 rounded-xl px-2 py-3 opacity-50">
                    <Flag code={c.code} size={32} className="grayscale" />
                    <span className="flex-1"><span className="block font-medium">{c.name}</span><span className="text-[12.5px] text-ink-3">{s === "maint" ? "Paused for maintenance" : "Route not available"}</span></span>
                  </div>
                );
              })}
              {list.length === 0 && <div className="px-2 py-10 text-center"><p className="font-semibold">No matches found.</p><p className="text-sm text-ink-3">Try another name or country.</p></div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
