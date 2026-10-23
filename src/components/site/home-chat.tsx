"use client";

// Spjallgaurinn á heimasíðunni: AI svarar úr þekkingargrunni um VAKTO,
// gesturinn getur beðið um manneskju og þá tekur eigandinn við í /admin/spjall.
// Þráðurinn (id + token) lifir í localStorage svo samtalið haldist milli heimsókna.

import { useEffect, useRef, useState } from "react";
import { VaktoMark } from "@/components/brand/vakto-logo";

type Lang = "is" | "en" | "pl";
type Msg = { id: string; role: "user" | "assistant" | "owner"; body: string };
const KEY = "vakto-home-chat";
const ME = "vakto-home-chat-me"; // nafn + netfang gestsins (beðið um áður en spjall hefst)

const S: Record<Lang, Record<string, string>> = {
  is: {
    open: "Spyrja um VAKTO", title: "VAKTO aðstoð", sub: "Svarar strax · manneskja ef þarf",
    hello: "Hæ! Spurðu mig um VAKTO — vaktaplan, laun% af veltu, verð, Payday, appið… Ég svara strax.",
    ph: "Skrifaðu spurningu…", send: "Senda", human: "Tala við manneskju",
    hName: "Nafn", hEmail: "Netfang", hMsg: "Hvað getum við gert fyrir þig?", hSend: "Senda til VAKTO", hCancel: "Hætta við",
    hDone: "Takk! Eigandi VAKTO fær þetta strax og svarar hér — og á netfangið þitt ef þú ert farin(n).",
    humanMode: "Manneskja hjá VAKTO svarar hér.", waiting: "Sendi…", typing: "…", close: "Loka",
    err: "Tókst ekki að senda — reyndu aftur eða sendu póst á hallo@vakto.is.",
    owner: "VAKTO", bot: "Aðstoð", you: "Þú",
    introTitle: "Byrjum á því hver þú ert", introSub: "Svo getum við svarað þér í pósti ef þú ferð af síðunni.", introGo: "Byrja spjall", introBad: "Sláðu inn gilt netfang.",
  },
  en: {
    open: "Ask about VAKTO", title: "VAKTO assistant", sub: "Instant answers · a person if needed",
    hello: "Hi! Ask me anything about VAKTO — scheduling, labor % of revenue, pricing, Payday, the app… I answer right away.",
    ph: "Type a question…", send: "Send", human: "Talk to a person",
    hName: "Name", hEmail: "Email", hMsg: "What can we help with?", hSend: "Send to VAKTO", hCancel: "Cancel",
    hDone: "Thanks! The VAKTO owner gets this right away and replies here — and to your email if you've left.",
    humanMode: "A person at VAKTO replies here.", waiting: "Sending…", typing: "…", close: "Close",
    err: "Couldn't send — try again or email hallo@vakto.is.",
    owner: "VAKTO", bot: "Assistant", you: "You",
    introTitle: "First, who are you?", introSub: "So we can reply by email if you leave the page.", introGo: "Start chat", introBad: "Enter a valid email.",
  },
  pl: {
    open: "Zapytaj o VAKTO", title: "Asystent VAKTO", sub: "Odpowiada od razu · w razie potrzeby człowiek",
    hello: "Cześć! Zapytaj mnie o VAKTO — grafik zmian, udział kosztów pracy w obrocie, ceny, Payday, aplikację… Odpowiadam od razu.",
    ph: "Wpisz pytanie…", send: "Wyślij", human: "Porozmawiaj z człowiekiem",
    hName: "Imię i nazwisko", hEmail: "E-mail", hMsg: "W czym możemy pomóc?", hSend: "Wyślij do VAKTO", hCancel: "Anuluj",
    hDone: "Dziękujemy! Właściciel VAKTO dostanie to od razu i odpowie tutaj — oraz na Twój e-mail, jeśli wyjdziesz ze strony.",
    humanMode: "Odpowiada tu osoba z VAKTO.", waiting: "Wysyłanie…", typing: "…", close: "Zamknij",
    err: "Nie udało się wysłać — spróbuj ponownie lub napisz na hallo@vakto.is.",
    owner: "VAKTO", bot: "Asystent", you: "Ty",
    introTitle: "Najpierw: kim jesteś?", introSub: "Dzięki temu odpowiemy e-mailem, jeśli opuścisz stronę.", introGo: "Rozpocznij czat", introBad: "Podaj poprawny adres e-mail.",
  },
};

