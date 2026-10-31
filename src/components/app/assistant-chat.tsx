"use client";

// VAKTO AI — sameiginleg rökfræði og birting samtalsins. Notað bæði í fljótandi spjallinu í horninu
// (assistant-panel.tsx) og sem fest samtal í Spjallrásum (/spjall). Samtöl vistast á þjóninum
// (ai_conversations); opna samtalið er geymt í sessionStorage svo það fylgi á milli staða.
// Breytingar koma sem tillögur með „Staðfesta"-hnappi; ekkert er framkvæmt án hans.
import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "./lang";
import { showDemoReadOnly } from "./demo-guard";
import { isNdjson, readNdjson, type AssistantEvent } from "@/lib/ai/stream";

export type AssistantAction = { tool: string; input: Record<string, unknown>; summary: string; state?: "pending" | "busy" | "done" | "error" | "cancelled"; error?: string };
export type AssistantMsg = { id?: string; role: "user" | "assistant"; content: string; actions?: AssistantAction[]; upgrade?: boolean; signup?: boolean };
export type AssistantConv = { id: string; title: string; updated_at: string };
/** Svar í vinnslu: stig, texti sem streymir inn og vaktir plan_week jafnóðum. */
type Live = { stage: string; tool?: string; text: string; plan: string[]; total?: number; dept?: string; actions: AssistantAction[] };

const KEY = "vakto-assistant";
const KEY_ID = "vakto-assistant-id";

export const ASSISTANT_STRINGS = {
  is: {
    name: "VAKTO AI", open: "Opna VAKTO AI", close: "Loka", reset: "Nýtt samtal", history: "Fyrri samtöl", noHistory: "Engin vistuð samtöl enn.", del: "Eyða samtali", back: "Til baka", ph: "Spurðu um reksturinn eða biddu um breytingu…",
    send: "Senda", thinking: "Hugsa…", confirm: "Staðfesta", viewOnly: "Aðeins til skoðunar í demo — tillagan er ekki framkvæmd.", cancel: "Hætta við", all: "Staðfesta allt", done: "Gert", cancelled: "Hætt við",
    hello: "Hæ! Ég get svarað spurningum um laun, tíma og vaktir, sett upp vaktaplan fyrir heila viku og undirbúið breytingar sem þú staðfestir.",
    err: "Tókst ekki að ná sambandi. Reyndu aftur.",
    chips: ["Hvernig er laun % af veltu þessa vikuna?", "Berðu saman launakostnað og tíma í þessum mánuði og síðasta", "Settu upp næstu viku: allir með einn frídag", "Hver er á vakt núna?", "Láttu mig vita ef einhver fer yfir 180 tíma í mánuðinum"],
    wide: "Stækka", narrow: "Minnka",
    note: "VAKTO AI getur gert mistök. Breytingar eru aðeins gerðar þegar þú staðfestir.",
    st: { think: "Hugsa…", web_search: "Fletti upp á vef stéttarfélaga…", web_fetch: "Les launatöflu…", read: "Sæki gögn…", week_planning_context: "Les vaktaplan, starfsfólk og beiðnir…", shifts: "Les vaktaplanið…", pending_requests: "Les beiðnir…", who_is_on_now: "Athuga hver er á vakt…", labor: "Reikna laun og tíma…", write: "Undirbý tillögu…", summary: "Skrifa samantekt…" },
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
    st: { think: "Thinking…", web_search: "Searching union websites…", web_fetch: "Reading the wage table…", read: "Fetching data…", week_planning_context: "Reading schedule, staff and requests…", shifts: "Reading the schedule…", pending_requests: "Reading requests…", who_is_on_now: "Checking who is on shift…", labor: "Calculating labor and hours…", write: "Preparing a proposal…", summary: "Writing a summary…" },
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
    st: { think: "Myślę…", web_search: "Szukam na stronach związków…", web_fetch: "Czytam tabelę płac…", read: "Pobieram dane…", week_planning_context: "Czytam grafik, pracowników i wnioski…", shifts: "Czytam grafik…", pending_requests: "Czytam wnioski…", who_is_on_now: "Sprawdzam, kto jest na zmianie…", labor: "Liczę koszty pracy i godziny…", write: "Przygotowuję propozycję…", summary: "Piszę podsumowanie…" },
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
    st: { think: "Đang suy nghĩ…", web_search: "Đang tra cứu trang công đoàn…", web_fetch: "Đang đọc bảng lương…", read: "Đang lấy dữ liệu…", week_planning_context: "Đang đọc lịch, nhân viên và yêu cầu…", shifts: "Đang đọc lịch làm việc…", pending_requests: "Đang đọc yêu cầu…", who_is_on_now: "Đang kiểm tra ai đang làm…", labor: "Đang tính chi phí lương và giờ làm…", write: "Đang chuẩn bị đề xuất…", summary: "Đang viết tóm tắt…" },
    planning: (n: number, of?: number) => of ? `Đang xếp ca… ${n}/${of}` : `Đang xếp ca… ${n}`, days: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    upgrade: "Bật VAKTO AI",
    signup: "Tạo công ty — dùng thử miễn phí 14 ngày", left: (n: number, of: number) => `Còn ${n}/${of} câu hỏi trong bản demo`,
  },
};
export type AssistantStrings = (typeof ASSISTANT_STRINGS)["is"];

