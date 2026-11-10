"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUp, Pencil } from "lucide-react";
import { api, newKey, saveDraft } from "@/lib/client";
import { country, findCorridor, isTransactable } from "@/lib/corridors";
import type { AssistantReply, Draft } from "@/lib/intent";
import { ParticleGlobe, Sparkle } from "@/components/fx";
import { Flag } from "@/components/ui";

type Msg = { id: string; role: "user" | "assistant"; text: string; reply?: AssistantReply };

const PROMPTS = ["Send 50,000 naira to my sister in Ghana", "Pay my supplier in Kenya", "How much would it cost to send 200 cedis to Lagos?", "Send 5,000 KES to Uganda"];

export default function Assistant() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, thinking]);

  async function send(t: string) {
    const msg = t.trim();
    if (!msg || thinking) return;
    setText("");
    setMsgs((m) => [...m, { id: newKey(), role: "user", text: msg }]);
    setThinking(true);
    try {
      const r = await api<AssistantReply>("/api/assistant", { method: "POST", json: { message: msg, draft } });
      setDraft(r.draft);
      setMsgs((m) => [...m, { id: newKey(), role: "assistant", text: r.message, reply: r }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: newKey(), role: "assistant", text: (e as Error).message }]);
    } finally { setThinking(false); input.current?.focus(); }
  }

  function toTransfer(d: Draft) {
    const c = d.sourceCountry && d.destinationCountry ? findCorridor(d.sourceCountry, d.destinationCountry) : undefined;
    const sameCurrency = !d.amountCurrency || d.amountCurrency === country(d.sourceCountry ?? "")?.currency;
    saveDraft({
      source: d.sourceCountry, destination: d.destinationCountry, amount: sameCurrency ? d.amount : undefined, step: 1, fromAssistant: true, idempotencyKey: newKey(),
      recipientName: d.recipientName,
      recipient: c && d.recipientName ? { displayName: d.recipientName, payoutMethod: d.payoutMethod && c.payoutMethods.includes(d.payoutMethod) ? d.payoutMethod : c.payoutMethods[0], provider: "", identifier: "" } : undefined,
    });
    router.push("/app/send");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-2xl flex-col px-5 pt-5 lg:min-h-dvh lg:pt-8">
      <div className="flex items-center gap-3">
        <Link href="/app" className="grid h-10 w-10 place-items-center rounded-full bg-white/5 hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-coral to-coral-deep text-canvas"><Sparkle size={16} /></span>
        <div><div className="font-semibold">Soko Assistant</div><div className="text-[12px] text-ink-3">Prepares drafts. You always confirm payments.</div></div>
      </div>

      <div className="flex-1 py-6" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center pt-2 text-center">
            <div className="w-[220px] sm:w-[260px]"><ParticleGlobe size={260} /></div>
            <h1 className="display -mt-2 text-[30px] leading-tight">What can I help you <span className="serif-accent text-gradient-coral">send?</span></h1>
            <p className="mt-2 max-w-sm text-ink-2">Tell me who you're paying, where they are and how much.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {PROMPTS.map((p, i) => (
                <motion.button key={p} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                  onClick={() => send(p)} className="rounded-full border border-line bg-white/[0.03] px-4 py-2.5 text-[13.5px] text-ink-2 transition-all hover:-translate-y-0.5 hover:border-coral/40 hover:text-ink">
                  {p}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-azure px-4 py-3 text-[15px] shadow-[0_10px_30px_-12px_rgba(0,70,222,.9)]">{m.text}</div>
                ) : (
                  <div className="max-w-[92%] space-y-3">
                    <div className="glass rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed">{m.text}</div>
                    {m.reply && m.reply.intent !== "STATUS" && m.reply.intent !== "HELP" && <DraftCard reply={m.reply} onContinue={() => toTransfer(m.reply!.draft)} onEdit={() => toTransfer(m.reply!.draft)} />}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {thinking && (
            <div className="flex items-center gap-1.5 px-2" role="status" aria-label="Soko is thinking">
              {[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-coral" animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}
            </div>
          )}
        </div>
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="safe-bottom sticky bottom-0 -mx-5 bg-gradient-to-t from-canvas via-canvas to-transparent px-5 pb-4 pt-6">
        <div className="ring-spin glass flex items-end gap-2 !rounded-[22px] p-2">
          <label htmlFor="chat" className="sr-only">Message Soko</label>
          <textarea id="chat" ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)} maxLength={600}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            placeholder="e.g. Send 20,000 naira to Kofi in Accra" className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[16px] outline-none placeholder:text-ink-3" />
          <button disabled={!text.trim() || thinking} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral text-canvas transition disabled:bg-white/10 disabled:text-ink-3" aria-label="Send message"><ArrowUp className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-center text-[11.5px] text-ink-3">Soko never asks for your PIN, password or wallet keys.</p>
      </form>
    </div>
  );
}

function DraftCard({ reply, onContinue, onEdit }: { reply: AssistantReply; onContinue: () => void; onEdit: () => void }) {
  const d = reply.draft;
  const src = country(d.sourceCountry ?? ""), dst = country(d.destinationCountry ?? "");
  const c = src && dst ? findCorridor(src.code, dst.code) : undefined;
  const ok = isTransactable(c) && !reply.clarification;
  const rows: [string, React.ReactNode | undefined][] = [
    ["Amount", d.amount ? <span className="tabular">{d.amount} {d.amountCurrency ?? src?.currency ?? ""}</span> : undefined],
    ["From", src ? <span className="inline-flex items-center gap-1.5"><Flag code={src.code} size={14} />{src.name}</span> : undefined],
    ["To", dst ? <span className="inline-flex items-center gap-1.5"><Flag code={dst.code} size={14} />{dst.name}</span> : undefined],
    ["Recipient", d.recipientName ?? (d.recipientRelation ? `Your ${d.recipientRelation}` : undefined)],
    ["Payout", d.payoutMethod ? (d.payoutMethod === "BANK" ? "Bank account" : "Mobile money") : undefined],
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass overflow-hidden !rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-wider text-coral"><Sparkle size={10} /> DRAFT · NOT SENT</span>
        <span className="font-mono text-[10px] text-ink-3">from your message{reply.extractedBy === "llm" ? " · AI" : ""}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-4 py-3 text-[13.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className={v ? "text-ink" : "italic text-ink-3"}>{v ?? "Needed"}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-2 border-t border-white/5 p-3">
        {ok ? (
          <button onClick={onContinue} className="btn btn-primary btn-sm flex-1">Continue to transfer <ArrowRight className="h-4 w-4" /></button>
        ) : (
          <button onClick={onEdit} className="btn btn-ghost btn-sm flex-1"><Pencil className="h-4 w-4" /> Fill in the form instead</button>
        )}
      </div>
      <p className="px-4 pb-3 text-[11.5px] text-ink-3">Rates and fees come from the live quote in the next steps, never from chat.</p>
    </motion.div>
  );
}
