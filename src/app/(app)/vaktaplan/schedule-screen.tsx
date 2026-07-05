"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { nf, dec1 } from "@/lib/format";
import { TimeField } from "@/components/app/fields";
import { AsyncButton } from "@/components/app/async-button";
import { publishSchedule, updateLeaveRequest, approveShiftSwap, saveShift, assignOpenShift, deleteShift, getWeekShifts, getShiftsInRange, setStaffingTargets, type ShiftInput } from "./actions";
import { buildSchedulePdf, type PdfShift } from "./pdf";
import type { ReqItem } from "./requests.server";
import type { ScheduleInitial } from "./schedule.server";

type Emp = [string, string, string, string]; // initials, name, dept, color
type ShiftDef = { l: string; s: string; h: number; c: "day" | "eve" | "off" };
type ShiftType = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
type AiItem = { kind: "good" | "info" | "warn" | "bad"; title: string; detail: string; tag: string };
type AiProposal = { summary: string; items: AiItem[]; laborPct: string; live: boolean; error?: string };
type MonthBlock = { name: string; time: string; hrs: number; type: string };

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
const DEMO_TODAY = "2026-06-24"; // fallback "today" for the logged-out demo
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const hrsBetween = (a: string, b: string) => {
  const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number);
  let d = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  return Math.round((d / 60) * 100) / 100;
};
const codeForStart = (start: string) => {
  const h = parseInt((start ?? "").slice(0, 2), 10);
  if (h === 7) return "M";
  if (h === 11) return "Mi";
  if (h === 14) return "E";
  if (h === 16) return "L";
  return "D";
};
const DAYNAMES = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
const deptOf = (d: string) => (d === "Eldhús" ? "Eldhús" : d === "Sal" ? "Sal" : "Stjórnun");

const REQ_ICON: Record<ReqItem["kind"], React.ReactNode> = {
  leave: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" /></>,
  swap: <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />,
  avail: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
};

