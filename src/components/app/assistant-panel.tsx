"use client";

// VAKTO AI — spjall í horninu (stjórnendur og vaktstjórar). Samtöl vistast á þjóninum (ai_conversations)
// svo hægt sé að opna þau aftur; opna samtalið er líka geymt í sessionStorage milli síðna.
// Breytingar koma sem tillögur með „Staðfesta"-hnappi; ekkert er framkvæmt án hans.
import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "./lang";
import { showDemoReadOnly } from "./demo-guard";
import { isNdjson, readNdjson, type AssistantEvent } from "@/lib/ai/stream";

type Action = { tool: string; input: Record<string, unknown>; summary: string; state?: "pending" | "busy" | "done" | "error" | "cancelled"; error?: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; actions?: Action[]; upgrade?: boolean; signup?: boolean };
type Conv = { id: string; title: string; updated_at: string };
/** Svar í vinnslu: stig, texti sem streymir inn og vaktir plan_week jafnóðum. */
type Live = { stage: string; tool?: string; text: string; plan: string[]; total?: number; dept?: string; actions: Action[] };

const KEY = "vakto-assistant";
const KEY_ID = "vakto-assistant-id";
const S = {
  is: {
    name: "VAKTO AI", open: "Opna VAKTO AI", close: "Loka", reset: "Nýtt samtal", history: "Fyrri samtöl", noHistory: "Engin vistuð samtöl enn.", del: "Eyða samtali", back: "Til baka", ph: "Spurðu um reksturinn eða biddu um breytingu…",
    send: "Senda", thinking: "Hugsa…", confirm: "Staðfesta", viewOnly: "Aðeins til skoðunar í demo — tillagan er ekki framkvæmd.", cancel: "Hætta við", all: "Staðfesta allt", done: "Gert", cancelled: "Hætt við",
    hello: "Hæ! Ég get svarað spurningum um laun, tíma og vaktir, sett upp vaktaplan fyrir heila viku og undirbúið breytingar sem þú staðfestir.",
    err: "Tókst ekki að ná sambandi. Reyndu aftur.",
    chips: ["Hvernig er laun % af veltu þessa vikuna?", "Berðu saman launakostnað og tíma í þessum mánuði og síðasta", "Settu upp næstu viku: allir með einn frídag", "Hver er á vakt núna?", "Láttu mig vita ef einhver fer yfir 180 tíma í mánuðinum"],
    wide: "Stækka", narrow: "Minnka",
    note: "VAKTO AI getur gert mistök. Breytingar eru aðeins gerðar þegar þú staðfestir.",
    st: { think: "Hugsa…", read: "Sæki gögn…", week_planning_context: "Les vaktaplan, starfsfólk og beiðnir…", shifts: "Les vaktaplanið…", pending_requests: "Les beiðnir…", who_is_on_now: "Athuga hver er á vakt…", labor: "Reikna laun og tíma…", write: "Undirbý tillögu…", summary: "Skrifa samantekt…" },
    planning: (n: number, of?: number) => of ? `Raða vöktum… ${n} af ${of}` : `Raða vöktum… ${n}`, days: ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"],
    upgrade: "Kveikja á VAKTO AI",
    signup: "Stofna fyrirtæki — 14 daga frí prufa", left: (n: number, of: number) => `${n} af ${of} spurningum eftir í demo`,
  },
  en: {
    name: "VAKTO AI", open: "Open VAKTO AI", close: "Close", reset: "New conversation", history: "Earlier conversations", noHistory: "No saved conversations yet.", del: "Delete conversation", back: "Back", ph: "Ask about the business or request a change…",
    send: "Send", thinking: "Thinking…", confirm: "Confirm", viewOnly: "View only in the demo — the proposal is not carried out.", cancel: "Cancel", all: "Confirm all", done: "Done", cancelled: "Cancelled",
    hello: "Hi! I can answer questions about labor cost, hours and shifts, plan a whole week, and prepare changes for you to confirm.",
    err: "Could not connect. Try again.",
    chips: ["What's labor % of revenue this week?", "Compare labor cost and hours this month vs last month", "Plan next week: everyone gets one day off", "Who is on shift now?", "Tell me if anyone goes over 180 hours this month"],
    wide: "Expand", narrow: "Shrink",
    note: "VAKTO AI can make mistakes. Changes only happen when you confirm.",
    st: { think: "Thinking…", read: "Fetching data…", week_planning_context: "Reading schedule, staff and requests…", shifts: "Reading the schedule…", pending_requests: "Reading requests…", who_is_on_now: "Checking who is on shift…", labor: "Calculating labor and hours…", write: "Preparing a proposal…", summary: "Writing a summary…" },
    planning: (n: number, of?: number) => of ? `Placing shifts… ${n} of ${of}` : `Placing shifts… ${n}`, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    upgrade: "Turn on VAKTO AI",
    signup: "Create your company — 14-day free trial", left: (n: number, of: number) => `${n} of ${of} questions left in the demo`,
  },
  pl: {
    name: "VAKTO AI", open: "Otwórz VAKTO AI", close: "Zamknij", reset: "Nowa rozmowa", history: "Wcześniejsze rozmowy", noHistory: "Brak zapisanych rozmów.", del: "Usuń rozmowę", back: "Wstecz", ph: "Zapytaj o firmę lub poproś o zmianę…",
    send: "Wyślij", thinking: "Myślę…", confirm: "Zatwierdź", viewOnly: "Demo tylko do podglądu — propozycja nie zostanie wykonana.", cancel: "Anuluj", all: "Zatwierdź wszystko", done: "Gotowe", cancelled: "Anulowano",
    hello: "Cześć! Odpowiem na pytania o koszty pracy, godziny i zmiany, ułożę grafik na cały tydzień i przygotuję zmiany do Twojego zatwierdzenia.",
    err: "Nie udało się połączyć. Spróbuj ponownie.",
    chips: ["Jaki jest w tym tygodniu udział kosztów pracy w obrocie?", "Porównaj koszty pracy i godziny w tym i poprzednim miesiącu", "Ułóż grafik na przyszły tydzień: każdy ma jeden dzień wolny", "Kto jest teraz na zmianie?", "Powiadom mnie, jeśli ktoś przekroczy 180 godzin w miesiącu"],
    wide: "Powiększ", narrow: "Zmniejsz",
    note: "VAKTO AI może się mylić. Zmiany są wprowadzane dopiero po Twoim zatwierdzeniu.",
    st: { think: "Myślę…", read: "Pobieram dane…", week_planning_context: "Czytam grafik, pracowników i wnioski…", shifts: "Czytam grafik…", pending_requests: "Czytam wnioski…", who_is_on_now: "Sprawdzam, kto jest na zmianie…", labor: "Liczę koszty pracy i godziny…", write: "Przygotowuję propozycję…", summary: "Piszę podsumowanie…" },
    planning: (n: number, of?: number) => of ? `Układam zmiany… ${n} z ${of}` : `Układam zmiany… ${n}`, days: ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"],
    upgrade: "Włącz VAKTO AI",
    signup: "Załóż firmę — 14 dni za darmo", left: (n: number, of: number) => `Pozostało ${n} z ${of} pytań w demo`,
  },
  vi: {
    name: "VAKTO AI", open: "Mở VAKTO AI", close: "Đóng", reset: "Cuộc trò chuyện mới", history: "Cuộc trò chuyện trước", noHistory: "Chưa có cuộc trò chuyện nào được lưu.", del: "Xóa cuộc trò chuyện", back: "Quay lại", ph: "Hỏi về hoạt động kinh doanh hoặc yêu cầu thay đổi…",
    send: "Gửi", thinking: "Đang suy nghĩ…", confirm: "Xác nhận", viewOnly: "Bản demo chỉ để xem — đề xuất sẽ không được thực hiện.", cancel: "Hủy", all: "Xác nhận tất cả", done: "Xong", cancelled: "Đã hủy",
    hello: "Xin chào! Tôi có thể trả lời câu hỏi về chi phí lương, giờ làm và ca làm, lập lịch cho cả tuần và chuẩn bị các thay đổi để bạn xác nhận.",
    err: "Không thể kết nối. Vui lòng thử lại.",
    chips: ["Tỷ lệ chi phí lương trên doanh thu tuần này là bao nhiêu?", "So sánh chi phí lương và giờ làm tháng này với tháng trước", "Lập lịch tuần sau: mỗi người được nghỉ một ngày", "Ai đang trong ca làm?", "Báo cho tôi nếu ai đó vượt quá 180 giờ trong tháng"],
    wide: "Mở rộng", narrow: "Thu nhỏ",
    note: "VAKTO AI có thể mắc lỗi. Thay đổi chỉ được thực hiện khi bạn xác nhận.",
    st: { think: "Đang suy nghĩ…", read: "Đang lấy dữ liệu…", week_planning_context: "Đang đọc lịch, nhân viên và yêu cầu…", shifts: "Đang đọc lịch làm việc…", pending_requests: "Đang đọc yêu cầu…", who_is_on_now: "Đang kiểm tra ai đang làm…", labor: "Đang tính chi phí lương và giờ làm…", write: "Đang chuẩn bị đề xuất…", summary: "Đang viết tóm tắt…" },
    planning: (n: number, of?: number) => of ? `Đang xếp ca… ${n}/${of}` : `Đang xếp ca… ${n}`, days: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    upgrade: "Bật VAKTO AI",
    signup: "Tạo công ty — dùng thử miễn phí 14 ngày", left: (n: number, of: number) => `Còn ${n}/${of} câu hỏi trong bản demo`,
  },
};

