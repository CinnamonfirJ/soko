"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, FileText, LifeBuoy, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { country } from "@/lib/corridors";
import { Empty, Flag, StatusPill } from "@/components/ui";
import { Ribbons } from "@/components/fx";

type U = { id: string; phone: string; country: string; verificationStatus: string; createdAt: string };

export default function Profile() {
  const router = useRouter();
  const { data, loading } = useApi<{ user: U | null }>("/api/auth/me");
  const u = data?.user;
  const [notif, setNotif] = useState(true);
  useEffect(() => { try { setNotif(localStorage.getItem("soko_notif") !== "off"); } catch {} }, []);
  if (loading) return <div className="mx-auto max-w-2xl px-5 pt-10"><div className="skeleton h-48" /></div>;
  if (!u) return <div className="mx-auto max-w-2xl px-5 pt-10"><Empty title="You're not signed in." body="Sign in to manage your profile and transfers." action={<Link href="/signin?next=/app/profile" className="btn btn-primary">Sign in</Link>} /></div>;
  const c = country(u.country);
  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 lg:pt-10">
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 p-6" style={{ background: "radial-gradient(120% 120% at 100% 0%, rgba(254,177,146,.25), rgba(0,70,222,.35) 45%, rgba(12,18,34,.95) 80%)" }}>
        <Ribbons className="absolute inset-0 h-full w-full opacity-40" />
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur">{u.phone.slice(-2)}</span>
          <div>
            <div className="display tabular text-xl">{c ? `${c.dial} ${"•".repeat(Math.max(0, u.phone.length - c.dial.length - 3))} ${u.phone.slice(-3)}` : u.phone}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-ink-2">{c && <Flag code={c.code} size={16} />} {c?.name} · since {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <StatusPill tone="ok">Phone verified</StatusPill>
          <StatusPill tone="muted">ID checks handled by partners</StatusPill>
        </div>
      </div>

      <div className="glass mt-5 divide-y divide-white/5 overflow-hidden">
        <Item icon={Wallet} label="Preferred currency" value={c?.currency} />
        <div className="flex items-center gap-4 p-4">
          <Bell className="h-5 w-5 text-coral" />
          <div className="flex-1"><div className="font-medium">Transfer updates</div><div className="text-[12.5px] text-ink-3">Get notified when a transfer moves</div></div>
          <button role="switch" aria-checked={notif} aria-label="Transfer update notifications" onClick={() => { const n = !notif; setNotif(n); try { localStorage.setItem("soko_notif", n ? "on" : "off"); } catch {} }}
            className={`relative h-7 w-12 rounded-full transition-colors ${notif ? "bg-azure" : "bg-white/15"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${notif ? "left-6" : "left-1"}`} />
          </button>
        </div>
        <Item icon={ShieldCheck} label="Security" value="One-time code sign-in" />
      </div>
      <div className="glass mt-4 divide-y divide-white/5 overflow-hidden">
        <Item icon={LifeBuoy} label="Help and support" href="/app/support" />
        <Item icon={FileText} label="Privacy and terms" href="/app/support#privacy" />
      </div>
      <button onClick={async () => { await api("/api/auth/signout", { method: "POST" }); router.push("/"); }} className="btn btn-ghost mt-5 w-full text-err"><LogOut className="h-4 w-4" /> Sign out</button>
    </div>
  );
}

function Item({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value?: string; href?: string }) {
  const inner = (<><Icon className="h-5 w-5 text-coral" /><span className="flex-1 font-medium">{label}</span>{value && <span className="text-sm text-ink-3">{value}</span>}{href && <ChevronRight className="h-4 w-4 text-ink-3" />}</>);
  return href ? <Link href={href} className="flex items-center gap-4 p-4 hover:bg-white/[0.03]">{inner}</Link> : <div className="flex items-center gap-4 p-4">{inner}</div>;
}
