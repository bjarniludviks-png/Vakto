"use client";

// VAKTO AI — spjall í horninu (stjórnendur og vaktstjórar). Saga geymd í sessionStorage.
// Breytingar koma sem tillögur með „Staðfesta"-hnappi; ekkert er framkvæmt án hans.
import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "./lang";

type Action = { tool: string; input: Record<string, unknown>; summary: string; state?: "pending" | "busy" | "done" | "error" | "cancelled"; error?: string };
type Msg = { role: "user" | "assistant"; content: string; actions?: Action[] };

const KEY = "vakto-assistant";
const S = {
  is: {
    name: "VAKTO AI", open: "Opna VAKTO AI", close: "Loka", reset: "Nýtt samtal", ph: "Spurðu um reksturinn eða biddu um breytingu…",
    send: "Senda", thinking: "Hugsa…", confirm: "Staðfesta", cancel: "Hætta við", all: "Staðfesta allt", done: "Gert", cancelled: "Hætt við",
    hello: "Hæ! Ég get svarað spurningum um laun, tíma og vaktir, og undirbúið breytingar sem þú staðfestir.",
    err: "Tókst ekki að ná sambandi. Reyndu aftur.",
    chips: ["Hvernig er laun % af veltu þessa vikuna?", "Hver er á vakt núna?", "Hvaða beiðnir bíða?", "Hver fór mest yfir plan í síðustu viku?"],
    note: "VAKTO AI getur gert mistök. Breytingar eru aðeins gerðar þegar þú staðfestir.",
  },
  en: {
    name: "VAKTO AI", open: "Open VAKTO AI", close: "Close", reset: "New conversation", ph: "Ask about the business or request a change…",
    send: "Send", thinking: "Thinking…", confirm: "Confirm", cancel: "Cancel", all: "Confirm all", done: "Done", cancelled: "Cancelled",
    hello: "Hi! I can answer questions about labor cost, hours and shifts, and prepare changes for you to confirm.",
    err: "Could not connect. Try again.",
    chips: ["What's labor % of revenue this week?", "Who is on shift now?", "Which requests are waiting?", "Who went most over plan last week?"],
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
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage er aðeins til í vafranum
      if (raw) setMsgs(JSON.parse(raw));
    } catch { /* ekkert */ }
  }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch { /* ekkert */ } }, [msgs]);
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
        body: JSON.stringify({ path, lang, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setMsgs([...next, { role: "assistant", content: data?.error ?? s.err }]); return; }
      setMsgs([...next, { role: "assistant", content: data.reply ?? "", actions: (data.actions ?? []).map((a: Action) => ({ ...a, state: "pending" })) }]);
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
      if (data.ok) router.refresh();
    } catch { patchAction(mi, ai, { state: "error", error: s.err }); }
  }
  async function confirmAll(mi: number) {
    const acts = msgs[mi]?.actions ?? [];
    for (let i = 0; i < acts.length; i++) if (acts[i].state === "pending") await confirm(mi, i);
  }

  return (
    <>
      <button className={`vai-fab${open ? " on" : ""}`} onClick={() => setOpen((o) => !o)} aria-label={s.open} title={`${s.name} (⌘J)`}><Spark /></button>
      {open && (
        <div className="vai-panel" role="dialog" aria-label={s.name}>
          <div className="vai-head">
            <span className="vai-badge"><Spark /></span>
            <b>{s.name}</b>
            <span className="vai-sp" />
            {msgs.length > 0 && <button className="vai-ico" onClick={() => setMsgs([])} title={s.reset} aria-label={s.reset}><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg></button>}
            <button className="vai-ico" onClick={() => setOpen(false)} aria-label={s.close}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          <div className="vai-list" ref={list}>
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
                          <button className="btn ghost sm" onClick={() => patchAction(i, j, { state: "cancelled" })}>{s.cancel}</button>
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
