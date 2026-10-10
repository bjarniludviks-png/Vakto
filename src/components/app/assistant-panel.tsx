"use client";

// VAKTO AI — spjall í horninu (stjórnendur og vaktstjórar). Samtöl vistast á þjóninum (ai_conversations)
// svo hægt sé að opna þau aftur; opna samtalið er líka geymt í sessionStorage milli síðna.
// Breytingar koma sem tillögur með „Staðfesta"-hnappi; ekkert er framkvæmt án hans.
import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "./lang";

type Action = { tool: string; input: Record<string, unknown>; summary: string; state?: "pending" | "busy" | "done" | "error" | "cancelled"; error?: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; actions?: Action[] };
type Conv = { id: string; title: string; updated_at: string };

const KEY = "vakto-assistant";
const KEY_ID = "vakto-assistant-id";
const S = {
  is: {
    name: "VAKTO AI", open: "Opna VAKTO AI", close: "Loka", reset: "Nýtt samtal", history: "Fyrri samtöl", noHistory: "Engin vistuð samtöl enn.", del: "Eyða samtali", back: "Til baka", ph: "Spurðu um reksturinn eða biddu um breytingu…",
    send: "Senda", thinking: "Hugsa…", confirm: "Staðfesta", cancel: "Hætta við", all: "Staðfesta allt", done: "Gert", cancelled: "Hætt við",
    hello: "Hæ! Ég get svarað spurningum um laun, tíma og vaktir, sett upp vaktaplan fyrir heila viku og undirbúið breytingar sem þú staðfestir.",
    err: "Tókst ekki að ná sambandi. Reyndu aftur.",
    chips: ["Hvernig er laun % af veltu þessa vikuna?", "Settu upp næstu viku: allir með einn frídag", "Hver er á vakt núna?", "Hvaða beiðnir bíða?"],
    note: "VAKTO AI getur gert mistök. Breytingar eru aðeins gerðar þegar þú staðfestir.",
  },
  en: {
    name: "VAKTO AI", open: "Open VAKTO AI", close: "Close", reset: "New conversation", history: "Earlier conversations", noHistory: "No saved conversations yet.", del: "Delete conversation", back: "Back", ph: "Ask about the business or request a change…",
    send: "Send", thinking: "Thinking…", confirm: "Confirm", cancel: "Cancel", all: "Confirm all", done: "Done", cancelled: "Cancelled",
    hello: "Hi! I can answer questions about labor cost, hours and shifts, plan a whole week, and prepare changes for you to confirm.",
    err: "Could not connect. Try again.",
    chips: ["What's labor % of revenue this week?", "Plan next week: everyone gets one day off", "Who is on shift now?", "Which requests are waiting?"],
    note: "VAKTO AI can make mistakes. Changes only happen when you confirm.",
  },
};

/** **feitletrun**, línuskil og „- “ listar. */
function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((ln, i) => {
        const li = /^\s*[-•*]\s+/.test(ln);
        const parts = ln.replace(/^\s*[-•*]\s+/, "").split(/(\*\*[^*]+\*\*)/g);
        const inner = parts.map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <b key={k}>{p.slice(2, -2)}</b> : <Fragment key={k}>{p}</Fragment>));
        return li ? <div key={i} className="vai-li">{inner}</div> : ln.trim() ? <p key={i}>{inner}</p> : null;
      })}
    </>
  );
}

const Spark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" /><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" /></svg>;