export default function HomeChat({ lang, skin = "ny" }: { lang: Lang; skin?: "ny" | "ah" }) {
  const s = S[lang];
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"bot" | "human" | "closed">("bot");
  const [handoff, setHandoff] = useState(false);
  const [hName, setHName] = useState(""); const [hEmail, setHEmail] = useState(""); const [hMsg, setHMsg] = useState("");
  const [hDone, setHDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [hasThread, setHasThread] = useState(false);
  const idRef = useRef<{ threadId: string; token: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // endurheimta þráð + sækja söguna
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage er aðeins til í vafranum
      if (raw) { idRef.current = JSON.parse(raw); setHasThread(true); }
      const who = localStorage.getItem(ME);
      if (who) setMe(JSON.parse(who));
    } catch {}
  }, []);
  // Nafn og netfang áður en spjallið hefst (eldri þræðir án þeirra halda áfram eins og áður).
  const needIntro = !me && !hasThread;
  function saveIntro(e: React.FormEvent) {
    e.preventDefault();
    const name = hName.trim(), email = hEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr(s.introBad); return; }
    const who = { name, email };
    setMe(who); setErr(null);
    try { localStorage.setItem(ME, JSON.stringify(who)); } catch {}
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  async function refresh() {
    const t = idRef.current; if (!t) return;
    try {
      const r = await fetch(`/api/home-chat/thread?id=${t.threadId}&token=${t.token}`, { cache: "no-store" });
      if (!r.ok) { if (r.status === 404) { idRef.current = null; localStorage.removeItem(KEY); } return; }
      const j = await r.json();
      if (j.ok) { setMsgs(j.messages); setStatus(j.status); }
    } catch {}
  }
  useEffect(() => {
    if (!open) return;
    void refresh();
    const iv = setInterval(() => { if (idRef.current && (status === "human" || document.visibilityState === "visible")) void refresh(); }, status === "human" ? 4000 : 15000);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy, handoff, open]);

  async function send() {
    const text = val.trim();
    if (!text || busy) return;
    setVal(""); setErr(null); setBusy(true);
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", body: text }]);
    try {
      const r = await fetch("/api/home-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, lang, page: location.pathname, ...(me ?? {}), ...(idRef.current ?? {}) }) });
      const j = await r.json();
      if (!j.ok) { setErr(j.error ?? s.err); return; }
      idRef.current = { threadId: j.threadId, token: j.token }; setHasThread(true);
      try { localStorage.setItem(KEY, JSON.stringify(idRef.current)); } catch {}
      setStatus(j.status);
      if (j.reply) setMsgs((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", body: j.reply }]);
    } catch { setErr(s.err); }
    finally { setBusy(false); }
  }

  async function submitHandoff(e: React.FormEvent) {
    e.preventDefault();
    if (!idRef.current) {
      // enginn þráður enn: stofna hann með fyrstu skilaboðunum
      setBusy(true);
      try {
        const r = await fetch("/api/home-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: hMsg || s.human, lang, page: location.pathname, ...(me ?? {}) }) });
        const j = await r.json();
        if (j.ok) { idRef.current = { threadId: j.threadId, token: j.token }; try { localStorage.setItem(KEY, JSON.stringify(idRef.current)); } catch {} }
      } catch {} finally { setBusy(false); }
      if (!idRef.current) { setErr(s.err); return; }
    }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/home-chat/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...idRef.current, name: me?.name || hName, email: me?.email || hEmail, message: hMsg, lang }) });
      const j = await r.json();
      if (!j.ok) { setErr(j.error ?? s.err); return; }
      setHDone(true); setHandoff(false); setStatus("human");
      void refresh();
    } catch { setErr(s.err); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button className={`${skin}-chatfab${open ? " hide" : ""}`} onClick={() => setOpen(true)} aria-label={s.open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.2A8 8 0 1 1 21 12Z" /></svg>
        <span>{s.open}</span>
      </button>
      {open && (
        <div className={`${skin}-chatbox`} role="dialog" aria-label={s.title}>
          <div className="hd">
            <span className="av"><VaktoMark /></span>
            <div><b>{s.title}</b><small>{status === "human" ? s.humanMode : s.sub}</small></div>
            <button className="x" onClick={() => setOpen(false)} aria-label={s.close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="log">
            <div className="m a"><span className="who">{s.bot}</span>{s.hello}</div>
            {msgs.map((m) => (
              <div className={`m ${m.role === "user" ? "u" : m.role === "owner" ? "o" : "a"}`} key={m.id}>
                {m.role !== "user" && <span className="who">{m.role === "owner" ? s.owner : s.bot}</span>}
                {m.body}
              </div>
            ))}
            {needIntro && (
              <form className="hand" onSubmit={saveIntro}>
                <b style={{ fontSize: 14 }}>{s.introTitle}</b>
                <small style={{ opacity: .7, marginTop: -4 }}>{s.introSub}</small>
                <input value={hName} onChange={(e) => setHName(e.target.value)} placeholder={s.hName} autoComplete="name" required />
                <input value={hEmail} onChange={(e) => setHEmail(e.target.value)} placeholder={s.hEmail} type="email" autoComplete="email" required />
                <div className="row"><button type="submit">{s.introGo}</button></div>
              </form>
            )}
            {busy && !handoff && <div className="m a typing">{s.typing}</div>}
            {hDone && <div className="note">{s.hDone}</div>}
            {err && <div className="note err">{err}</div>}
            {handoff && (
              <form className="hand" onSubmit={submitHandoff}>
                {!me && <input value={hName} onChange={(e) => setHName(e.target.value)} placeholder={s.hName} autoComplete="name" required />}
                {!me && <input value={hEmail} onChange={(e) => setHEmail(e.target.value)} placeholder={s.hEmail} type="email" autoComplete="email" required />}
                <textarea value={hMsg} onChange={(e) => setHMsg(e.target.value)} placeholder={s.hMsg} rows={3} />
                <div className="row">
                  <button type="button" className="ghost" onClick={() => setHandoff(false)}>{s.hCancel}</button>
                  <button type="submit" disabled={busy}>{busy ? s.waiting : s.hSend}</button>
                </div>
              </form>
            )}
            <div ref={endRef} />
          </div>
          {!needIntro && <div className="ft">
            {status !== "human" && !handoff && (
              <button className="human" type="button" onClick={() => { setHandoff(true); setHDone(false); }}>{s.human}</button>
            )}
            <form className="in" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)} placeholder={s.ph} maxLength={1200} />
              <button type="submit" disabled={busy || !val.trim()} aria-label={s.send}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
              </button>
            </form>
          </div>}
        </div>
      )}
    </>
  );
}
