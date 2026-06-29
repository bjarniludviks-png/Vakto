"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { nf } from "@/lib/format";
import { publishSchedule, updateLeaveRequest, approveShiftSwap, saveShift, assignOpenShift, getWeekShifts, type ShiftInput } from "./actions";
import type { ReqItem } from "./requests.server";
import type { ScheduleInitial } from "./schedule.server";

type Emp = [string, string, string, string]; // initials, name, dept, color
type ShiftDef = { l: string; s: string; h: number; c: "day" | "eve" | "off" };
type ShiftType = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
type AiItem = { kind: "good" | "info" | "warn" | "bad"; title: string; detail: string; tag: string };
type AiProposal = { summary: string; items: AiItem[]; laborPct: string; live: boolean; error?: string };

const COST_HR = 3752, BASE_HRS = 116;
const SH: Record<string, ShiftDef> = {
  D: { l: "08–16", s: "Dagvakt", h: 8, c: "day" },
  M: { l: "07–13", s: "Morgun", h: 6, c: "day" },
  Mi: { l: "11–19", s: "Mið", h: 8, c: "day" },
  E: { l: "14–22", s: "Kvöld", h: 8, c: "eve" },
  L: { l: "16–24", s: "Kvöld", h: 8, c: "eve" },
  off: { l: "Frí", s: "", h: 0, c: "off" },
};
const INIT_EMP: Emp[] = [
  ["MÍ", "Mína", "Vaktstjóri", "#5b50e6"], ["BA", "Bach", "Sal", "#1fb6a6"],
  ["PH", "Phong", "Eldhús", "#18a06a"], ["ÓM", "Ómar", "Sal", "#e0533f"],
  ["HA", "Ha Vu", "Eldhús", "#0891b2"], ["JÓ", "Jón", "Vakt", "#8b7bff"],
];
const INIT_GRID: string[][] = [
  ["D", "D", "D", "D", "L", "off", "off"],
  ["E", "E", "off", "E", "E", "D", "D"],
  ["M", "D", "D", "M", "off", "Mi", "Mi"],
  ["D", "Mi", "L", "Mi", "L", "L", "off"],
  ["off", "M", "M", "D", "D", "off", "D"],
  ["M", "off", "D", "off", "M", "D", "D"],
];
const INIT_POOL: Emp[] = [
  ["TR", "Truong", "Eldhús", "#0f766e"], ["MO", "Moon", "Sal", "#2563eb"],
  ["NG", "Ngoan", "Eldhús", "#16a34a"], ["DA", "Dalya", "Sal", "#ca8a04"],
  ["FA", "Fannar", "Stjórnun", "#9333ea"], ["LO", "Lóa", "Sal", "#e11d48"],
];
const INIT_TYPES: ShiftType[] = [
  { nm: "Dagvakt", t: "08:00–16:00", prem: "Dagvinna", bg: "#eef0ff", bd: "#e0e2fb", fg: "#4338ca" },
  { nm: "Morgunvakt", t: "07:00–13:00", prem: "+33% fyrir 07:00", bg: "#e7f6ef", bd: "#cdeede", fg: "#1f9d6b" },
  { nm: "Kvöldvakt", t: "16:00–24:00", prem: "+33% álag", bg: "#fff2e2", bd: "#fbe2c4", fg: "#b06a12" },
  { nm: "Helgarvakt", t: "12:00–20:00", prem: "+45% helgarálag", bg: "#fde9e6", bd: "#f8d2cb", fg: "#c0392b" },
];
const DAYS = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
const DN = [22, 23, 24, 25, 26, 27, 28];
const WEEK_MON = new Date(2026, 5, 22); // base Monday (22 June 2026)
const TODAY_ISO = "2026-06-24"; // demo "today" — highlighted only when in view
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAYNAMES = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
const deptOf = (d: string) => (d === "Eldhús" ? "Eldhús" : d === "Sal" ? "Sal" : "Stjórnun");

const REQ_ICON: Record<ReqItem["kind"], React.ReactNode> = {
  leave: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" /></>,
  swap: <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />,
  avail: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
};