export function AssistantPanel() {
  const { lang } = useLang();
  const s = S[lang === "en" ? "en" : "is"];
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [hist, setHist] = useState<Conv[] | null>(null); // null = listinn er lokaður
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage er aðeins til í vafranum
      if (raw) setMsgs(JSON.parse(raw));
      setConvId(sessionStorage.getItem(KEY_ID));
    } catch { /* ekkert */ }
  }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch { /* ekkert */ } }, [msgs]);
  useEffect(() => { try { if (convId) sessionStorage.setItem(KEY_ID, convId); else sessionStorage.removeItem(KEY_ID); } catch { /* ekkert */ } }, [convId]);

  function fresh() { setMsgs([]); setConvId(null); setHist(null); }
  async function openHistory() {
    if (hist) { setHist(null); return; }
    setHist([]);
    try { const d = await (await fetch("/api/assistant/conversations")).json(); setHist(d.conversations ?? []); } catch { /* listinn helst tómur */ }
  }
  async function openConv(id: string) {
    try {
      const d = await (await fetch(`/api/assistant/conversations?id=${id}`)).json();
      setMsgs((d.messages ?? []).map((m: { id: string; role: Msg["role"]; content: string; actions: Action[] | null }) => ({ id: m.id, role: m.role, content: m.content, actions: m.actions ?? undefined })));
      setConvId(id); setHist(null);
    } catch { /* ekkert */ }
  }
  async function delConv(id: string) {
    setHist((h) => h?.filter((c) => c.id !== id) ?? null);
    if (id === convId) { setMsgs([]); setConvId(null); }
    try { await fetch(`/api/assistant/conversations?id=${id}`, { method: "DELETE" }); } catch { /* ekkert */ }
  }
  /** Vistar stöðu tillögu (staðfest / hætt við) svo hún sé rétt þegar samtalið er opnað aftur. */
  function saveState(mi: number, ai: number, state: "done" | "cancelled" | "error") {
    const id = msgs[mi]?.id; if (!id) return;
    void fetch("/api/assistant/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id, index: ai, state }) }).catch(() => {});
  }
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy, open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 60); }, [open]);

  async function send(q: string) {
    const content = q.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, lang, conversationId: convId, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setMsgs([...next, { role: "assistant", content: data?.error ?? s.err }]); return; }
      if (data.conversationId) setConvId(data.conversationId);
      setMsgs([...next, { id: data.messageId ?? undefined, role: "assistant", content: data.reply ?? "", actions: (data.actions ?? []).map((a: Action) => ({ ...a, state: "pending" })) }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: s.err }]);
    } finally { setBusy(false); }
  }

  function patchAction(mi: number, ai: number, p: Partial<Action>) {
    setMsgs((m) => m.map((x, i) => (i !== mi ? x : { ...x, actions: x.actions?.map((a, j) => (j === ai ? { ...a, ...p } : a)) })));
  }
  async function confirm(mi: number, ai: number) {
    const a = msgs[mi]?.actions?.[ai]; if (!a || a.state !== "pending") return;
    patchAction(mi, ai, { state: "busy" });
    try {
      const res = await fetch("/api/assistant/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: a.tool, input: a.input, lang }) });
      const data = await res.json();
      patchAction(mi, ai, data.ok ? { state: "done" } : { state: "error", error: data.error ?? s.err });
      if (data.ok) { saveState(mi, ai, "done"); router.refresh(); }
    } catch { patchAction(mi, ai, { state: "error", error: s.err }); }
  }
  async function confirmAll(mi: number) {
    const acts = msgs[mi]?.actions ?? [];
    for (let i = 0; i < acts.length; i++) if (acts[i].state === "pending") await confirm(mi, i);
  }

  return (
    <>
      <button className={`vai-fab${open ? " on" : ""}${path?.startsWith("/spjall") ? " up" : ""}`} onClick={() => setOpen((o) => !o)} aria-label={s.open} title={`${s.name} (⌘J)`}><Spark /></button>
      {open && (
        <div className="vai-panel" role="dialog" aria-label={s.name}>
          <div className="vai-head">
            <span className="vai-badge"><Spark /></span>
            <b>{s.name}</b>
            <span className="vai-sp" />
            <button className={`vai-ico${hist ? " on" : ""}`} onClick={openHistory} title={s.history} aria-label={s.history}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></button>
            {msgs.length > 0 && <button className="vai-ico" onClick={fresh} title={s.reset} aria-label={s.reset}><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>}
            <button className="vai-ico" onClick={() => setOpen(false)} aria-label={s.close}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          {hist && (
            <div className="vai-hist">
              <div className="vai-hist-h"><b>{s.history}</b><button className="btn ghost sm" onClick={() => setHist(null)}>{s.back}</button></div>
              {hist.length === 0 ? <p className="vai-muted">{s.noHistory}</p> : hist.map((c) => (
                <div key={c.id} className={`vai-conv${c.id === convId ? " on" : ""}`}>
                  <button className="vai-conv-t" onClick={() => openConv(c.id)}><b>{c.title || s.name}</b><small>{(() => { const d = new Date(c.updated_at); return `${d.getDate()}.${d.getMonth() + 1}.`; })()}</small></button>
                  <button className="vai-ico" onClick={() => delConv(c.id)} title={s.del} aria-label={s.del}><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>
                </div>
              ))}
            </div>
          )}
          <div className="vai-list" ref={list} hidden={!!hist}>
            {msgs.length === 0 && (
              <div className="vai-hello">
                <p>{s.hello}</p>
                <div className="vai-chips">{s.chips.map((c) => <button key={c} onClick={() => send(c)}>{c}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`vai-msg ${m.role}`}>
                {m.content && <div className="vai-bub">{m.role === "assistant" ? <Rich text={m.content} /> : m.content}</div>}
                {m.actions && m.actions.length > 0 && (
                  <div className="vai-acts">
                    {m.actions.map((a, j) => (
                      <div key={j} className={`vai-act ${a.state}`}>
                        <span className="vai-act-tx">{a.summary}{a.state === "error" && <small>{a.error}</small>}</span>
                        {a.state === "pending" && (<span className="vai-act-b">
                          <button className="btn sm" onClick={() => confirm(i, j)}>{s.confirm}</button>
                          <button className="btn ghost sm" onClick={() => { patchAction(i, j, { state: "cancelled" }); saveState(i, j, "cancelled"); }}>{s.cancel}</button>
                        </span>)}
                        {a.state === "busy" && <span className="vai-dots"><i /><i /><i /></span>}
                        {a.state === "done" && <span className="vai-ok">✓ {s.done}</span>}
                        {a.state === "cancelled" && <span className="vai-muted">{s.cancelled}</span>}
                      </div>
                    ))}
                    {m.actions.filter((a) => a.state === "pending").length > 1 && <button className="btn sm vai-all" onClick={() => confirmAll(i)}>{s.all}</button>}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="vai-msg assistant"><div className="vai-bub vai-think"><span className="vai-dots"><i /><i /><i /></span>{s.thinking}</div></div>}
          </div>
          <form className="vai-in" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <textarea ref={input} rows={1} value={text} placeholder={s.ph} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <button type="submit" disabled={busy || !text.trim()} aria-label={s.send}><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </form>
          <div className="vai-note">{s.note}</div>
        </div>
      )}
    </>
  );
}