/** **feitletrun**, línuskil og „- “ listar. */
function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((ln, i) => {
        // Fyrirsagnir („## …“) verða feitletruð lína.
        if (/^\s*#{1,6}\s+/.test(ln)) return <p key={i} className="vai-h"><b>{ln.replace(/^\s*#{1,6}\s+/, "").replace(/\*\*/g, "")}</b></p>;
        const li = /^\s*[-•*]\s+/.test(ln);
        const parts = ln.replace(/^\s*[-•*]\s+/, "").split(/(\*\*[^*]+\*\*)/g);
        const inner = parts.map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <b key={k}>{p.slice(2, -2)}</b> : <Fragment key={k}>{p}</Fragment>));
        return li ? <div key={i} className="vai-li">{inner}</div> : ln.trim() ? <p key={i}>{inner}</p> : null;
      })}
    </>
  );
}

type Strings = (typeof S)["is"];
const LABOR_TOOLS = new Set(["labor_summary", "staff_hours", "compare_periods", "labor_trend", "payroll_runs", "sick_rate"]);
/** Texti framvindunnar: hvað VAKTO AI er að gera núna. */
function stageLabel(live: Live, s: Strings): string {
  if (live.stage === "plan") return s.planning(live.plan.length, live.total);
  if (live.stage === "read") {
    const t = live.tool ?? "";
    return t in s.st ? s.st[t as keyof Strings["st"]] : LABOR_TOOLS.has(t) ? s.st.labor : s.st.read;
  }
  return live.stage in s.st ? s.st[live.stage as keyof Strings["st"]] : s.st.think;
}