export default function ScheduleScreen({ requests = [], initial = null, scopeDepts = [] }: { requests?: ReqItem[]; initial?: ScheduleInitial | null; scopeDepts?: string[] }) {
  const [emp, setEmp] = useState<Emp[]>(initial?.emp ?? INIT_EMP);
  const [grid, setGrid] = useState<string[][]>(initial?.grid ?? INIT_GRID);
  const [cellTimes, setCellTimes] = useState<Record<string, { start: string; end: string }>>(initial?.times ?? {});
  const [pool, setPool] = useState<Emp[]>(initial?.pool ?? INIT_POOL);
  const [types, setTypes] = useState<ShiftType[]>(initial?.types?.length ? initial.types : INIT_TYPES);
  // A manager scoped to a single department lands on it; otherwise "all" (within scope).
  const [dept, setDept] = useState(scopeDepts.length === 1 ? scopeDepts[0] : "all");
  const [view, setView] = useState<"Vika" | "Dagur" | "Mánuður">("Vika");
  const todayISO = initial?.todayISO ?? DEMO_TODAY;
  const [cur, setCur] = useState(() => parseISO(initial?.todayISO ?? DEMO_TODAY)); // anchor day
  const [sel, setSel] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [monthShifts, setMonthShifts] = useState<Record<string, { first: string; start: string; end: string }[]>>({});
  const [drag, setDrag] = useState<{ r: number; c: number } | null>(null);
  // Copied shift: code + real times, so pasting preserves them and saves.
  const [clip, setClip] = useState<{ code: string; start?: string; end?: string } | null>(null);
  const [modal, setModal] = useState<null | "types" | "addEmp" | "shift" | "ai" | "aiResult" | "staff">(null);
  const [targets, setTargets] = useState<number[]>(initial?.targets?.length ? initial.targets : []);
  const [aiQuery, setAiQuery] = useState("");
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { t } = useLang();

  const vis = useMemo(
    () => emp.map((_, r) => r).filter((r) => {
      const dn = emp[r][2];
      // Managers only see the departments assigned to them (empty = all).
      const inScope = scopeDepts.length === 0 || scopeDepts.includes(dn) || scopeDepts.includes(deptOf(dn));
      const inSel = dept === "all" || dn === dept || deptOf(dn) === dept;
      return inScope && inSel;
    }),
    [emp, dept, scopeDepts],
  );
  // Real (signed-in) companies start at 0 — BASE_HRS is only demo padding.
  const liveCompany = !!initial;

  // Per-cell real times (override the coarse SH label/hours when present).
  const ckey = (r: number, c: number) => `${r}:${c}`;
  const timeOf = (r: number, c: number) => cellTimes[ckey(r, c)];
  const cellLabel = (r: number, c: number, code: string) => {
    const tt = cellTimes[ckey(r, c)];
    return tt ? `${tt.start.slice(0, 2)}–${tt.end.slice(0, 2)}` : SH[code].l;
  };
  const cellHrs = (r: number, c: number, code: string) => {
    const tt = cellTimes[ckey(r, c)];
    return tt ? hrsBetween(tt.start, tt.end) : (SH[code]?.h ?? 0);
  };
  // [startHour, endHour] for a cell (real times, else the SH label like "07–15").
  const cellSpan = (r: number, c: number, code: string): [number, number] | null => {
    const tt = cellTimes[ckey(r, c)];
    if (tt) { const [sh, sm] = tt.start.split(":").map(Number); const [eh, em] = tt.end.split(":").map(Number); let s = sh + (sm || 0) / 60, e = eh + (em || 0) / 60; if (e <= s) e += 24; return [s, e]; }
    const m = (SH[code]?.l ?? "").match(/(\d{1,2})\D+(\d{1,2})/);
    if (m) { let s = +m[1], e = +m[2]; if (e <= s) e += 24; return [s, e]; }
    return null;
  };
  // Premium hours in a cell (outside 08–17 on weekdays, or any weekend hour) —
  // matches the payroll engine's premium windows, for a planning estimate.
  const cellPremiumHrs = (r: number, c: number, code: string): number => {
    const span = cellSpan(r, c, code); if (!span) return 0;
    const wd = weekDays[c]?.getDay() ?? 1;
    let prem = 0;
    for (let x = span[0]; x < span[1]; x += 0.25) {
      const hod = ((x % 24) + 24) % 24;
      if (wd === 0 || wd === 6 || hod < 8 || hod >= 17) prem += 0.25;
    }
    return prem;
  };

  const visHrs = useMemo(() => {
    let h = 0;
    grid.forEach((row, r) => row.forEach((s, c) => { if (s && s !== "off") h += cellHrs(r, c, s); }));
    return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, cellTimes]);
  const totalHrs = visHrs + (liveCompany ? 0 : BASE_HRS);
  const cost = totalHrs * COST_HR;

  // Monday of the anchor day's week → the 7 visible week dates.
  const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const weekDays = useMemo(() => {
    const mon = mondayOf(cur);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; });
  }, [cur]);
  const weekMonISO = fmtISO(weekDays[0]);
  const curCol = (cur.getDay() + 6) % 7; // selected day's column within the week
  const todayCol = weekDays.findIndex((d) => fmtISO(d) === todayISO);

  // Period navigation follows the active view (day / week / month).
  function shiftPeriod(dir: number) {
    setCur((c) => {
      const d = new Date(c);
      if (view === "Dagur") d.setDate(d.getDate() + dir);
      else if (view === "Mánuður") d.setMonth(d.getMonth() + dir);
      else d.setDate(d.getDate() + dir * 7);
      return d;
    });
  }
  const resetLabel = view === "Dagur" ? "Í dag" : view === "Mánuður" ? "Þessi mánuður" : "Þessi vika";

  // Live companies: load the visible week's shifts from the DB when the week
  // changes. The base week is already in `initial` (SSR), so skip first run.
  const firstWeekRun = useRef(true);
  useEffect(() => {
    if (!liveCompany) return;
    if (firstWeekRun.current) { firstWeekRun.current = false; return; }
    let cancelled = false;
    getWeekShifts(weekMonISO).then((res) => {
      if (!cancelled && res?.ok) { setGrid(res.grid); setCellTimes(res.times ?? {}); }
    });
    return () => { cancelled = true; };
  }, [weekMonISO, liveCompany]);

  // Copy the previous week's plan into the current week (review, then publish).
  async function copyLastWeek() {
    const prevMon = new Date(mondayOf(cur)); prevMon.setDate(prevMon.getDate() - 7);
    const prevISO = fmtISO(prevMon);
    if (liveCompany) {
      const res = await getWeekShifts(prevISO);
      if (res?.ok && res.grid.some((row) => row.some((s) => s && s !== "off"))) {
        setGrid(res.grid); setCellTimes(res.times ?? {});
        toast(t("Síðasta vika afrituð — yfirfarðu og birtu"));
      } else toast(t("Engar vaktir í síðustu viku til að afrita"));
    } else {
      // Demo: just clone the current visible grid as an illustrative copy.
      setGrid((g) => g.map((row) => [...row]));
      toast(t("Síðasta vika afrituð — yfirfarðu og birtu"));
    }
  }

  // Live companies: load the whole month when in month view.
  useEffect(() => {
    if (!liveCompany || view !== "Mánuður") return;
    const y = cur.getFullYear(), m = cur.getMonth();
    const from = fmtISO(new Date(y, m, 1)), to = fmtISO(new Date(y, m + 1, 0));
    let cancelled = false;
    getShiftsInRange(from, to).then((res) => {
      if (cancelled || !res.ok) return;
      const map: Record<string, { first: string; start: string; end: string }[]> = {};
      for (const row of res.rows) (map[row.date] ??= []).push({ first: row.first, start: row.start, end: row.end });
      setMonthShifts(map);
    });
    return () => { cancelled = true; };
  }, [liveCompany, view, cur]);

  const d0 = weekDays[0], d6 = weekDays[6];
  const wklbl = d0.getMonth() === d6.getMonth()
    ? `${d0.getDate()}.–${d6.getDate()}. ${MONTHS_IS[d0.getMonth()]}`
    : `${d0.getDate()}. ${MONTHS_IS[d0.getMonth()].slice(0, 3)} – ${d6.getDate()}. ${MONTHS_IS[d6.getMonth()].slice(0, 3)}`;
  const periodLabel = view === "Dagur"
    ? `${t(DAYNAMES[curCol])} ${cur.getDate()}. ${t(MONTHS_IS[cur.getMonth()])} ${cur.getFullYear()}`
    : view === "Mánuður"
      ? `${t(MONTHS_IS[cur.getMonth()])} ${cur.getFullYear()}`
      : wklbl;

  // Per-day hours + shift counts, computed from the actual grid.
  const dayStats = weekDays.map((dd, c) => {
    let h = 0, n = 0;
    vis.forEach((r) => { const s = grid[r]?.[c]; if (s && s !== "off") { h += cellHrs(r, c, s); n++; } });
    return [c, dd.getDate(), h, n] as [number, number, number, number];
  });
  const totDayHrs = dayStats.reduce((a, d) => a + d[2], 0);
  const totDayShifts = dayStats.reduce((a, d) => a + d[3], 0);

  // KPI tölur fylgja sýninni (vika / dagur / mánuður).
  const dayHrs = useMemo(() => {
    let h = 0; vis.forEach((r) => { const s = grid[r]?.[curCol]; if (s && s !== "off") h += cellHrs(r, curCol, s); }); return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, grid, cellTimes, curCol]);
  const weekShifts = useMemo(() => {
    let n = 0; vis.forEach((r) => grid[r]?.forEach((s) => { if (s && s !== "off") n++; })); return n;
  }, [vis, grid]);
  const dayShiftCount = useMemo(() => {
    let n = 0; vis.forEach((r) => { const s = grid[r]?.[curCol]; if (s && s !== "off") n++; }); return n;
  }, [vis, grid, curCol]);
  // Estimated premium (álag) + overtime hours from the planned grid.
  const est = useMemo(() => {
    let premium = 0; const rowHrs: number[] = [];
    vis.forEach((r) => {
      let rh = 0;
      grid[r]?.forEach((s, c) => { if (s && s !== "off") { rh += cellHrs(r, c, s); premium += cellPremiumHrs(r, c, s); } });
      rowHrs.push(rh);
    });
    const overtime = rowHrs.reduce((a, h) => a + Math.max(0, h - 40), 0); // weekly > 40 klst
    return { premium: Math.round(premium * 10) / 10, overtime: Math.round(overtime * 10) / 10 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, grid, cellTimes]);
  const dayPremium = useMemo(() => {
    let p = 0; vis.forEach((r) => { const s = grid[r]?.[curCol]; if (s && s !== "off") p += cellPremiumHrs(r, curCol, s); }); return Math.round(p * 10) / 10;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, grid, cellTimes, curCol]);
  const estHrs = view === "Dagur" ? { premium: dayPremium, overtime: 0 }
    : view === "Mánuður" ? { premium: Math.round(est.premium * 4.33), overtime: Math.round(est.overtime * 4.33) }
      : est;

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
          const tt = timeOf(r, c);
          const [a, b] = o.l.split("–");
          out.push({
            employeeName: e[1],
            date: fmtISO(weekDays[c]),
            startTime: tt ? tt.start : `${a.padStart(2, "0")}:00`,
            endTime: tt ? tt.end : `${b.padStart(2, "0")}:00`,
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
    const from = ckey(drag.r, drag.c), to = ckey(tr, tc);
    setGrid((g) => {
      const ng = g.map((row) => [...row]);
      const tmp = ng[drag.r][drag.c];
      ng[drag.r][drag.c] = ng[tr][tc];
      ng[tr][tc] = tmp;
      return ng;
    });
    setCellTimes((m) => { const n = { ...m }; const a = n[from], b = n[to]; if (b) n[from] = b; else delete n[from]; if (a) n[to] = a; else delete n[to]; return n; });
    setDrag(null);
  }
  function cellClick(r: number, c: number) {
    if (clip !== null) {
      setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = clip.code; return ng; });
      if (clip.code !== "off" && clip.start && clip.end) {
        setCellTimes((m) => ({ ...m, [ckey(r, c)]: { start: clip.start!, end: clip.end! } }));
        if (liveCompany) void saveShift({ employeeName: emp[r][1], date: fmtISO(weekDays[c]), startTime: clip.start, endTime: clip.end, shiftTypeName: "" });
      } else if (clip.code !== "off") {
        setCellTimes((m) => { const n = { ...m }; delete n[ckey(r, c)]; return n; });
      }
      toast(t("Vakt límd"));
      return;
    }
    setSel({ r, c });
    setModal("shift");
  }
  function openNewShift() {
    setSel({ r: vis[0] ?? 0, c: view === "Vika" ? (todayCol >= 0 ? todayCol : 0) : curCol });
    setModal("shift");
  }
  function saveCell(r: number, c: number, start: string, end: string, typeName: string) {
    setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = codeForStart(start); return ng; });
    setCellTimes((m) => ({ ...m, [ckey(r, c)]: { start, end } }));
    setModal(null);
    if (liveCompany) {
      saveShift({ employeeName: emp[r][1], date: fmtISO(weekDays[c]), startTime: start, endTime: end, shiftTypeName: typeName })
        .then((res) => toast(res.ok ? "Vakt vistuð" : (res.error ?? "Villa")));
    } else toast("Vakt vistuð (demo)");
  }
  function delCell(r: number, c: number) {
    setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = "off"; return ng; });
    setCellTimes((m) => { const n = { ...m }; delete n[ckey(r, c)]; return n; });
    setModal(null);
    if (liveCompany) {
      deleteShift({ employeeName: emp[r][1], dateISO: fmtISO(weekDays[c]) })
        .then((res) => toast(res.ok ? "Vakt eydd" : (res.error ?? "Villa")));
    } else toast("Vakt eydd (demo)");
  }
  function removeEmpRow(r: number) {
    const nm = emp[r][1];
    // Persist: delete the employee's shifts for the visible week so they don't
    // reappear on refresh (live companies only).
    if (liveCompany) {
      weekDays.forEach((d, c) => { if (grid[r]?.[c] && grid[r][c] !== "off") void deleteShift({ employeeName: nm, dateISO: fmtISO(d) }); });
    }
    setPool((p) => [...p, emp[r]]);
    setEmp((e) => e.filter((_, i) => i !== r));
    setGrid((g) => g.filter((_, i) => i !== r));
    // Reindex per-cell times after the removed row.
    setCellTimes((m) => {
      const n: Record<string, { start: string; end: string }> = {};
      Object.entries(m).forEach(([k, v]) => {
        const [rr, cc] = k.split(":").map(Number);
        if (rr === r) return;
        n[`${rr > r ? rr - 1 : rr}:${cc}`] = v;
      });
      return n;
    });
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
  // Shifts on a given week column (for Day view).
  function colShifts(c: number) {
    const out: { i: string; n: string; c: string; dep: string; l: string; h: number; type: string; start: number }[] = [];
    emp.forEach((e, r) => {
      const s = grid[r]?.[c];
      if (s && s !== "off") {
        const tt = timeOf(r, c);
        out.push({ i: e[0], n: e[1], c: e[3], dep: e[2], l: cellLabel(r, c, s), h: cellHrs(r, c, s), type: SH[s].c, start: tt ? parseInt(tt.start) : parseInt(SH[s].l) });
      }
    });
    return out.sort((a, b) => a.start - b.start);
  }
  // Blocks for a month-calendar day (live → real month data; demo → week pattern).
  function monthBlocks(iso: string, wd: number) {
    if (liveCompany) {
      return (monthShifts[iso] ?? []).slice().sort((a, b) => a.start.localeCompare(b.start))
        .map((s) => ({ name: s.first, time: `${s.start.slice(0, 5)}–${s.end.slice(0, 5)}`, hrs: hrsBetween(s.start, s.end), type: SH[codeForStart(s.start)].c }));
    }
    const out: MonthBlock[] = [];
    vis.forEach((r) => { const s = grid[r]?.[wd]; if (s && s !== "off") { const tt = timeOf(r, wd); out.push({ name: emp[r][1], time: tt ? `${tt.start}–${tt.end}` : SH[s].l, hrs: cellHrs(r, wd, s), type: SH[s].c }); } });
    return out;
  }

  async function exportPdf() {
    toast("Bý til PDF…");
    let dates: string[] = [], dayLabels: string[] = [], subtitle = "";
    if (view === "Dagur") { dates = [fmtISO(cur)]; dayLabels = [periodLabel]; subtitle = periodLabel; }
    else if (view === "Vika") {
      dates = weekDays.map(fmtISO);
      dayLabels = weekDays.map((d, i) => `${t(DAYS[i])} ${d.getDate()}.${d.getMonth() + 1}`);
      subtitle = `${t("Vika")} ${wklbl} ${weekDays[0].getFullYear()}`;
    } else {
      const y = cur.getFullYear(), m = cur.getMonth(), n = new Date(y, m + 1, 0).getDate();
      dates = Array.from({ length: n }, (_, i) => fmtISO(new Date(y, m, i + 1)));
      subtitle = `${t(MONTHS_IS[m])} ${y}`;
    }

    const byDate: Record<string, PdfShift[]> = {};
    if (liveCompany) {
      const res = await getShiftsInRange(dates[0], dates[dates.length - 1]);
      if (res.ok) for (const row of res.rows) {
        (byDate[row.date] ??= []).push({ first: row.first, full: row.name, dept: row.dept, time: `${row.start}–${row.end}`, hours: hrsBetween(row.start, row.end) });
      }
    } else {
      const pushCell = (iso: string, r: number, c: number) => {
        const code = grid[r]?.[c];
        if (!code || code === "off") return;
        const tt = timeOf(r, c);
        const [a, b] = SH[code].l.split("–");
        const time = tt ? `${tt.start}–${tt.end}` : `${a}:00–${b}:00`;
        (byDate[iso] ??= []).push({ first: emp[r][1], full: emp[r][1], dept: emp[r][2], time, hours: cellHrs(r, c, code) });
      };
      if (view === "Vika") weekDays.forEach((d, c) => vis.forEach((r) => pushCell(fmtISO(d), r, c)));
      else if (view === "Dagur") vis.forEach((r) => pushCell(fmtISO(cur), r, curCol));
      else dates.forEach((iso) => { const wd = (new Date(iso + "T00:00:00").getDay() + 6) % 7; vis.forEach((r) => pushCell(iso, r, wd)); });
    }

    const now = new Date();
    const generated = `${t("Búið til")} ${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    try {
      await buildSchedulePdf({
        view, company: initial?.company ?? "VAKTO — Vaktaplan", title: t("Vaktaplan"),
        subtitle, generated, dates, dayLabels, byDate,
        weekdayLabels: DAYS.map((d) => t(d)), monthName: subtitle,
      });
      toast("PDF tilbúið");
    } catch {
      toast("Tókst ekki að búa til PDF");
    }
  }

  return (
    <>
      <PageHeader
        title="Vaktaplan"
        actions={
          <>
            <button className="btn ghost sm" onClick={exportPdf}>
              <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 6 }}>
                <path d="M14 3v5h5" /><path d="M7 3h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M9.5 13.5h1a1.2 1.2 0 0 1 0 2.4h-1V13.5Zm0 4.5v-2.1M14 13.5v4.5h.8a1.5 1.5 0 0 0 1.5-1.5v-1.5a1.5 1.5 0 0 0-1.5-1.5H14Z" />
              </svg>{t("Sækja PDF")}
            </button>
            <button className="btn sm" style={{ marginLeft: 8 }} onClick={publish}>{t("Birta plan")}</button>
          </>
        }
      />

      <div className="stoolbar">
        <div className="wk">
          <button onClick={() => shiftPeriod(-1)}>‹</button>
          <span className="lbl">{periodLabel}</span>
          <button onClick={() => shiftPeriod(1)}>›</button>
        </div>
        <button className="btn ghost sm" onClick={() => setCur(parseISO(todayISO))}>{t(resetLabel)}</button>
        <div className="seg" style={{ marginLeft: 4 }}>
          {(["Vika", "Dagur", "Mánuður"] as const).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{t(v)}</button>
          ))}
        </div>
        <select className="badge" style={{ border: "1px solid var(--line)", padding: "7px 11px" }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">{scopeDepts.length ? t("Allar mínar deildir") : t("Allar deildir")}</option>
          {(scopeDepts.length ? scopeDepts : ["Eldhús", "Sal", "Stjórnun"]).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="sp" style={{ flex: 1 }} />
        {view === "Vika" && (
          <button className="btn ghost sm" onClick={copyLastWeek}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>{t("Afrita síðustu viku")}
          </button>
        )}
        <button className="btn sm" onClick={() => setModal("ai")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z" /></svg>{t("Biðja AI")}
        </button>
        <button className="btn ghost sm" onClick={openNewShift}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>{t("Vakt")}
        </button>
      </div>

      {clip !== null && (
        <div id="pastebar" style={{ display: "flex" }}>
          <span className="pbtxt"><b>{t("Líma-hamur:")}</b> {t("smelltu á reiti til að líma")} {clip.code !== "off" ? `„${clip.start && clip.end ? `${clip.start}–${clip.end}` : SH[clip.code].l}"` : t("frí")}</span>
          <button className="btn ghost sm" onClick={() => setClip(null)}>{t("Hætta")}</button>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="lab">{t(kpi.hl)}</div><div className="val">{dec1(kpi.hrs)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Áætl. launakostnaður")}</div><div className="val">{nf(Math.round(kpi.hrs * COST_HR))} <small>kr</small></div></div>
        <div className="kpi"><div className="lab">{t("Áætl. álagstímar")}</div><div className="val">{dec1(estHrs.premium)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Áætl. yfirvinna")}</div><div className="val" style={estHrs.overtime > 0 ? { color: "var(--bad)" } : undefined}>{dec1(estHrs.overtime)} <small>{t("klst")}</small></div></div>
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
                  <th className="r rowsum">Σ {t("klst")}</th>
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
                            {s === "off" ? t("Frí") : <>{cellLabel(r, c, s)}<small>{SH[s].s ? t("sh:" + SH[s].s) :" "}</small></>}
                          </div>
                        </td>
                      ))}
                      <td className="r rowsum">{dec1(grid[r].reduce((a, s, c) => (s && s !== "off" ? a + cellHrs(r, c, s) : a), 0))}</td>
                    </tr>
                  );
                })}
                <tr className="foot">
                  <td style={{ textAlign: "left" }}>{t("Klst þann dag")}</td>
                  {Array.from({ length: 7 }, (_, c) => {
                    let n = 0;
                    vis.forEach((r) => { const s = grid[r][c]; if (s && s !== "off") n += cellHrs(r, c, s); });
                    return <td key={c} className={c === todayCol ? "tod" : ""}>{dec1(n)}</td>;
                  })}
                  <td className="r rowsum">{dec1(vis.reduce((a, r) => a + grid[r].reduce((b, s, c) => (s && s !== "off" ? b + cellHrs(r, c, s) : b), 0), 0))}</td>
                </tr>
                <tr className="addrow">
                  <td colSpan={9}>
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

      {view === "Dagur" && <DayView day={cur} col={curCol} rows={colShifts(curCol)} onAdd={openNewShift} />}
      {view === "Mánuður" && <MonthView monthDate={cur} todayISO={todayISO} blocks={monthBlocks} onOpenDay={(d) => { setCur(d); setView("Dagur"); }} />}

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
          <div className="ch"><div><div className="ct"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 6 }}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>{t("Mönnun & þörf")}</div><div className="cs">{t("á vakt á móti mönnunarþörf · þessi vika")}</div></div><button className="btn ghost sm" onClick={() => setModal("staff")}>{t("Stilla þörf")}</button></div>
          <div className="cb">
            {dayStats.map((r) => {
              const need = targets[r[0]] ?? 0;
              const short = need > 0 && r[3] < need;
              return (
                <div className="statline" key={r[1]}>
                  <span className="k">{t(DAYNAMES[r[0]])} {r[1]}.</span>
                  <span className="v">
                    <span style={{ color: short ? "var(--bad)" : need > 0 ? "var(--good)" : undefined, fontWeight: short ? 700 : 600 }}>{r[3]}{need > 0 ? `/${need}` : ""}</span> {t("á vakt")}
                    {short ? <span className="tag" style={{ background: "var(--bad-soft)", color: "var(--bad)", marginLeft: 8 }}>{t("vantar")} {need - r[3]}</span> : null}
                  </span>
                </div>
              );
            })}
            <div className="statline" style={{ borderTop: "1px solid var(--line)", marginTop: 5, paddingTop: 8 }}>
              <span className="k" style={{ fontWeight: 650, color: "var(--ink)" }}>{t("Samtals")}</span><span className="v" style={{ fontWeight: 700 }}>{dec1(totDayHrs)} {t("klst")} · {totDayShifts} {t("vaktir")}</span>
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
          {!liveCompany && <div className="it"><div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg></div><div className="tx"><b>{t("Opin vakt: laugardag 12–20")}</b><span>{t("2 starfsmenn sóttu um — Ha Vu, Dalya")}</span></div><AsyncButton className="btn sm" onClick={async () => { const res = await assignOpenShift({ employeeName: "Ha Vu", note: "laugardag 12–20" }); toast(res.ok ? "Úthlutað" : (res.error ?? "Villa")); }}>{t("Úthluta")}</AsyncButton></div>}
        </div>
      </div>
      )}

      {modal === "staff" && <StaffNeedModal targets={targets} onClose={() => setModal(null)} onSave={(ts) => { setTargets(ts); setModal(null); setStaffingTargets(ts).then((r) => toast(r.ok ? "Mönnunarþörf vistuð" : (r.error ?? "Villa"))); }} />}
      {modal === "types" && <ShiftTypesModal types={types} setTypes={setTypes} onClose={() => setModal(null)} />}
      {modal === "addEmp" && <AddEmpModal pool={pool} onPick={pickEmp} onClose={() => setModal(null)} />}
      {modal === "shift" && <ShiftEditModal types={types} emp={emp} weekDays={weekDays} sel={sel} gridCode={(r, c) => grid[r]?.[c] ?? "off"} timeOf={timeOf} onSave={saveCell} onDelete={delCell} onClose={() => setModal(null)} onCopy={() => { if (sel) { const code = grid[sel.r]?.[sel.c] ?? "off"; const tt = timeOf(sel.r, sel.c); setClip({ code, start: tt?.start, end: tt?.end }); } setModal(null); toast(t("Vakt afrituð — smelltu á reiti til að líma")); }} onTypes={() => setModal("types")} />}
      {modal === "ai" && <AiPromptModal query={aiQuery} setQuery={setAiQuery} onClose={() => setModal(null)} onGen={() => runAi(aiQuery)} />}
      {modal === "aiResult" && <AiResultModal query={aiQuery} proposal={aiProposal} loading={aiLoading} onClose={() => setModal(null)} onEdit={() => setModal("ai")} onApprove={async () => { setModal(null); await publish(); }} />}
    </>
  );
}