export default function ScheduleScreen({ requests = [], initial = null }: { requests?: ReqItem[]; initial?: ScheduleInitial | null }) {
  const [emp, setEmp] = useState<Emp[]>(initial?.emp ?? INIT_EMP);
  const [grid, setGrid] = useState<string[][]>(initial?.grid ?? INIT_GRID);
  const [pool, setPool] = useState<Emp[]>(initial?.pool ?? INIT_POOL);
  const [types, setTypes] = useState<ShiftType[]>(initial?.types?.length ? initial.types : INIT_TYPES);
  const [dept, setDept] = useState("all");
  const [view, setView] = useState<"Vika" | "Dagur" | "Mánuður">("Vika");
  const [wk, setWk] = useState(0);
  const [selDay, setSelDay] = useState(24);
  const [drag, setDrag] = useState<{ r: number; c: number } | null>(null);
  const [clip, setClip] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "types" | "addEmp" | "shift" | "ai" | "aiResult">(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { t } = useLang();

  const vis = useMemo(
    () => emp.map((_, r) => r).filter((r) => dept === "all" || deptOf(emp[r][2]) === dept),
    [emp, dept],
  );
  const visHrs = useMemo(() => {
    let h = 0;
    grid.forEach((row) => row.forEach((s) => { if (s && s !== "off") h += SH[s].h; }));
    return h;
  }, [grid]);
  // Real (signed-in) companies start at 0 — BASE_HRS is only demo padding.
  const liveCompany = !!initial;
  const totalHrs = visHrs + (liveCompany ? 0 : BASE_HRS);
  const cost = totalHrs * COST_HR;

  // Actual dates for the viewed week — shift the base Monday by wk weeks.
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(WEEK_MON); d.setDate(d.getDate() + wk * 7 + i); return d; }),
    [wk],
  );
  const todayCol = weekDays.findIndex((d) => fmtISO(d) === TODAY_ISO);

  // Live companies: load that week's published shifts from the DB when the
  // week changes. The base week (wk 0) is already in `initial` from SSR, so we
  // skip the first run and keep the server-rendered grid to avoid a flash.
  const firstWeekRun = useRef(true);
  useEffect(() => {
    if (!liveCompany) return;
    if (firstWeekRun.current) { firstWeekRun.current = false; return; }
    const mon = new Date(WEEK_MON); mon.setDate(mon.getDate() + wk * 7);
    let cancelled = false;
    getWeekShifts(fmtISO(mon)).then((res) => {
      if (!cancelled && res?.ok) setGrid(res.grid);
    });
    return () => { cancelled = true; };
  }, [wk, liveCompany]);

  const d0 = weekDays[0], d6 = weekDays[6];
  const wklbl = d0.getMonth() === d6.getMonth()
    ? `${d0.getDate()}.–${d6.getDate()}. ${MONTHS_IS[d0.getMonth()]}`
    : `${d0.getDate()}. ${MONTHS_IS[d0.getMonth()].slice(0, 3)} – ${d6.getDate()}. ${MONTHS_IS[d6.getMonth()].slice(0, 3)}`;

  // Per-day hours + shift counts, computed from the actual grid.
  const dayStats = weekDays.map((dd, c) => {
    let h = 0, n = 0;
    vis.forEach((r) => { const s = grid[r]?.[c]; if (s && s !== "off") { h += SH[s].h; n++; } });
    return [c, dd.getDate(), h, n] as [number, number, number, number];
  });
  const totDayHrs = dayStats.reduce((a, d) => a + d[2], 0);
  const totDayShifts = dayStats.reduce((a, d) => a + d[3], 0);

  // KPI tölur fylgja sýninni (vika / dagur / mánuður).
  const dayIdx = Math.max(0, DN.indexOf(selDay));
  const dayHrs = useMemo(() => {
    let h = 0; vis.forEach((r) => { const s = grid[r]?.[dayIdx]; if (s && s !== "off") h += SH[s].h; }); return h;
  }, [vis, grid, dayIdx]);
  const weekShifts = useMemo(() => {
    let n = 0; vis.forEach((r) => grid[r]?.forEach((s) => { if (s && s !== "off") n++; })); return n;
  }, [vis, grid]);
  const dayShiftCount = useMemo(() => {
    let n = 0; vis.forEach((r) => { const s = grid[r]?.[dayIdx]; if (s && s !== "off") n++; }); return n;
  }, [vis, grid, dayIdx]);
  const kpi = view === "Dagur"
    ? { hl: "Tímar dagsins", hrs: dayHrs, sl: "Vaktir í dag", shifts: dayShiftCount, open: false }
    : view === "Mánuður"
      ? { hl: "Tímar mánaðar", hrs: Math.round(totalHrs * 4.33), sl: "Vaktir í mánuði", shifts: weekShifts * 4, open: false }
      : { hl: "Tímar vikunnar", hrs: totalHrs, sl: "Vaktir í viku", shifts: weekShifts, open: true };

  async function decideLeave(id: string | null, approved: boolean) {
    if (!id) { toast(approved ? "Samþykkt" : "Hafnað"); return; }
    const res = await updateLeaveRequest(id, approved);
    toast(res.ok ? (approved ? "Samþykkt" : "Hafnað") : (res.error ?? "Villa"));
  }
  async function decideSwap(id: string | null) {
    if (!id) { toast("Samþykkt"); return; }
    const res = await approveShiftSwap(id);
    toast(res.ok ? "Samþykkt" : (res.error ?? "Villa"));
  }

  function buildShiftPayload(): ShiftInput[] {
    const out: ShiftInput[] = [];
    emp.forEach((e, r) => {
      grid[r]?.forEach((code, c) => {
        if (code && code !== "off") {
          const o = SH[code];
          const [a, b] = o.l.split("–");
          out.push({
            employeeName: e[1],
            date: fmtISO(weekDays[c]),
            startTime: `${a.padStart(2, "0")}:00`,
            endTime: `${b.padStart(2, "0")}:00`,
            shiftTypeName: o.s || "Dagvakt",
          });
        }
      });
    });
    return out;
  }
  async function publish() {
    const res = await publishSchedule(buildShiftPayload());
    if (!res.ok) { toast(res.error ?? "Tókst ekki að birta"); return; }
    toast(res.demo ? `Plan birt (demo — ${res.count} vaktir)` : `Plan birt — ${res.count} vaktir vistaðar`);
  }

  async function runAi(prompt: string) {
    setAiQuery(prompt);
    setAiProposal(null);
    setAiLoading(true);
    setModal("aiResult");
    const context = `Starfsmenn á plani: ${emp.map((e) => `${e[1]} (${e[2]})`).join(", ")}. `
      + `Tímar vikunnar: ${totalHrs} klst. Launakostnaður: ${nf(cost)} kr. `
      + `Áætluð velta vikunnar: 4.300.000 kr. `
      + `Vaktategundir: ${types.map((t) => `${t.nm} ${t.t} ${t.prem}`).join("; ")}.`;
    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
      });
      const data = (await res.json()) as AiProposal;
      setAiProposal(data);
    } catch {
      setAiProposal({
        summary: prompt ? `„${prompt}"` : "Bestun vaktaplans",
        laborPct: "31,8%",
        live: false,
        items: [{ kind: "info", title: "Tókst ekki að ná í AI", detail: "Sýni demo-tillögu.", tag: "demo" }],
      });
    } finally {
      setAiLoading(false);
    }
  }

  function dropOn(tr: number, tc: number) {
    if (!drag) return;
    setGrid((g) => {
      const ng = g.map((row) => [...row]);
      const tmp = ng[drag.r][drag.c];
      ng[drag.r][drag.c] = ng[tr][tc];
      ng[tr][tc] = tmp;
      return ng;
    });
    setDrag(null);
  }
  function cellClick(r: number, c: number) {
    if (clip !== null) {
      setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = clip; return ng; });
      toast("Vakt límd");
      return;
    }
    setModal("shift");
  }
  function removeEmpRow(r: number) {
    const nm = emp[r][1];
    setPool((p) => [...p, emp[r]]);
    setEmp((e) => e.filter((_, i) => i !== r));
    setGrid((g) => g.filter((_, i) => i !== r));
    toast(nm + " fjarlægð(ur) af plani");
  }
  function pickEmp(i: number) {
    const p = pool[i];
    setEmp((e) => [...e, p]);
    setGrid((g) => [...g, ["off", "off", "off", "off", "off", "off", "off"]]);
    setPool((pp) => pp.filter((_, j) => j !== i));
    setModal(null);
    toast(p[1] + " bætt á plan");
  }
  function dayShifts(d: number) {
    const wd = (d - 1) % 7;
    const out: { i: string; n: string; c: string; dep: string; l: string; h: number; type: string; start: number }[] = [];
    emp.forEach((e, r) => {
      const s = grid[r]?.[wd];
      if (s && s !== "off") {
        const o = SH[s];
        out.push({ i: e[0], n: e[1], c: e[3], dep: e[2], l: o.l, h: o.h, type: o.c, start: parseInt(o.l) });
      }
    });
    return out.sort((a, b) => a.start - b.start);
  }

  return (
    <>
      <PageHeader
        title="Vaktaplan"
        subtitle="Vika 22.–28. júní 2026"
        actions={
          <>
            <button className="btn ghost sm">
              <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 6 }}>
                <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" />
              </svg>{t("Afrita viku")}
            </button>
            <button className="btn sm" style={{ marginLeft: 8 }} onClick={publish}>{t("Birta plan")}</button>
          </>
        }
      />

      <div className="stoolbar">
        <div className="wk">
          <button onClick={() => setWk((w) => w - 1)}>‹</button>
          <span className="lbl">{wklbl}</span>
          <button onClick={() => setWk((w) => w + 1)}>›</button>
        </div>
        <button className="btn ghost sm" onClick={() => setWk(0)}>{t("Þessi vika")}</button>
        <div className="seg" style={{ marginLeft: 4 }}>
          {(["Vika", "Dagur", "Mánuður"] as const).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{t(v)}</button>
          ))}
        </div>
        <select className="badge" style={{ border: "1px solid var(--line)", padding: "7px 11px" }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">{t("Allar deildir")}</option>
          <option value="Eldhús">Eldhús</option>
          <option value="Sal">Sal</option>
          <option value="Stjórnun">Stjórnun</option>
        </select>
        <div className="sp" style={{ flex: 1 }} />
        <button className="btn sm" onClick={() => setModal("ai")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z" /></svg>{t("Biðja AI")}
        </button>
        <button className="btn ghost sm" onClick={() => setModal("shift")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>{t("Vakt")}
        </button>
      </div>

      {clip !== null && (
        <div id="pastebar" style={{ display: "flex" }}>
          <span className="pbtxt"><b>{t("Líma-hamur:")}</b> {t("smelltu á reiti til að líma")} {clip !== "off" ? `„${SH[clip].l}"` : t("frí")}</span>
          <button className="btn ghost sm" onClick={() => setClip(null)}>{t("Hætta")}</button>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="lab">{t(kpi.hl)}</div><div className="val">{kpi.hrs} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Launakostnaður")}</div><div className="val">{nf(kpi.hrs * COST_HR)} <small>kr</small></div></div>
        <div className="kpi"><div className="lab">{t(kpi.sl)}</div><div className="val">{kpi.shifts}{kpi.open && !liveCompany ? <small> · 2 {t("opnar")}</small> : null}</div></div>
        <div className="kpi"><div className="lab">{t("Stöðugildi (FTE)")}</div><div className="val">{liveCompany ? (initial?.fte ?? "0,0") : "8,4"}</div></div>
      </div>

      {view === "Vika" && (
        <div>
          <div className="sgrid-wrap" style={{ marginTop: 16 }}>
            <table className="sgrid">
              <thead>
                <tr>
                  <th>{t("Starfsmaður")}</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className={i === todayCol ? "tod" : ""}>{t(d)}<span className="dn">{weekDays[i].getDate()}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vis.map((r) => {
                  const e = emp[r];
                  return (
                    <tr key={r}>
                      <td className="nm">
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span className="who"><span className="avt" style={{ background: e[3] }}>{e[0]}</span><span>{e[1]}<small>{t(e[2])}</small></span></span>
                          <button className="rmemp" title={t("Fjarlægja af plani")} onClick={() => removeEmpRow(r)}>✕</button>
                        </div>
                      </td>
                      {grid[r].map((s, c) => (
                        <td
                          key={c}
                          className={c === todayCol ? "tod" : ""}
                          onDragOver={(ev) => { ev.preventDefault(); ev.currentTarget.classList.add("cellh"); }}
                          onDragLeave={(ev) => ev.currentTarget.classList.remove("cellh")}
                          onDrop={(ev) => { ev.preventDefault(); ev.currentTarget.classList.remove("cellh"); dropOn(r, c); }}
                        >
                          <div
                            className={`shift ${SH[s].c}`}
                            draggable
                            onDragStart={() => setDrag({ r, c })}
                            onClick={() => cellClick(r, c)}
                          >
                            {s === "off" ? t("Frí") : <>{SH[s].l}<small>{SH[s].s ? t("sh:" + SH[s].s) :" "}</small></>}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="foot">
                  <td style={{ textAlign: "left" }}>{t("Klst þann dag")}</td>
                  {Array.from({ length: 7 }, (_, c) => {
                    let n = 0;
                    vis.forEach((r) => { const s = grid[r][c]; if (s && s !== "off") n += SH[s].h; });
                    return <td key={c} className={c === todayCol ? "tod" : ""}>{n}</td>;
                  })}
                </tr>
                <tr className="addrow">
                  <td colSpan={8}>
                    <button className="addemp" onClick={() => (pool.length ? setModal("addEmp") : toast("Allt starfsfólk er þegar á plani"))}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>{t("Bæta starfsmanni á plan")}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 12.5, color: "var(--ink2)" }}>
            <div style={{ display: "flex", gap: 15, flexWrap: "wrap", alignItems: "center" }}>
              {types.map((ty) => (
                <span key={ty.nm} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <i style={{ width: 11, height: 11, borderRadius: 3, background: ty.bg, border: `1px solid ${ty.bd}` }} />
                  {t(ty.nm)}{ty.prem && ty.prem !== "Dagvinna" && <span className="muted" style={{ fontSize: 11 }}> ({t(ty.prem)})</span>}
                </span>
              ))}
            </div>
            <button className="btn ghost sm" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setModal("types")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>{t("Vaktategundir")}
            </button>
            <span className="muted">{t("Dragðu vaktir milli reita — kostnaður uppfærist strax.")}</span>
          </div>
        </div>
      )}

      {view === "Dagur" && <DayView day={selDay} rows={dayShifts(selDay)} onAdd={() => setModal("shift")} />}
      {view === "Mánuður" && <MonthView dayShifts={dayShifts} onOpenDay={(d) => { setSelDay(d); setView("Dagur"); }} />}

      <div className="grid2b">
        <div className="card">
          <div className="ch"><div className="ct"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 6 }}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></svg>{t("AI-vaktaplan")}</div><div className="cs">{t("segðu markmið — Vakto endurraðar")}</div></div>
          <div className="cb att">
            {[
              ["Lækka launakostnað um 10%", "haltu mönnun en lægri launum"],
              ["Minnka yfirvinnu", "dreifa tímum, laga hvíld"],
              ["Halda launum undir 30% af veltu", "stilla mönnun að veltuspá"],
            ].map((x) => (
              <div className="it" key={x[0]} style={{ cursor: "pointer" }} onClick={() => runAi(x[0])}>
                <div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8l5 5 4-3 6 7" /><path d="M16 17h4v-4" /></svg></div>
                <div className="tx"><b>{t(x[0])}</b><span>{t(x[1])}</span></div><span className="tag info">{t("keyra")}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 6 }}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>{t("Tímar eftir dögum")}</div><div className="cs">{t("áætlað í planinu · þessi vika")}</div></div>
          <div className="cb">
            {dayStats.map((r) => (
              <div className="statline" key={r[1]}><span className="k">{t(DAYNAMES[r[0]])} {r[1]}.</span><span className="v">{r[2]} {t("klst")} · {r[3]} {t("á vakt")}</span></div>
            ))}
            <div className="statline" style={{ borderTop: "1px solid var(--line)", marginTop: 5, paddingTop: 8 }}>
              <span className="k" style={{ fontWeight: 650, color: "var(--ink)" }}>{t("Samtals")}</span><span className="v" style={{ fontWeight: 700 }}>{totDayHrs} {t("klst")} · {totDayShifts} {t("vaktir")}</span>
            </div>
            {totDayHrs > 0 && !liveCompany && (
              <div className="ai" style={{ marginTop: 12 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z" /></svg>
                <div className="x">{t("Þriðjudagur er þyngstur (62 klst) en laugardagur undirmannaður um hádegi — færðu eina vakt af þriðjudegi á laugardag.")}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(!liveCompany || requests.length > 0) && (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div><div className="ct">{t("Beiðnir & opnar vaktir")}</div><div className="cs">{t("frá starfsfólki — samþykktu eða úthlutaðu")}</div></div><span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{requests.length + (liveCompany ? 0 : 1)} {t("ný")}</span></div>
        <div className="cb att">
          {requests.map((r, i) => (
            <div className="it" key={r.id ?? i}>
              <div className={`ic ${r.kind === "swap" ? "info" : "warn"}`}>
                <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor">{REQ_ICON[r.kind]}</svg>
              </div>
              <div className="tx"><b>{t(r.title)}</b><span>{t(r.detail)}</span></div>
              {r.kind === "leave" && <>
                <button className="btn sm" onClick={() => decideLeave(r.id, true)}>{t("Samþykkja")}</button>
                <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => decideLeave(r.id, false)}>{t("Hafna")}</button>
              </>}
              {r.kind === "swap" && <button className="btn sm" onClick={() => decideSwap(r.id)}>{t("Samþykkja")}</button>}
              {r.kind === "avail" && <span className="tag mut">{t("skráð")}</span>}
            </div>
          ))}
          {!liveCompany && <div className="it"><div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg></div><div className="tx"><b>{t("Opin vakt: laugardag 12–20")}</b><span>{t("2 starfsmenn sóttu um — Ha Vu, Dalya")}</span></div><button className="btn sm" onClick={async () => { const res = await assignOpenShift({ employeeName: "Ha Vu", note: "laugardag 12–20" }); toast(res.ok ? "Úthlutað" : (res.error ?? "Villa")); }}>{t("Úthluta")}</button></div>}
        </div>
      </div>
      )}

      {modal === "types" && <ShiftTypesModal types={types} setTypes={setTypes} onClose={() => setModal(null)} />}
      {modal === "addEmp" && <AddEmpModal pool={pool} onPick={pickEmp} onClose={() => setModal(null)} />}
      {modal === "shift" && <ShiftEditModal types={types} onClose={() => setModal(null)} onCopy={() => { setClip("D"); setModal(null); toast("Vakt afrituð — smelltu á reiti til að líma"); }} onTypes={() => setModal("types")} />}
      {modal === "ai" && <AiPromptModal query={aiQuery} setQuery={setAiQuery} onClose={() => setModal(null)} onGen={() => runAi(aiQuery)} />}
      {modal === "aiResult" && <AiResultModal query={aiQuery} proposal={aiProposal} loading={aiLoading} onClose={() => setModal(null)} onEdit={() => setModal("ai")} onApprove={async () => { setModal(null); await publish(); }} />}
    </>
  );
}

function DayView({ day, rows, onAdd }: { day: number; rows: ReturnType<ScheduleDayShifts>; onAdd: () => void }) {
  const { t } = useLang();
  const wd = (day - 1) % 7;
  const tot = rows.reduce((a, x) => a + x.h, 0);
  return (
    <div style={{ marginTop: 16 }}>
      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Á vakt")}</div><div className="val">{rows.length}</div></div>
        <div className="kpi"><div className="lab">{t("Tímar dagsins")}</div><div className="val">{tot} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Kostnaður dagsins")}</div><div className="val">{nf(tot * COST_HR)} <small>kr</small></div></div>
        <div className="kpi"><div className="lab">{t("Mönnunarþörf")}</div><div className="val">{rows.length} <small>/ 6</small></div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div><div className="ct">{t(DAYNAMES[wd])} {day}. {t("júní")}</div><div className="cs">{t("smelltu á vakt til að færa eða breyta")}</div></div><button className="btn sm" onClick={onAdd}>{t("+ Bæta við vakt")}</button></div>
        <div className="cb att">
          {rows.length ? rows.map((x, i) => (
            <div className="it rowlink" key={i} onClick={onAdd}>
              <span className="avt" style={{ background: x.c, width: 32, height: 32 }}>{x.i}</span>
              <div className="tx"><b>{x.n}</b><span>{t(x.dep)}</span></div>
              <span style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{x.l}</span>
              <span className="tag mut" style={{ marginLeft: 12 }}>{x.h} {t("klst")}</span>
            </div>
          )) : <div className="muted" style={{ padding: 16, textAlign: "center" }}>{t("Engar vaktir þennan dag.")}</div>}
        </div>
      </div>
    </div>
  );
}

type ScheduleDayShifts = () => { i: string; n: string; c: string; dep: string; l: string; h: number; type: string; start: number }[];

function MonthView({ dayShifts, onOpenDay }: { dayShifts: (d: number) => ReturnType<ScheduleDayShifts>; onOpenDay: (d: number) => void }) {
  const { t } = useLang();
  const hd = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
  return (
    <div style={{ marginTop: 16 }}>
      <div className="card">
        <div className="ch"><div><div className="ct">{t("Júní 2026")}</div><div className="cs">{t("smelltu á dag til að opna · á vakt til að breyta")}</div></div><span className="badge">{t("Heild:")} 4,30 m kr {t("velta")} · 32,1% {t("laun")}</span></div>
        <div className="cb">
          <div className="mcal">
            {hd.map((h) => <div className="hd" key={h}>{t(h)}</div>)}
            {Array.from({ length: 30 }, (_, k) => k + 1).map((d) => {
              const wd = (d - 1) % 7, we = wd >= 5, tod = d === 24, sh = dayShifts(d);
              return (
                <div key={d} className={`cell mcell ${we ? "we" : ""} ${tod ? "tod" : ""}`} onClick={() => onOpenDay(d)}>
                  <div className="dd">{d}</div>
                  <div className="mblocks">
                    {sh.slice(0, 3).map((x, i) => (
                      <div key={i} className={`mblock ${x.type}`} onClick={(e) => { e.stopPropagation(); onOpenDay(d); }}>{x.i} {x.l}</div>
                    ))}
                    {sh.length > 3 && <div className="mmore">+{sh.length - 3} {t("fleiri")}</div>}
                  </div>
                </div>
              );
            })}
            {Array.from({ length: 5 }, (_, i) => <div className="cell empty" key={`e${i}`} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftTypesModal({ types, setTypes, onClose }: { types: ShiftType[]; setTypes: (f: (t: ShiftType[]) => ShiftType[]) => void; onClose: () => void }) {
  const { t: tr } = useLang();
  const [nm, setNm] = useState(""); const [s, setS] = useState("00:00"); const [e, setE] = useState("08:00");
  const [prem, setPrem] = useState("Dagvinna"); const [color, setColor] = useState("#7c6ff2");
  function add() {
    if (!nm) { toast("Sláðu inn heiti"); return; }
    setTypes((t) => [...t, { nm, t: `${s}–${e}`, prem, bg: color + "1f", bd: color + "59", fg: color }]);
    setNm(""); toast(`Vaktategund „${nm}" búin til`);
  }
  function del(i: number) {
    setTypes((t) => (t.length <= 1 ? (toast("Þarf a.m.k. eina vaktategund"), t) : t.filter((_, j) => j !== i)));
  }
  return (
    <Modal onClose={onClose} title={tr("Vaktategundir")}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{tr("Skilgreindu þínar eigin vaktategundir — heiti, tíma, álag og lit. Þær birtast í vaktaplaninu.")}</p>
      <div className="att">
        {types.map((t, i) => (
          <div className="it" key={i}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: t.bg, border: `1px solid ${t.bd}`, flexShrink: 0 }} />
            <div className="tx"><b>{tr(t.nm)}</b><span>{t.t} · {tr(t.prem)}</span></div>
            <button className="tag mut" style={{ background: "var(--line2)", color: "var(--ink3)", cursor: "pointer", border: "none" }} onClick={() => del(i)}>{tr("Eyða")}</button>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 12 }}>{tr("Búa til nýja vaktategund")}</div>
        <div className="field"><label>{tr("Heiti")}</label><input value={nm} onChange={(e) => setNm(e.target.value)} placeholder={tr("t.d. Næturvakt")} /></div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1 }}><label>{tr("Upphaf")}</label><input type="time" value={s} onChange={(e) => setS(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>{tr("Lok")}</label><input type="time" value={e} onChange={(ev) => setE(ev.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1.4 }}><label>{tr("Álag")}</label>
            <select value={prem} onChange={(e) => setPrem(e.target.value)}>
              <option value="Dagvinna">{tr("Dagvinna")}</option><option value="+33% morgun/kvöld">{tr("+33% morgun/kvöld")}</option><option value="+45% helgi">{tr("+45% helgi")}</option><option value="+90% yfirvinna">{tr("+90% yfirvinna")}</option><option value="Næturálag">{tr("Næturálag")}</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>{tr("Litur")}</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ height: 38, padding: 3, cursor: "pointer" }} /></div>
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
          <button className="btn" onClick={add}>{tr("Bæta við")}</button>
          <button className="btn ghost" onClick={onClose}>{tr("Loka")}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddEmpModal({ pool, onPick, onClose }: { pool: Emp[]; onPick: (i: number) => void; onClose: () => void }) {
  const { t: tr } = useLang();
  return (
    <Modal onClose={onClose} title={tr("Bæta starfsmanni á plan")}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{tr("Veldu starfsmann til að bæta í vaktaplanið.")}</p>
      <div className="att">
        {pool.map((p, i) => (
          <div className="it rowlink" key={i} onClick={() => onPick(i)}>
            <span className="avt" style={{ background: p[3], width: 32, height: 32 }}>{p[0]}</span>
            <div className="tx"><b>{p[1]}</b><span>{tr(p[2])}</span></div>
            <span className="tag info" style={{ marginLeft: "auto" }}>{tr("+ bæta")}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ShiftEditModal({ types, onClose, onCopy, onTypes }: { types: ShiftType[]; onClose: () => void; onCopy: () => void; onTypes: () => void }) {
  const { t: tr } = useLang();
  const [who, setWho] = useState("Mína");
  const [type, setType] = useState(types[0]?.nm ?? "Dagvakt");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await saveShift({ employeeName: who, shiftTypeName: type, startTime: start, endTime: end });
    setBusy(false);
    onClose();
    toast(res.ok ? "Vakt vistuð" : (res.error ?? "Tókst ekki"));
  }
  return (
    <Modal onClose={onClose} title={tr("Ný vakt")}>
      <div className="field"><label>{tr("Starfsmaður")}</label><select value={who} onChange={(e) => setWho(e.target.value)}>{["Mína", "Bach", "Phong", "Ómar", "Ha Vu", "Jón"].map((n) => <option key={n}>{n}</option>)}</select></div>
      <div className="field"><label>{tr("Vaktategund")}</label><select value={type} onChange={(e) => setType(e.target.value)}>{types.map((t) => <option key={t.nm} value={t.nm}>{tr(t.nm)} · {t.t}</option>)}<option value="Sérsniðin vakt">{tr("Sérsniðin vakt")}</option></select></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="field" style={{ flex: 1 }}><label>{tr("Upphaf")}</label><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field" style={{ flex: 1 }}><label>{tr("Lok")}</label><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "-6px 0 8px" }}>{tr("Veldu tilbúna vaktategund eða stilltu tíma sjálf/ur. Vantar tegund?")} <a onClick={() => { onClose(); onTypes(); }} style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>{tr("Búa til vaktategund")}</a></p>
      <div className="field"><label>{tr("Staða / dagur")}</label><select><option>{tr("Kokkur")}</option><option>{tr("Þjónn / Sal")}</option><option>{tr("Bílstjóri")}</option></select></div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{tr("Þú getur fært vaktina á annan dag eða starfsmann hér — eða dregið hana til í vikusýn.")}</p>
      <div style={{ display: "flex", gap: 9, marginTop: 8, flexWrap: "wrap" }}>
        <button className="btn" disabled={busy} onClick={save}>{tr("Vista")}</button>
        <button className="btn ghost" onClick={onCopy}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>{tr("Afrita")}</button>
        <button className="btn ghost" onClick={onClose}>{tr("Loka")}</button>
      </div>
    </Modal>
  );
}

function AiPromptModal({ query, setQuery, onClose, onGen }: { query: string; setQuery: (s: string) => void; onClose: () => void; onGen: () => void }) {
  const { t: tr } = useLang();
  const ex = ["Settu Ómar á 2-2-3 vaktir 11:00–22:00 yfir allan maí", "Lágmarkaðu yfirvinnu í þessari viku", "Mannaðu helgina með 2 í eldhúsi og 2 á sal", "Afritaðu þessa viku á næstu 4 vikur"];
  return (
    <Modal onClose={onClose} title={<><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 7, verticalAlign: -3 }}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></svg>{tr("Biðja AI um vaktaplan")}</>}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{tr("Lýstu því sem þú vilt á venjulegri íslensku — VAKTO býr til vaktirnar og þú samþykkir.")}</p>
      <textarea className="lf-ta" rows={3} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("sched:aiph")} />
      <div className="chips">{ex.map((c) => <button className="chip" key={c} onClick={() => setQuery(c)}>{tr(c)}</button>)}</div>
      <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
        <button className="btn" onClick={onGen}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></svg>{tr("Búa til með AI")}</button>
        <button className="btn ghost" onClick={onClose}>{tr("Hætta við")}</button>
      </div>
    </Modal>
  );
}

const KIND_ICON: Record<AiItem["kind"], React.ReactNode> = {
  good: <path d="M5 12.5l4 4 10-10" />,
  info: <><path d="M4 16l5-5 4 3 6-7" /><path d="M16 7h4v4" /></>,
  warn: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bad: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

function AiResultModal({ query, proposal, loading, onClose, onEdit, onApprove }: { query: string; proposal: AiProposal | null; loading: boolean; onClose: () => void; onEdit: () => void; onApprove: () => void }) {
  const { t: tr } = useLang();
  return (
    <Modal onClose={onClose} title={tr("Tillaga AI")}>
      <div className="ai" style={{ margin: "0 0 14px" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z" /></svg>
        <div className="x">
          {loading
            ? `${query ? `„${query}" — ` : ""}${tr("VAKTO hugsar…")}`
            : (proposal?.summary ?? (query ? `„${query}"` : tr("Bestun vaktaplans")))}
        </div>
      </div>
      {loading ? (
        <div className="muted" style={{ fontSize: 13, padding: "18px 4px", textAlign: "center" }}>
          {tr("sched:ailoading")}
        </div>
      ) : (
        <div className="att">
          {(proposal?.items ?? []).map((it, i) => (
            <div className="it" key={i}>
              <div className={`ic ${it.kind}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">{KIND_ICON[it.kind]}</svg>
              </div>
              <div className="tx"><b>{it.title}</b><span>{it.detail}</span></div>
              <span className={`tag ${it.kind}`} style={it.kind === "info" ? { background: "var(--brand-soft)", color: "var(--brand)" } : undefined}>{it.tag}</span>
            </div>
          ))}
        </div>
      )}
      {!loading && proposal && !proposal.live && (
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          {tr("Demo-tillaga — settu ANTHROPIC_API_KEY í .env.local fyrir alvöru AI-vaktaplan.")}
        </p>
      )}
      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
        <button className="btn" disabled={loading} onClick={onApprove}>{tr("Samþykkja & birta")}</button>
        <button className="btn ghost" onClick={onEdit}>{tr("Breyta beiðni")}</button>
        <button className="btn ghost" onClick={onClose}>{tr("Hætta við")}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">{children}</div>
      </div>
    </div>
  );
}