/** Vikuyfirlit vaktaplans-tillögu („Nafn|YYYY-MM-DD|HH:MM|HH:MM“): fyllist jafnóðum á meðan líkanið skrifar. */
function PlanGrid({ shifts, s, head, total, dept }: { shifts: string[]; s: Strings; head?: string; total?: number; dept?: string }) {
  const cols: { name: string; time: string }[][] = [[], [], [], [], [], [], []];
  for (const x of shifts) {
    if (typeof x !== "string") continue; // eldri tillögur gátu geymt vaktir sem hluti
    const [name, date, start, end] = x.split("|").map((p) => p.trim());
    const d = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
    if (cols[d]) cols[d].push({ name, time: `${start}–${end}` });
  }
  return (
    <div className={`vai-plan${head ? " live" : ""}`}>
      {head && <div className="vai-plan-h"><span className="vai-dots"><i /><i /><i /></span><b>{head}</b>{dept && <span className="vai-muted">{dept}</span>}</div>}
      {head && total ? <div className="vai-plan-bar"><i style={{ width: `${Math.min(100, (shifts.length / total) * 100)}%` }} /></div> : null}
      <div className="vai-plan-g">
        {cols.map((c, i) => (
          <div key={i} className="vai-plan-d">
            <small>{s.days[i]}<em>{c.length}</em></small>
            {c.map((x, j) => <span key={j} title={`${x.name} ${x.time}`}>{x.name.split(/\s+/)[0]}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

const Spark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" /><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" /></svg>;

/** demo: opna demoið er aðeins til skoðunar — spurningum er svarað, tillögur eru sýndar en ekki framkvæmdar. */
export function AssistantPanel({ demo = false }: { demo?: boolean }) {
  const { lang } = useLang();
  const s = S[lang];
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Live | null>(null); // svar sem er að streyma inn
  const [convId, setConvId] = useState<string | null>(null);
  const [hist, setHist] = useState<Conv[] | null>(null); // null = listinn er lokaður
  const [demoLeft, setDemoLeft] = useState<{ left: number; of: number } | null>(null); // opið demo: spurningar eftir hjá gestinum
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
    const id = msgs[mi]?.id; if (!id || demo) return;
    void fetch("/api/assistant/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id, index: ai, state }) }).catch(() => {});
  }
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy, open]);
  // Á meðan svar streymir inn: fylgja botninum (án mjúkrar hreyfingar svo það hökti ekki við hvert orð).
  const liveSize = live ? live.text.length + live.plan.length * 40 + live.actions.length : 0;
  useEffect(() => { if (liveSize) list.current?.scrollTo({ top: list.current.scrollHeight }); }, [liveSize]);
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
      // Streymt svar (NDJSON): framvinda, texti og vaktir birtast jafnóðum; „done“ er lokasvarið.
      let data: { ok?: boolean; error?: string; limit?: { canUpgrade?: boolean }; signup?: boolean; conversationId?: string; demo?: { left: number; of: number }; messageId?: string; reply?: string; actions?: Action[] } | null = null;
      if (isNdjson(res)) {
        let lv: Live = { stage: "think", text: "", plan: [], actions: [] };
        setLive(lv);
        await readNdjson<AssistantEvent>(res, (ev) => {
          if (ev.t === "stage") lv = { ...lv, stage: ev.stage, tool: ev.tool };
          else if (ev.t === "turn") lv = { ...lv, text: "" };
          else if (ev.t === "text") lv = { ...lv, text: lv.text + ev.d };
          else if (ev.t === "plan") lv = { ...lv, stage: "plan", plan: [...lv.plan, ...ev.add], total: ev.total ?? lv.total, dept: ev.dept ?? lv.dept };
          else if (ev.t === "action") lv = { ...lv, actions: [...lv.actions, { ...ev.action, state: "pending" }] };
          else { if (ev.t === "done") data = ev; return; }
          setLive(lv);
        });
        if (!data) data = { ok: false, error: s.err };
      } else data = await res.json();
      if (!data) throw new Error("tómt svar");
      if (!res.ok || !data.ok) { setMsgs([...next, { role: "assistant", content: data?.error ?? s.err, upgrade: !!data?.limit?.canUpgrade, signup: !!data?.signup }]); if (data?.signup) setDemoLeft(null); return; }
      if (data.conversationId) setConvId(data.conversationId);
      if (data.demo) setDemoLeft(data.demo);
      setMsgs([...next, { id: data.messageId ?? undefined, role: "assistant", content: data.reply ?? "", actions: (data.actions ?? []).map((a: Action) => ({ ...a, state: "pending" })) }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: s.err }]);
    } finally { setBusy(false); setLive(null); }
  }

  function patchAction(mi: number, ai: number, p: Partial<Action>) {
    setMsgs((m) => m.map((x, i) => (i !== mi ? x : { ...x, actions: x.actions?.map((a, j) => (j === ai ? { ...a, ...p } : a)) })));
  }
  async function confirm(mi: number, ai: number) {
    const a = msgs[mi]?.actions?.[ai]; if (!a || a.state !== "pending") return;
    if (demo) { showDemoReadOnly(); return; } // þjónninn lokar líka /api/assistant/execute í demo
    patchAction(mi, ai, { state: "busy" });
    try {
      const res = await fetch("/api/assistant/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: a.tool, input: a.input, lang }) });
      const data = await res.json();
      patchAction(mi, ai, data.ok ? { state: "done" } : { state: "error", error: data.error ?? s.err });
      if (data.ok) { saveState(mi, ai, "done"); router.refresh(); }
    } catch { patchAction(mi, ai, { state: "error", error: s.err }); }
  }
  async function confirmAll(mi: number) {
    if (demo) { showDemoReadOnly(); return; }
    const acts = msgs[mi]?.actions ?? [];
    for (let i = 0; i < acts.length; i++) if (acts[i].state === "pending") await confirm(mi, i);
  }

  return (
    <>
      <button className={`vai-fab${open ? " on" : " pill"}${path?.startsWith("/spjall") ? " up" : ""}`} onClick={() => setOpen((o) => !o)} aria-label={open ? s.close : s.open} title={`${s.name} (⌘J)`}>{open ? <svg viewBox="0 0 24 24" className="x" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg> : <><Spark /><span>{s.name}</span></>}</button>
      {open && (
        <div className={`vai-panel${wide ? " wide" : ""}`} role="dialog" aria-label={s.name}>
          <div className="vai-head">
            <span className="vai-badge"><Spark /></span>
            <b>{s.name}</b>
            <span className="vai-sp" />
            <button className={`vai-ico${hist ? " on" : ""}`} onClick={openHistory} title={s.history} aria-label={s.history}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></button>
            {msgs.length > 0 && <button className="vai-ico" onClick={fresh} title={s.reset} aria-label={s.reset}><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>}
            <button className="vai-ico vai-wide" onClick={() => setWide((w) => !w)} title={wide ? s.narrow : s.wide} aria-label={wide ? s.narrow : s.wide}>{wide ? <svg viewBox="0 0 24 24"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg> : <svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>}</button>
            <button className="vai-ico" onClick={() => setOpen(false)} aria-label={s.close}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          {hist && (
            <div className="vai-hist">
              <div className="vai-hist-h"><b>{s.history}</b><button className="btn ghost sm" onClick={() => setHist(null)}>{s.back}</button></div>
              {hist.length === 0 ? <p className="vai-muted">{s.noHistory}</p> : hist.map((c) => (
                <div key={c.id} className={`vai-conv${c.id === convId ? " on" : ""}`}>
                  <button className="vai-conv-t" onClick={() => openConv(c.id)}><b>{c.title || s.name}</b><small>{(() => { const d = new Date(c.updated_at); return `${d.getDate()}.${d.getMonth() + 1}.`; })()}</small></button>
                  {!demo && <button className="vai-ico" onClick={() => delConv(c.id)} title={s.del} aria-label={s.del}><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>}
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
                {m.signup && <div className="vai-acts"><button className="btn sm" onClick={() => window.location.assign("/nyskraning")}>{s.signup}</button></div>}
                {m.upgrade && <div className="vai-acts"><button className="btn sm" onClick={() => { setOpen(false); router.push("/stillingar?tab=askrift#vakto-ai"); }}>{s.upgrade}</button></div>}
                {m.actions?.filter((a) => a.tool === "plan_week" && Array.isArray(a.input?.shifts)).map((a, j) => <PlanGrid key={`g${j}`} shifts={a.input.shifts as string[]} s={s} />)}
                {m.actions && m.actions.length > 0 && (
                  <div className="vai-acts">
                    {m.actions.map((a, j) => (
                      <div key={j} className={`vai-act ${a.state}`}>
                        <span className="vai-act-tx">{a.summary}{a.state === "error" && <small>{a.error}</small>}{demo && a.state === "pending" && <small>{s.viewOnly}</small>}</span>
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
            {busy && !live && <div className="vai-msg assistant"><div className="vai-bub vai-think"><span className="vai-dots"><i /><i /><i /></span>{s.thinking}</div></div>}
            {busy && live && (
              <div className="vai-msg assistant" aria-live="polite">
                {live.text && <div className="vai-bub"><Rich text={live.text} /></div>}
                {live.plan.length > 0 && <PlanGrid shifts={live.plan} s={s} head={s.planning(live.plan.length, live.total)} total={live.total} dept={live.dept} />}
                {live.actions.length > 0 && <div className="vai-acts">{live.actions.map((a, j) => <div key={j} className="vai-act pending"><span className="vai-act-tx">{a.summary}</span></div>)}</div>}
                {!live.text && live.stage !== "plan" && <div className="vai-bub vai-think"><span className="vai-dots"><i /><i /><i /></span>{stageLabel(live, s)}</div>}
              </div>
            )}
          </div>
          <form className="vai-in" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <textarea ref={input} rows={1} value={text} placeholder={s.ph} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <button type="submit" disabled={busy || !text.trim()} aria-label={s.send}><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </form>
          <div className="vai-note">{demoLeft ? `${s.left(demoLeft.left, demoLeft.of)} · ` : ""}{s.note}</div>
        </div>
      )}
    </>
  );
}
