"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client";

/** Stand-in for a regulated provider's hosted checkout page. Intentionally plain and off-brand,
 *  like a real third-party payment page. No card or bank details are collected. */
export default function SandboxCheckout() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [s, setS] = useState<{ amount: string; reference: string; state: string; fundingReference: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<typeof s>(`/api/sandbox/checkout?tx=${id}`).then(setS).catch((e) => setErr(e.message)); }, [id]);
  async function decide(approve: boolean) {
    setBusy(true);
    try { const r = await api<{ returnUrl: string }>("/api/sandbox/checkout", { method: "POST", json: { tx: id, approve } }); router.replace(r.returnUrl); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f5f7] px-5 py-10 text-[#1a1f2b]" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        <div className="flex items-center justify-between bg-[#1a1f2b] px-5 py-3 text-white">
          <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> SecurePay</span>
          <span className="flex items-center gap-1 text-[11px] opacity-70"><Lock className="h-3 w-3" /> Hosted checkout</span>
        </div>
        <div className="p-6">
          {err ? <p className="text-sm text-red-600">{err}</p> : !s ? <div className="h-24 animate-pulse rounded bg-gray-100" /> : (
            <>
              <div className="text-[13px] text-gray-500">Pay SokoBot</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{s.amount}</div>
              <div className="mt-1 text-[12px] text-gray-500">Order {s.reference} · {s.fundingReference}</div>
              {s.state !== "FUNDING_PENDING" ? (
                <p className="mt-6 text-sm text-gray-600">This checkout session is no longer open.</p>
              ) : (
                <div className="mt-6 space-y-2">
                  <button disabled={busy} onClick={() => decide(true)} className="h-12 w-full rounded-lg bg-[#1a1f2b] font-semibold text-white disabled:opacity-50">Pay now</button>
                  <button disabled={busy} onClick={() => decide(false)} className="h-12 w-full rounded-lg font-semibold text-gray-600 ring-1 ring-gray-300 disabled:opacity-50">Cancel payment</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
