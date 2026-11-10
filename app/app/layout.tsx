"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Bot, Home, LifeBuoy, Send, Settings, Users } from "lucide-react";
import { Aurora } from "@/components/fx";
import { Logo } from "@/components/ui";

const NAV = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/send", label: "Send money", icon: Send, desktopOnly: true },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/recipients", label: "Recipients", icon: Users },
  { href: "/app/assistant", label: "Ask Soko", icon: Bot, desktopOnly: true },
  { href: "/app/support", label: "Support", icon: LifeBuoy, desktopOnly: true },
  { href: "/app/profile", label: "Profile", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isActive = (h: string) => (h === "/app" ? path === "/app" : path.startsWith(h));
  const focusFlow = path.startsWith("/app/send") || path.startsWith("/app/assistant") || /\/app\/transfers\//.test(path);
  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden opacity-60"><Aurora /></div>
      <div className="pointer-events-none fixed inset-0 grid-fade opacity-50" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/5 bg-canvas/60 p-5 backdrop-blur-xl lg:flex">
        <Logo />
        <nav className="mt-10 flex flex-col gap-1">
          {NAV.map((n) => {
            const on = isActive(n.href);
            return (
              <Link key={n.href} href={n.href} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${on ? "text-ink" : "text-ink-3 hover:bg-white/5 hover:text-ink"}`}>
                {on && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-azure/40 to-azure/5 ring-1 ring-azure-soft/30" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <n.icon className={`relative h-[18px] w-[18px] ${on ? "text-coral" : ""}`} aria-hidden />
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <Link href="/ops" className="block text-[12px] text-ink-3 hover:text-ink-2">Operations console →</Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-canvas/70 px-5 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
      </header>

      <main className={`relative z-10 lg:pl-60 ${focusFlow ? "pb-10" : "pb-28"} lg:pb-12`}>{children}</main>

      {/* Mobile bottom nav + floating send */}
      {!focusFlow && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-canvas/80 backdrop-blur-xl lg:hidden" aria-label="Primary">
          <div className="relative mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-2">
            {NAV.filter((n) => !n.desktopOnly).slice(0, 2).map((n) => <Tab key={n.href} {...n} on={isActive(n.href)} />)}
            <div className="flex justify-center">
              <Link href="/app/send" aria-label="Send money" className="-mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-azure shadow-[0_12px_30px_-6px_rgba(0,70,222,.9)] ring-4 ring-canvas transition-transform active:scale-95">
                <Send className="h-6 w-6" />
              </Link>
            </div>
            {NAV.filter((n) => !n.desktopOnly).slice(2).map((n) => <Tab key={n.href} {...n} on={isActive(n.href)} />)}
          </div>
        </nav>
      )}
    </div>
  );
}

function Tab({ href, label, icon: Icon, on }: { href: string; label: string; icon: React.ElementType; on: boolean }) {
  return (
    <Link href={href} className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] ${on ? "text-ink" : "text-ink-3"}`} aria-current={on ? "page" : undefined}>
      {on && <motion.span layoutId="tab-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-coral" />}
      <Icon className={`h-5 w-5 ${on ? "text-coral" : ""}`} aria-hidden />
      {label}
    </Link>
  );
}
