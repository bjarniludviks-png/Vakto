"use client";

// VAKTO AI — spjall í horninu (stjórnendur og vaktstjórar). Rökfræðin og birtingin eru sameiginleg
// með VAKTO AI-samtalinu í Spjallrásum (assistant-chat.tsx). Á /spjall er hnappurinn falinn því
// VAKTO AI er þar fest efst í samtalalistanum; samtalið sjálft fylgir á milli (sessionStorage).
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AssistantComposer, AssistantHistoryList, AssistantMessages, Spark, useAssistantChat } from "./assistant-chat";

/** demo: opna demoið er aðeins til skoðunar — spurningum er svarað, tillögur eru sýndar en ekki framkvæmdar. */
export function AssistantPanel({ demo = false }: { demo?: boolean }) {
  const path = usePathname();
  if (path?.startsWith("/spjall")) return null;
  return <FloatingAssistant demo={demo} />;
}

function FloatingAssistant({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const chat = useAssistantChat({ demo });
  const { s, msgs, history } = chat;
  const chatRef = useRef(chat);
  useEffect(() => { chatRef.current = chat; });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) chat.focus(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Aðrar síður (t.d. Hjálp) opna VAKTO AI með window-atburðinum „vakto-ai:open“, valfrjálst með spurningu
  // (detail.q). data-vakto-ai á <html> segir þeim að aðstoðarmaðurinn sé til staðar fyrir þennan notanda.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<{ q?: string } | undefined>).detail?.q?.trim();
      setOpen(true);
      if (q) void chatRef.current.send(q);
    };
    document.documentElement.dataset.vaktoAi = "1";
    window.addEventListener("vakto-ai:open", onOpen);
    return () => { delete document.documentElement.dataset.vaktoAi; window.removeEventListener("vakto-ai:open", onOpen); };
  }, []);

  return (
    <>
      <button className={`vai-fab${open ? " on" : " pill"}`} onClick={() => setOpen((o) => !o)} aria-label={open ? s.close : s.open} title={`${s.name} (⌘J)`}>{open ? <svg viewBox="0 0 24 24" className="x" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg> : <><Spark /><span>{s.name}</span></>}</button>
      {open && (
        <div className={`vai-panel${wide ? " wide" : ""}`} role="dialog" aria-label={s.name}>
          <div className="vai-head">
            <span className="vai-badge"><Spark /></span>
            <b>{s.name}</b>
            <span className="vai-sp" />
            <button className={`vai-ico${history ? " on" : ""}`} onClick={() => (history ? chat.closeHistory() : chat.loadHistory())} title={s.history} aria-label={s.history}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></button>
            {msgs.length > 0 && <button className="vai-ico" onClick={() => { chat.fresh(); chat.closeHistory(); }} title={s.reset} aria-label={s.reset}><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>}
            <button className="vai-ico vai-wide" onClick={() => setWide((w) => !w)} title={wide ? s.narrow : s.wide} aria-label={wide ? s.narrow : s.wide}>{wide ? <svg viewBox="0 0 24 24"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg> : <svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>}</button>
            <button className="vai-ico" onClick={() => setOpen(false)} aria-label={s.close}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          {history && (
            <div className="vai-hist">
              <div className="vai-hist-h"><b>{s.history}</b><button className="btn ghost sm" onClick={chat.closeHistory}>{s.back}</button></div>
              <AssistantHistoryList chat={chat} onOpened={chat.closeHistory} />
            </div>
          )}
          <AssistantMessages chat={chat} hidden={!!history} onUpgrade={() => { setOpen(false); router.push("/stillingar?tab=askrift#vakto-ai"); }} />
          <AssistantComposer chat={chat} />
        </div>
      )}
    </>
  );
}