/** **feitletrun**, [tenglar](https://…), línuskil og „- “ listar. */
function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((ln, i) => {
        // Fyrirsagnir („## …“) verða feitletruð lína.
        if (/^\s*#{1,6}\s+/.test(ln)) return <p key={i} className="vai-h"><b>{ln.replace(/^\s*#{1,6}\s+/, "").replace(/\*\*/g, "")}</b></p>;
        const li = /^\s*[-•*]\s+/.test(ln);
        const parts = ln.replace(/^\s*[-•*]\s+/, "").split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
        const inner = parts.map((p, k) => {
          if (p.startsWith("**") && p.endsWith("**")) return <b key={k}>{p.slice(2, -2)}</b>;
          const a = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(p); // heimild úr vefleit
          return a ? <a key={k} href={a[2]} target="_blank" rel="noreferrer">{a[1]}</a> : <Fragment key={k}>{p}</Fragment>;
        });
        return li ? <div key={i} className="vai-li">{inner}</div> : ln.trim() ? <p key={i}>{inner}</p> : null;
      })}
    </>
  );
}

const LABOR_TOOLS = new Set(["labor_summary", "staff_hours", "compare_periods", "labor_trend", "payroll_runs", "sick_rate"]);
/** Texti framvindunnar: hvað VAKTO AI er að gera núna. */
function stageLabel(live: Live, s: AssistantStrings): string {
  if (live.stage === "plan") return s.planning(live.plan.length, live.total);
  if (live.stage === "read") {
    const t = live.tool ?? "";
    return t in s.st ? s.st[t as keyof AssistantStrings["st"]] : LABOR_TOOLS.has(t) ? s.st.labor : s.st.read;
  }
  return live.stage in s.st ? s.st[live.stage as keyof AssistantStrings["st"]] : s.st.think;
}

