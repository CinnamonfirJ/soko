"use client";
import Link from "next/link";
import { relTime } from "@/lib/client";
import { formatMinor } from "@/lib/money";
import { country } from "@/lib/corridors";
import type { PublicTx } from "@/lib/engine";
import { Flag, StatusPill, type Tone } from "./ui";

export function TxRow({ t }: { t: PublicTx }) {
  const c = country(t.recipient?.destinationCountry ?? "");
  return (
    <Link href={`/app/transfers/${t.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.03]">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated font-semibold text-coral ring-1 ring-white/10">
        {t.recipient?.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        {c && <Flag code={c.code} size={16} className="absolute -bottom-0.5 -right-0.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t.recipient?.displayName}</div>
        <div className="truncate text-[12.5px] text-ink-3">{relTime(t.createdAt)} · {t.reference}</div>
      </div>
      <div className="text-right">
        <div className="tabular text-sm font-semibold">{formatMinor(t.destinationAmountMinor, t.destinationCurrency)}</div>
        <div className="mt-1"><StatusPill tone={t.status.tone as Tone}>{t.status.label}</StatusPill></div>
      </div>
    </Link>
  );
}