type DayRow = { i: string; n: string; c: string; dep: string; l: string; h: number; type: string; start: number };

function DayView({ day, col, rows, onAdd }: { day: Date; col: number; rows: DayRow[]; onAdd: () => void }) {
  const { t } = useLang();
  const tot = rows.reduce((a, x) => a + x.h, 0);
  return (
    <div style={{ marginTop: 16 }}>
      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Á vakt")}</div><div className="val">{rows.length}</div></div>
        <div className="kpi"><div className="lab">{t("Tímar dagsins")}</div><div className="val">{dec1(tot)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Kostnaður dagsins")}</div><div className="val">{nf(Math.round(tot * COST_HR))} <small>kr</small></div></div>
        <div className="kpi"><div className="lab">{t("Mönnunarþörf")}</div><div className="val">{rows.length} <small>/ 6</small></div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div><div className="ct">{t(DAYNAMES[col])} {day.getDate()}. {t(MONTHS_IS[day.getMonth()])}</div><div className="cs">{t("smelltu á vakt til að færa eða breyta")}</div></div><button className="btn sm" onClick={onAdd}>{t("+ Bæta við vakt")}</button></div>
        <div className="cb att">
          {rows.length ? rows.map((x, i) => (
            <div className="it rowlink" key={i} onClick={onAdd}>
              <span className="avt" style={{ background: x.c, width: 32, height: 32 }}>{x.i}</span>
              <div className="tx"><b>{x.n}</b><span>{t(x.dep)}</span></div>
              <span style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{x.l}</span>
              <span className="tag mut" style={{ marginLeft: 12 }}>{dec1(x.h)} {t("klst")}</span>
            </div>
          )) : <div className="muted" style={{ padding: 16, textAlign: "center" }}>{t("Engar vaktir þennan dag.")}</div>}
        </div>
      </div>
    </div>
  );
}

function MonthView({ monthDate, todayISO, blocks, onOpenDay }: { monthDate: Date; todayISO: string; blocks: (iso: string, wd: number) => MonthBlock[]; onOpenDay: (d: Date) => void }) {
  const { t } = useLang();
  const hd = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
  const y = monthDate.getFullYear(), m = monthDate.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="card">
        <div className="ch"><div><div className="ct">{t(MONTHS_IS[m])} {y}</div><div className="cs">{t("smelltu á dag til að opna · á vakt til að breyta")}</div></div></div>
        <div className="cb">
          <div className="mcal">
            {hd.map((h) => <div className="hd" key={h}>{t(h)}</div>)}
            {Array.from({ length: lead }, (_, i) => <div className="cell empty" key={`l${i}`} />)}
            {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
              const date = new Date(y, m, d);
              const wd = (date.getDay() + 6) % 7, we = wd >= 5;
              const tod = fmtISO(date) === todayISO;
              const sh = blocks(fmtISO(date), wd);
              return (
                <div key={d} className={`cell mcell ${we ? "we" : ""} ${tod ? "tod" : ""}`} onClick={() => onOpenDay(date)}>
                  <div className="mhead"><span className="dd">{d}</span>{sh.length > 0 && <span className="mtot">{dec1(sh.reduce((a, s) => a + s.hrs, 0))} {t("klst")}</span>}</div>
                  <div className="mblocks">
                    {sh.slice(0, 4).map((x, i) => (
                      <div key={i} className={`mblock ${x.type}`} onClick={(e) => { e.stopPropagation(); onOpenDay(date); }} title={`${x.name} · ${x.time}`}>
                        <b>{x.name}</b><span>{x.time} · {dec1(x.hrs)}{t("klst-stutt")}</span>
                      </div>
                    ))}
                    {sh.length > 4 && <div className="mmore">+{sh.length - 4} {t("fleiri")}</div>}
                  </div>
                </div>
              );
            })}
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
          <div className="field" style={{ flex: 1 }}><label>{tr("Upphaf")}</label><TimeField value={s} onChange={setS} style={{ width: "100%" }} /></div>
          <div className="field" style={{ flex: 1 }}><label>{tr("Lok")}</label><TimeField value={e} onChange={setE} style={{ width: "100%" }} /></div>
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