/** Vikuyfirlit vaktaplans-tillögu („Nafn|YYYY-MM-DD|HH:MM|HH:MM“): fyllist jafnóðum á meðan líkanið skrifar. */
function PlanGrid({ shifts, s, head, total, dept }: { shifts: string[]; s: AssistantStrings; head?: string; total?: number; dept?: string }) {
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

export const Spark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" /><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" /></svg>;

export type AssistantChat = ReturnType<typeof useAssistantChat>;

/**
 * Ástand og aðgerðir eins VAKTO AI-samtals. `demo`: opna demoið er aðeins til skoðunar —
 * spurningum er svarað, tillögur sýndar en ekki framkvæmdar (þjónninn lokar líka á þær).
 */
export function useAssistantChat({ demo = false }: { demo?: boolean } = {}) {
  const { lang } = useLang();
  const s = ASSISTANT_STRINGS[lang];
  const path = usePathname();
  const router = useRouter();
  const [msgs, setMsgs] = useState<AssistantMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Live | null>(null); // svar sem er að streyma inn
  const [convId, setConvId] = useState<string | null>(null);
  const [history, setHistory] = useState<AssistantConv[] | null>(null); // null = ekki sótt / lokað
  const [demoLeft, setDemoLeft] = useState<{ left: number; of: number } | null>(null); // opið demo: spurningar eftir hjá gestinum
  // Biður innsláttinn um fókus (AssistantComposer á sinn eigin ref).
  const [focusKey, setFocusKey] = useState(0);
  const focus = () => setFocusKey((k) => k + 1);

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

  function fresh() { setMsgs([]); setConvId(null); }
  async function loadHistory() {
    setHistory((h) => h ?? []);
    try { const d = await (await fetch("/api/assistant/conversations")).json(); setHistory(d.conversations ?? []); } catch { /* listinn helst tómur */ }
  }
  function closeHistory() { setHistory(null); }
  async function openConv(id: string) {
    try {
      const d = await (await fetch(`/api/assistant/conversations?id=${id}`)).json();
      setMsgs((d.messages ?? []).map((m: { id: string; role: AssistantMsg["role"]; content: string; actions: AssistantAction[] | null }) => ({ id: m.id, role: m.role, content: m.content, actions: m.actions ?? undefined })));
      setConvId(id);
      return true;
    } catch { return false; }
  }
  async function delConv(id: string) {
    setHistory((h) => h?.filter((c) => c.id !== id) ?? null);
    if (id === convId) { setMsgs([]); setConvId(null); }
    try { await fetch(`/api/assistant/conversations?id=${id}`, { method: "DELETE" }); } catch { /* ekkert */ }
  }
  /** Vistar stöðu tillögu (staðfest / hætt við) svo hún sé rétt þegar samtalið er opnað aftur. */
  function saveState(mi: number, ai: number, state: "done" | "cancelled" | "error") {
    const id = msgs[mi]?.id; if (!id || demo) return;
    void fetch("/api/assistant/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id, index: ai, state }) }).catch(() => {});
  }

  async function send(q: string) {
    const content = q.trim();
    if (!content || busy) return;
    const next: AssistantMsg[] = [...msgs, { role: "user", content }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, lang, conversationId: convId, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      // Streymt svar (NDJSON): framvinda, texti og vaktir birtast jafnóðum; „done“ er lokasvarið.
      let data: { ok?: boolean; error?: string; limit?: { canUpgrade?: boolean }; signup?: boolean; conversationId?: string; demo?: { left: number; of: number }; messageId?: string; reply?: string; actions?: AssistantAction[] } | null = null;
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
      if (data.conversationId) {
        setConvId(data.conversationId);
        // nýtt samtal birtist strax efst í sögunni ef hún er opin
        const cid = data.conversationId;
        setHistory((h) => (h === null ? null : [{ id: cid, title: h.find((c) => c.id === cid)?.title ?? content.slice(0, 70), updated_at: new Date().toISOString() }, ...h.filter((c) => c.id !== cid)]));
      }
      if (data.demo) setDemoLeft(data.demo);
      setMsgs([...next, { id: data.messageId ?? undefined, role: "assistant", content: data.reply ?? "", actions: (data.actions ?? []).map((a: AssistantAction) => ({ ...a, state: "pending" })) }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: s.err }]);
    } finally { setBusy(false); setLive(null); }
  }

  function patchAction(mi: number, ai: number, p: Partial<AssistantAction>) {
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
  function cancelAction(mi: number, ai: number) { patchAction(mi, ai, { state: "cancelled" }); saveState(mi, ai, "cancelled"); }

  return {
    s, demo, msgs, text, setText, busy, live, convId, history, demoLeft, focusKey, focus,
    send, fresh, loadHistory, closeHistory, openConv, delConv, confirm, confirmAll, cancelAction,
  };
}

/** Skilaboðalisti samtalsins: kveðja + tillögur í byrjun, svör, tillögur með Staðfesta/Hætta við og svar sem streymir. */
export function AssistantMessages({ chat, onUpgrade, className = "vai-list", hidden }: { chat: AssistantChat; onUpgrade: () => void; className?: string; hidden?: boolean }) {
  const { s, demo, msgs, busy, live } = chat;
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  // Á meðan svar streymir inn: fylgja botninum (án mjúkrar hreyfingar svo það hökti ekki við hvert orð).
  const liveSize = live ? live.text.length + live.plan.length * 40 + live.actions.length : 0;
  useEffect(() => { if (liveSize) list.current?.scrollTo({ top: list.current.scrollHeight }); }, [liveSize]);
  return (
    <div className={className} ref={list} hidden={hidden}>
      {msgs.length === 0 && (
        <div className="vai-hello">
          <p>{s.hello}</p>
          <div className="vai-chips">{s.chips.map((c) => <button key={c} onClick={() => chat.send(c)}>{c}</button>)}</div>
        </div>
      )}
      {msgs.map((m, i) => (
        <div key={i} className={`vai-msg ${m.role}`}>
          {m.content && <div className="vai-bub">{m.role === "assistant" ? <Rich text={m.content} /> : m.content}</div>}
          {m.signup && <div className="vai-acts"><button className="btn sm" onClick={() => window.location.assign("/nyskraning")}>{s.signup}</button></div>}
          {m.upgrade && <div className="vai-acts"><button className="btn sm" onClick={onUpgrade}>{s.upgrade}</button></div>}
          {m.actions?.filter((a) => a.tool === "plan_week" && Array.isArray(a.input?.shifts)).map((a, j) => <PlanGrid key={`g${j}`} shifts={a.input.shifts as string[]} s={s} />)}
          {m.actions && m.actions.length > 0 && (
            <div className="vai-acts">
              {m.actions.map((a, j) => (
                <div key={j} className={`vai-act ${a.state}`}>
                  <span className="vai-act-tx">{a.summary}{a.state === "error" && <small>{a.error}</small>}{demo && a.state === "pending" && <small>{s.viewOnly}</small>}</span>
                  {a.state === "pending" && (<span className="vai-act-b">
                    <button className="btn sm" onClick={() => chat.confirm(i, j)}>{s.confirm}</button>
                    <button className="btn ghost sm" onClick={() => chat.cancelAction(i, j)}>{s.cancel}</button>
                  </span>)}
                  {a.state === "busy" && <span className="vai-dots"><i /><i /><i /></span>}
                  {a.state === "done" && <span className="vai-ok">✓ {s.done}</span>}
                  {a.state === "cancelled" && <span className="vai-muted">{s.cancelled}</span>}
                </div>
              ))}
              {m.actions.filter((a) => a.state === "pending").length > 1 && <button className="btn sm vai-all" onClick={() => chat.confirmAll(i)}>{s.all}</button>}
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
  );
}

/** Innsláttur + fyrirvari (og spurningar eftir í demo). */
export function AssistantComposer({ chat, placeholder }: { chat: AssistantChat; placeholder?: string }) {
  const { s, text, busy, demoLeft, focusKey } = chat;
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (focusKey) input.current?.focus(); }, [focusKey]);
  return (
    <>
      <form className="vai-in" onSubmit={(e) => { e.preventDefault(); chat.send(text); }}>
        <textarea ref={input} rows={1} value={text} placeholder={placeholder ?? s.ph} enterKeyHint="send" onChange={(e) => chat.setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chat.send(text); } }} />
        <button type="submit" disabled={busy || !text.trim()} aria-label={s.send}><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
      <div className="vai-note">{demoLeft ? `${s.left(demoLeft.left, demoLeft.of)} · ` : ""}{s.note}</div>
    </>
  );
}

/** Listi yfir vistuð samtöl (opna / eyða). */
export function AssistantHistoryList({ chat, onOpened }: { chat: AssistantChat; onOpened?: () => void }) {
  const { s, demo, history, convId } = chat;
  if (!history) return null;
  if (history.length === 0) return <p className="vai-muted">{s.noHistory}</p>;
  return (
    <>
      {history.map((c) => (
        <div key={c.id} className={`vai-conv${c.id === convId ? " on" : ""}`}>
          <button className="vai-conv-t" onClick={async () => { if (await chat.openConv(c.id)) onOpened?.(); }}><b>{c.title || s.name}</b><small>{(() => { const d = new Date(c.updated_at); return `${d.getDate()}.${d.getMonth() + 1}.`; })()}</small></button>
          {!demo && <button className="vai-ico" onClick={() => chat.delConv(c.id)} title={s.del} aria-label={s.del}><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>}
        </div>
      ))}
    </>
  );
}