function StaffNeedModal({ targets, onClose, onSave }: { targets: number[]; onClose: () => void; onSave: (t: number[]) => void }) {
  const { t } = useLang();
  const DAYS_FULL = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
  const [vals, setVals] = useState<number[]>(Array.from({ length: 7 }, (_, i) => targets[i] ?? 0));
  return (
    <Modal onClose={onClose} title={t("Mönnunarþörf á viku")}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t("Hversu marga þarf á vakt hvern dag? VAKTO sýnir vöntun í planinu.")}</p>
      <div style={{ display: "grid", gap: 8 }}>
        {DAYS_FULL.map((d, i) => (
          <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <label style={{ fontSize: 13.5 }}>{t(d)}</label>
            <input type="number" min={0} value={vals[i]} onChange={(e) => setVals((v) => v.map((x, j) => j === i ? Math.max(0, Number(e.target.value) || 0) : x))} style={{ width: 90, padding: "7px 10px", textAlign: "right" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
        <button className="btn" onClick={() => onSave(vals)}>{t("Vista")}</button>
        <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
      </div>
    </Modal>
  );
}

function ShiftEditModal({
  types, emp, weekDays, sel, gridCode, timeOf, onSave, onDelete, onClose, onCopy, onTypes,
}: {
  types: ShiftType[]; emp: Emp[]; weekDays: Date[]; sel: { r: number; c: number };
  gridCode: (r: number, c: number) => string;
  timeOf: (r: number, c: number) => { start: string; end: string } | undefined;
  onSave: (r: number, c: number, start: string, end: string, typeName: string) => void;
  onDelete: (r: number, c: number) => void;
  onClose: () => void; onCopy: () => void; onTypes: () => void;
}) {
  const { t: tr } = useLang();
  const [ri, setRi] = useState(sel.r < emp.length ? sel.r : 0);
  const [ci, setCi] = useState(sel.c);
  const tt0 = timeOf(sel.r, sel.c);
  const [type, setType] = useState(types[0]?.nm ?? "Dagvakt");
  const [start, setStart] = useState(tt0?.start ?? "08:00");
  const [end, setEnd] = useState(tt0?.end ?? "16:00");
  const filled = gridCode(ri, ci) !== "off";
  const DNAMES = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
  return (
    <Modal onClose={onClose} title={filled ? tr("Breyta vakt") : tr("Ný vakt")}>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="field" style={{ flex: 1.4 }}><label>{tr("Starfsmaður")}</label>
          <select value={ri} onChange={(e) => setRi(Number(e.target.value))}>{emp.map((x, i) => <option key={i} value={i}>{x[1]}</option>)}</select>
        </div>
        <div className="field" style={{ flex: 1 }}><label>{tr("Dagur")}</label>
          <select value={ci} onChange={(e) => setCi(Number(e.target.value))}>{weekDays.map((d, i) => <option key={i} value={i}>{tr(DNAMES[i]).slice(0, 3)} {d.getDate()}.{d.getMonth() + 1}</option>)}</select>
        </div>
      </div>
      <div className="field"><label>{tr("Vaktategund")}</label><select value={type} onChange={(e) => { setType(e.target.value); const ty = types.find((t) => t.nm === e.target.value); if (ty) { const [a, b] = ty.t.split("–"); if (a && b) { setStart(a.trim().slice(0, 5)); setEnd(b.trim().slice(0, 5)); } } }}>{types.map((t) => <option key={t.nm} value={t.nm}>{tr(t.nm)} · {t.t}</option>)}<option value="Sérsniðin vakt">{tr("Sérsniðin vakt")}</option></select></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="field" style={{ flex: 1 }}><label>{tr("Upphaf")}</label><TimeField value={start} onChange={setStart} style={{ width: "100%" }} /></div>
        <div className="field" style={{ flex: 1 }}><label>{tr("Lok")}</label><TimeField value={end} onChange={setEnd} style={{ width: "100%" }} /></div>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "-6px 0 8px" }}>{tr("Veldu tilbúna vaktategund eða stilltu tíma sjálf/ur. Vantar tegund?")} <a onClick={() => { onClose(); onTypes(); }} style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>{tr("Búa til vaktategund")}</a></p>
      <div style={{ display: "flex", gap: 9, marginTop: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => { if (start >= end) { toast("Lok verða að vera eftir upphaf"); return; } onSave(ri, ci, start, end, type); }}>{tr("Vista")}</button>
        {filled && <button className="btn ghost" style={{ color: "var(--bad)", borderColor: "var(--bad-soft, #f3c7c0)" }} onClick={() => onDelete(ri, ci)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>{tr("Eyða vakt")}
        </button>}
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
