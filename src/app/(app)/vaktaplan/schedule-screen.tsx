"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { nf, dec1, krCompact } from "@/lib/format";
import { TimeField } from "@/components/app/fields";
import { publishSchedule, updateLeaveRequest, approveShiftSwap, rejectShiftSwap, saveShift, deleteShift, getWeekShifts, getShiftsInRange, setStaffingTargets, deleteWeekShifts, getShiftTasks, saveShiftTasks, saveShiftTypes, getWeekBudget, getDraftCount, publishRange, getClosedDays, type ShiftInput } from "./actions";
import { closuresOn, closedText, type ClosedDay } from "@/lib/closed-days";
import { offerUndo } from "./undo-delete";
import { getCompanyDepartments, getDepartmentColors } from "../starfsfolk/actions";
import { DeptPicker } from "@/components/app/controls";
import { getDashboardPeriod } from "../maelabord/actions";
import { buildSchedulePdf, type PdfShift } from "./pdf";
import type { ReqItem } from "./requests.server";
import type { ScheduleInitial } from "./schedule.server";
import type { WeekBudget } from "@/lib/labor";
import OpenShifts from "./open-shifts";
import { ShiftForm, ShiftSheet, PaintTools, SlotTabs, typeTimes, defaultsFor, type PaintTool } from "./shift-form";
import type { ExtraShift } from "./week-cells";
import { payPeriodOf } from "@/lib/periods";
import { restGaps, type RestShift } from "@/lib/rest";
import { PlanningRules } from "./planning-rules";
import MonthRoster from "./month-roster";
import { isNdjson, readNdjson, type ScheduleEvent } from "@/lib/ai/stream";

// initials, birtingarnafn, aðaldeild, litur, starfsmanns-id (live), aðrar deildir („A|B“)
type Emp = [string, string, string, string, string?, string?];
const empRef = (e: Emp) => e[4] || e[1]; // id ef til (nöfn geta verið eins), annars nafn (demo)
const empDepts = (e: Emp) => [e[2], ...(e[5] ? e[5].split("|") : [])].filter(Boolean);
type ShiftDef = { l: string; s: string; h: number; c: "day" | "eve" | "off" };
type ShiftType = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
type AiItem = { kind: "good" | "info" | "warn" | "bad"; title: string; detail: string; tag: string };
type AiShift = { employee: string; day: number; start: string; end: string };
// blocked = vaktir sem þjónninn fjarlægði því starfsmaður er í samþykktu fríi.
/** Framvinda „Biðja AI“: hvaða stig og hve margar vaktir eru komnar. */
type AiStage = { stage: "read" | "think" | "write"; shifts: number };
type AiProposal = { summary: string; items: AiItem[]; laborPct: string; shifts?: AiShift[]; blocked?: { employee: string; day: number }[]; live: boolean; error?: string };
type MonthBlock = { name: string; time: string; hrs: number; type: string; ref: string; tn?: string; slot?: number }; // tn = heiti vaktategundar, slot = vakt nr. dagsins (0110)

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
  // Explicit shift-type per cell (overrides the time-based color match).
  const [cellTypes, setCellTypes] = useState<Record<string, string>>(initial?.cellTypes ?? {});
  // Persist type edits for live companies (types were client-only before).
  const persistTypes = (f: (t: ShiftType[]) => ShiftType[]) => {
    setTypes((prev) => {
      const next = f(prev);
      if (liveCompany) void saveShiftTypes(next);
      return next;
    });
  };
  // A manager scoped to a single department lands on it; otherwise "all" (within scope).
  // Valdar deildir (tómt = allar innan umsjónar). Hægt að velja fleiri en eina, t.d. Eldhús + Sal.
  const [depts, setDepts] = useState<string[]>(scopeDepts.length === 1 ? [scopeDepts[0]] : []);
  // Staðir (0109): valdir staðir (tómt = allir) og hvort aðeins fólk með vakt sést. Munað í vafranum.
  const locTree = initial?.locTree ?? { locations: [], deptLocs: {}, empHome: {} };
  const multiLoc = locTree.locations.length > 1;
  const locName = useMemo(() => new Map(locTree.locations.map((l) => [l.id, l.name])), [locTree.locations]);
  const [selLocs, setSelLocs] = useState<string[]>([]);
  const [onlyShifts, setOnlyShifts] = useState(false);
  const [cellLocs, setCellLocs] = useState<Record<string, string>>(initial?.cellLocs ?? {});
  // 0110: deild aðalvaktar (ef önnur en aðaldeild) og aðrar vaktir sama dag (morgunmatur 7–10 + þrif 10–15).
  const [cellDepts, setCellDepts] = useState<Record<string, string>>(initial?.cellDepts ?? {});
  const [extras, setExtras] = useState<Record<string, ExtraShift[]>>(initial?.extras ?? {});
  const prefsLoaded = useRef(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("vakto-plan-locs") || "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- vafrageymsla er aðeins til eftir hydration
      if (Array.isArray(v) && multiLoc) setSelLocs(v.filter((id: unknown) => typeof id === "string" && locName.has(id)));
      setOnlyShifts(localStorage.getItem("vakto-plan-only") === "1");
    } catch { /* án vafrageymslu */ }
    prefsLoaded.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- aðeins við fyrstu birtingu
  useEffect(() => {
    if (!prefsLoaded.current) return;
    try { localStorage.setItem("vakto-plan-locs", JSON.stringify(selLocs)); localStorage.setItem("vakto-plan-only", onlyShifts ? "1" : "0"); } catch { /* án vafrageymslu */ }
  }, [selLocs, onlyShifts]);
  /** Deildir á völdum stöðum (fyrir deildavalið og mánaðartöfluna). */
  const deptsInLocs = useMemo(() => (selLocs.length
    ? Object.entries(locTree.deptLocs).filter(([, ls]) => ls.some((l) => selLocs.includes(l))).map(([n]) => n)
    : null), [selLocs, locTree.deptLocs]);
  /** Velja staði — deildir utan þeirra detta úr deildavalinu. */
  const chooseLocs = (ids: string[]) => {
    setSelLocs(ids);
    if (ids.length) {
      const ok = new Set(Object.entries(locTree.deptLocs).filter(([, ls]) => ls.some((l) => ids.includes(l))).map(([n]) => n));
      setDepts((d) => d.filter((x) => ok.has(x)));
    }
  };
  const [monthMode, setMonthMode] = useState<"tafla" | "dagatal">("tafla");
  const [full, setFull] = useState(false);
  type MonthShift = { emp: string; date: string; start: string; end: string };
  const [monthTot, setMonthTot] = useState<{ hrs: number; shifts: number; list: MonthShift[] }>({ hrs: 0, shifts: 0, list: [] });
  const [view, setView] = useState<"Vika" | "Dagur" | "Mánuður">("Vika");
  const todayISO = initial?.todayISO ?? DEMO_TODAY;
  const [cur, setCur] = useState(() => parseISO(initial?.todayISO ?? DEMO_TODAY)); // anchor day
  const [sel, setSel] = useState<{ r: number; c: number; slot?: number }>({ r: 0, c: 0 });
  const [monthShifts, setMonthShifts] = useState<Record<string, { first: string; start: string; end: string; ref: string; tn?: string; slot?: number }[]>>({});
  const [monthVer, setMonthVer] = useState(0);
  const [rosterKey, setRosterKey] = useState(0);
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const monthDragRef = useRef<{ first: string; ref: string; start: string; end: string; fromISO: string; tn?: string; slot?: number } | null>(null);
  const [monthClip, setMonthClip] = useState<{ first: string; ref: string; start: string; end: string; tn?: string } | null>(null);
  const [drag, setDrag] = useState<{ r: number; c: number } | null>(null);
  // Copied shift: code + real times, so pasting preserves them and saves.
  const [clip, setClip] = useState<{ code: string; start?: string; end?: string; type?: string } | null>(null);
  // „Mála“ eins og í mánaðartöflunni: vaktategund eða strokleður valið, svo smellt á reiti.
  const [paint, setPaint] = useState<PaintTool>(null);
  useEffect(() => {
    if (!paint) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPaint(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paint]);
  // Company departments for the filter (live sync with Settings).
  const [deptList, setDeptList] = useState<string[]>(initial ? [] : ["Eldhús", "Sal", "Stjórnun"]);
  const [deptColors, setDeptColors] = useState<Record<string, string>>({});
  useEffect(() => {
    getCompanyDepartments().then((d) => { if (initial || d.length) setDeptList(d); }).catch(() => {});
    getDepartmentColors().then(setDeptColors).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- aðeins við fyrstu birtingu
  // Unified right-click menu (week/day/month views).
  type CtxItem = { label: string; danger?: boolean; color?: string; act: () => void };
  const [ctx, setCtx] = useState<{ x: number; y: number; items: CtxItem[] } | null>(null);
  function openCtx(ev: React.MouseEvent, items: CtxItem[]) {
    ev.preventDefault(); ev.stopPropagation();
    if (!items.length) return;
    setCtx({ x: ev.clientX, y: ev.clientY, items });
  }
  const [modal, setModal] = useState<null | "types" | "addEmp" | "shift" | "ai" | "aiResult" | "staff">(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // Registered UN-availability (first name, lowercase → day indices) for the visible week.
  const [unavail, setUnavail] = useState<Record<string, number[]>>(initial?.unavail ?? {});
  const [targets, setTargets] = useState<number[]>(initial?.targets?.length ? initial.targets : []);
  const [aiQuery, setAiQuery] = useState("");
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStage, setAiStage] = useState<AiStage | null>(null); // framvinda á meðan AI vinnur
  const { t, lang } = useLang();

  /** Staðir sem starfsmaður tilheyrir: staður aðaldeildar + staðir annarra deilda hans. */
  const empLocs = (e: Emp): string[] => {
    const out = new Set<string>();
    const home = e[4] ? locTree.empHome[e[4]] : undefined;
    if (home) out.add(home);
    for (const d of empDepts(e)) for (const l of locTree.deptLocs[d] ?? []) out.add(l);
    return [...out];
  };
  const homeLoc = (r: number): string | undefined => {
    const e = emp[r]; if (!e) return undefined;
    return (e[4] ? locTree.empHome[e[4]] : undefined) ?? locTree.deptLocs[e[2]]?.[0];
  };
  /** Staður vaktar í reit: skráður staður, annars staður starfsmannsins. */
  const locOf = (r: number, c: number): string | undefined => cellLocs[`${r}:${c}`] ?? homeLoc(r);
  /** Vakt á öðrum stað en þeim sem eru valdir: sést dauf og læst. */
  const foreign = (r: number, c: number): boolean => {
    if (!selLocs.length) return false;
    const s = grid[r]?.[c];
    if (!s || s === "off") return false;
    const l = locOf(r, c);
    return !!l && !selLocs.includes(l);
  };
  /** Staður fyrir NÝJA vakt í röð r: einn valinn staður → hann; annars staður starfsmanns ef hann er valinn. */
  const pickLoc = (r: number): string | undefined => {
    if (!selLocs.length) return undefined;
    if (selLocs.length === 1) return selLocs[0];
    const home = homeLoc(r);
    if (home && selLocs.includes(home)) return home;
    return emp[r] ? empLocs(emp[r]).find((l) => selLocs.includes(l)) ?? selLocs[0] : selLocs[0];
  };
  /** Gridið eins og það telst á völdum stöðum: vaktir annars staðar = frí (tímar, kostnaður, Σ). */
  const vg = useMemo(
    () => grid.map((row, r) => row.map((s, c) => (foreign(r, c) ? "off" : s))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, cellLocs, selLocs, emp],
  );
  const vis = useMemo(
    () => emp.map((_, r) => r).filter((r) => {
      const ds = empDepts(emp[r]);
      // Managers only see the departments assigned to them (empty = all).
      const inScope = scopeDepts.length === 0 || ds.some((d) => scopeDepts.includes(d) || scopeDepts.includes(deptOf(d)));
      const inSel = depts.length === 0 || ds.some((d) => depts.includes(d) || depts.includes(deptOf(d)));
      const hasShift = vg[r]?.some((s) => s && s !== "off");
      // Staður: fólk staðarins + þeir sem eiga vakt þar þessa viku (t.d. lánaðir af öðrum stað).
      const inLoc = selLocs.length === 0 || empLocs(emp[r]).some((l) => selLocs.includes(l)) || hasShift;
      return inScope && inSel && inLoc && (!onlyShifts || hasShift);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emp, depts, scopeDepts, selLocs, onlyShifts, vg],
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
  /** Tímar aðalvaktar reitsins. */
  const primHrs = (r: number, c: number, code: string) => {
    const tt = cellTimes[ckey(r, c)];
    return tt ? hrsBetween(tt.start, tt.end) : (SH[code]?.h ?? 0);
  };
  /** Aðrar vaktir sama dags (0110) sem teljast á völdum stöðum. */
  const extrasOf = (r: number, c: number): ExtraShift[] =>
    (extras[ckey(r, c)] ?? []).filter((x) => !selLocs.length || !x.loc || selLocs.includes(x.loc));
  /** Allir tímar reitsins — aðalvakt + aðrar vaktir dagsins. Allar samtölur (Σ, dagar, kostnaður) nota þetta. */
  const cellHrs = (r: number, c: number, code: string) =>
    primHrs(r, c, code) + extrasOf(r, c).reduce((a, x) => a + hrsBetween(x.start, x.end), 0);
  // [startHour, endHour] for a cell (real times, else the SH label like "07–15").
  const cellSpan = (r: number, c: number, code: string): [number, number] | null => {
    const tt = cellTimes[ckey(r, c)];
    if (tt) { const [sh, sm] = tt.start.split(":").map(Number); const [eh, em] = tt.end.split(":").map(Number); const s = sh + (sm || 0) / 60; let e = eh + (em || 0) / 60; if (e <= s) e += 24; return [s, e]; }
    const m = (SH[code]?.l ?? "").match(/(\d{1,2})\D+(\d{1,2})/);
    if (m) { const s = +m[1]; let e = +m[2]; if (e <= s) e += 24; return [s, e]; }
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
    const iso = weekDays[c] ? fmtISO(weekDays[c]) : "";
    for (const x of extrasOf(r, c)) prem += premiumOf(iso, x.start, x.end);
    return prem;
  };
  /** Sama álagsregla fyrir vakt með dagsetningu (mánaðarsýn). */
  const premiumOf = (dateISO: string, start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number), [eh, em] = end.split(":").map(Number);
    const a = sh + (sm || 0) / 60; let b = eh + (em || 0) / 60; if (b <= a) b += 24;
    const wd = new Date(`${dateISO}T12:00:00`).getDay();
    let prem = 0;
    for (let x = a; x < b; x += 0.25) { const hod = x % 24; if (wd === 0 || wd === 6 || hod < 8 || hod >= 17) prem += 0.25; }
    return prem;
  };

  // Sum only the visible rows so the KPI matches the grid's own Σ column + day
  // totals (which also iterate `vis`). Iterating the whole grid double-counts
  // rows hidden by the department filter / scope.
  const visHrs = useMemo(() => {
    let h = 0;
    vis.forEach((r) => vg[r]?.forEach((s, c) => { if (s && s !== "off") h += cellHrs(r, c, s); }));
    return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, vg, cellTimes, extras]);
  const totalHrs = visHrs + (liveCompany ? 0 : BASE_HRS);
  const cost = totalHrs * COST_HR;

  // Monday of the anchor day's week → the 7 visible week dates.
  const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const weekDays = useMemo(() => {
    const mon = mondayOf(cur);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; });
  }, [cur]);
  const weekMonISO = fmtISO(weekDays[0]);
  // Lokaðir dagar (0107) á sýnilega tímabilinu — merktir í haus vikunnar og í borða ofan við planið.
  const [closed, setClosed] = useState<ClosedDay[]>([]);
  // Mánaðartaflan fylgir launatímabili fyrirtækisins (t.d. 21. okt.–20. nóv.), eins og vinnuyfirlit og
  // launakeyrsla — áður sýndi hún alltaf almanaksmánuð og tímar „á tímabilinu“ stemmdu ekki. Dagatalið
  // (mánaðaryfirlit) er áfram almanaksmánuður.
  const payPeriod = initial?.payPeriod ?? { kind: "month" as const, startDay: 1 };
  const ppMonth = liveCompany && monthMode === "tafla" && payPeriod.kind === "month" && (payPeriod.startDay ?? 1) !== 1;
  const curISO = fmtISO(cur);
  const monthRange = useMemo(() => {
    const d = parseISO(curISO);
    return ppMonth
      ? payPeriodOf(curISO, payPeriod)
      : { from: fmtISO(new Date(d.getFullYear(), d.getMonth(), 1)), to: fmtISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payPeriod kemur úr initial og breytist ekki
  }, [ppMonth, curISO]);
  const closedRange = view === "Vika"
    ? [weekMonISO, fmtISO(weekDays[6])]
    : view === "Mánuður"
      ? [monthRange.from, monthRange.to]
      : [fmtISO(cur), fmtISO(cur)];
  useEffect(() => {
    if (!liveCompany) return;
    let stop = false;
    getClosedDays(closedRange[0], closedRange[1]).then((r) => { if (!stop) setClosed(r.ok ? r.days : []); }).catch(() => {});
    return () => { stop = true; };
  }, [liveCompany, closedRange[0], closedRange[1]]); // eslint-disable-line react-hooks/exhaustive-deps
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
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [full]);
  // „Í dag / Þessi vika / Þessi mánuður“ birtist aðeins þegar annað tímabil er opið.
  const onCurrentPeriod = view === "Dagur" ? fmtISO(cur) === todayISO
    : view === "Mánuður" ? fmtISO(cur).slice(0, 7) === todayISO.slice(0, 7)
    : todayCol >= 0;
  const resetLabel = view === "Dagur" ? "Í dag" : view === "Mánuður" ? "Þessi mánuður" : "Þessi vika";

  /** Apply a fetched week onto the CURRENT grid rows. The server grid is
   * indexed by the full roster; our rows may be a filtered subset in a
   * different order — remap by (initials, first name) so shifts never land on
   * the wrong employee. Employees with shifts who aren't on the plan yet are
   * pulled in from the pool. */
  function applyWeek(res: { grid: string[][]; times?: Record<string, { start: string; end: string }>; cellTypes?: Record<string, string>; cellLocs?: Record<string, string>; cellDepts?: Record<string, string>; extras?: Record<string, ExtraShift[]>; names?: string[]; inits?: string[]; ids?: string[]; unavail?: Record<string, number[]> }) {
    if (res.unavail) setUnavail(res.unavail);
    if (!res.names || !res.inits) { setGrid(res.grid); setCellTimes(res.times ?? {}); setCellTypes(res.cellTypes ?? {}); setCellLocs(res.cellLocs ?? {}); setCellDepts(res.cellDepts ?? {}); setExtras(res.extras ?? {}); return; }
    const { names, inits, ids } = res;
    // Parað eftir starfsmanns-id þegar það er til — upphafsstafir+nafn rugla saman tveimur „Jan“.
    const keyOf = (e: Emp) => (e[4] ? e[4] : `${e[0]}|${e[1]}`);
    const srcKey = (j: number) => (ids?.[j] ? ids[j] : `${inits[j]}|${names[j]}`);
    const have = new Set(emp.map(keyOf));
    const added: Emp[] = [];
    names.forEach((n, j) => {
      const key = srcKey(j);
      if (!have.has(key) && res.grid[j]?.some((s) => s !== "off")) {
        const fromPool = pool.find((p) => keyOf(p) === key);
        added.push(fromPool ?? [inits[j], n, "", "#5b50e6", ids?.[j]]);
        have.add(key);
      }
    });
    const rows = added.length ? [...emp, ...added] : emp;
    const g: string[][] = rows.map(() => Array(7).fill("off"));
    const t2: Record<string, { start: string; end: string }> = {};
    const ty2: Record<string, string> = {};
    const lo2: Record<string, string> = {};
    const de2: Record<string, string> = {};
    const ex2: Record<string, ExtraShift[]> = {};
    rows.forEach((e, r) => {
      const j = names.findIndex((_, jj) => srcKey(jj) === keyOf(e));
      if (j >= 0 && res.grid[j]) {
        g[r] = [...res.grid[j]];
        for (let c = 0; c < 7; c++) {
          const k = `${j}:${c}`; const tt = res.times?.[k]; if (tt) t2[`${r}:${c}`] = tt;
          const tn = res.cellTypes?.[k]; if (tn) ty2[`${r}:${c}`] = tn;
          const lo = res.cellLocs?.[k]; if (lo) lo2[`${r}:${c}`] = lo;
          const de = res.cellDepts?.[k]; if (de) de2[`${r}:${c}`] = de;
          const ex = res.extras?.[k]; if (ex?.length) ex2[`${r}:${c}`] = ex;
        }
      }
    });
    if (added.length) {
      setEmp(rows);
      setPool((p) => p.filter((x) => !added.some((a) => keyOf(a) === keyOf(x))));
    }
    setGrid(g);
    setCellTimes(t2);
    setCellTypes(ty2);
    setCellLocs(lo2);
    setCellDepts(de2);
    setExtras(ex2);
  }

  // Live companies: load the visible week's shifts from the DB when the week
  // changes. The base week is already in `initial` (SSR), so skip first run.
  const firstWeekRun = useRef(true);
  useEffect(() => {
    if (!liveCompany) return;
    if (firstWeekRun.current) { firstWeekRun.current = false; return; }
    let cancelled = false;
    getWeekShifts(weekMonISO).then((res) => {
      if (!cancelled && res?.ok) applyWeek(res);
    });
    return () => { cancelled = true; };
  }, [weekMonISO, liveCompany]); // eslint-disable-line react-hooks/exhaustive-deps

  // Copy the previous week's plan into the current week (review, then publish).
  /** "Eyða öllu": wipe the open week (grid + published shifts) to start fresh. */
  async function clearWeek() {
    if (!window.confirm(t("Eyða ÖLLUM vöktum þessarar viku og byrja upp á nýtt? Þetta fjarlægir líka birtar vaktir."))) return;
    if (selLocs.length) {
      // Aðeins valdir staðir hreinsaðir — vaktir annarra staða haldast.
      setGrid((g) => g.map((row, r) => row.map((x, c) => (foreign(r, c) ? x : "off"))));
    } else {
      setGrid((g) => g.map((row) => row.map(() => "off")));
      setCellTimes({});
      setCellTypes({});
      setCellLocs({});
      setCellDepts({});
      setExtras({});
    }
    if (liveCompany) {
      const dates = weekDays.map((d) => fmtISO(d));
      const res = await deleteWeekShifts(dates, selLocs.length ? selLocs : undefined);
      if (res.ok && res.deleted?.length) offerUndo(res.deleted, t, reloadWeek);
      else toast(res.ok ? t("Vika hreinsuð") : (res.error ?? "Villa"));
    } else {
      toast(t("Vika hreinsuð"));
    }
  }

  async function copyLastWeek() {
    const prevMon = new Date(mondayOf(cur)); prevMon.setDate(prevMon.getDate() - 7);
    const prevISO = fmtISO(prevMon);
    if (liveCompany) {
      const res = await getWeekShifts(prevISO);
      if (res?.ok && res.grid.some((row) => row.some((s) => s && s !== "off"))) {
        applyWeek(res);
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
    if (!liveCompany || view !== "Mánuður" || monthMode !== "dagatal") return;
    const y = cur.getFullYear(), m = cur.getMonth();
    // Cover the whole calendar grid: leading + trailing adjacent-month days too.
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const trail = (7 - ((lead + days) % 7)) % 7;
    const from = fmtISO(new Date(y, m, 1 - lead)), to = fmtISO(new Date(y, m + 1, trail));
    let cancelled = false;
    getShiftsInRange(from, to).then((res) => {
      if (cancelled || !res.ok) return;
      const map: Record<string, { first: string; start: string; end: string; ref: string; tn?: string; slot?: number }[]> = {};
      // Birtingarnafn úr planinu (aðgreinir tvo „Jan“); id notað í aðgerðum.
      const nameOf = new Map([...emp, ...pool].filter((x) => x[4]).map((x) => [x[4]!, x[1]]));
      for (const row of res.rows) (map[row.date] ??= []).push({ first: (row.employeeId && nameOf.get(row.employeeId)) || row.first, start: row.start, end: row.end, ref: row.employeeId || row.first, tn: row.type, slot: row.slot ?? 0 });
      setMonthShifts(map);
    });
    return () => { cancelled = true; };
  }, [liveCompany, view, cur, monthVer, monthMode]); // eslint-disable-line react-hooks/exhaustive-deps -- emp/pool aðeins fyrir nöfn

  const d0 = weekDays[0], d6 = weekDays[6];
  const wklbl = d0.getMonth() === d6.getMonth()
    ? `${d0.getDate()}.–${d6.getDate()}. ${MONTHS_IS[d0.getMonth()]}`
    : `${d0.getDate()}. ${MONTHS_IS[d0.getMonth()].slice(0, 3)} – ${d6.getDate()}. ${MONTHS_IS[d6.getMonth()].slice(0, 3)}`;
  const periodLabel = view === "Dagur"
    ? `${t(DAYNAMES[curCol])} ${cur.getDate()}. ${t(MONTHS_IS[cur.getMonth()])} ${cur.getFullYear()}`
    : view === "Mánuður"
      ? (ppMonth
        ? (() => { const a = parseISO(monthRange.from), b = parseISO(monthRange.to); return `${a.getDate()}. ${t(MONTHS_IS[a.getMonth()]).slice(0, 3)} – ${b.getDate()}. ${t(MONTHS_IS[b.getMonth()]).slice(0, 3)} ${b.getFullYear()}`; })()
        : `${t(MONTHS_IS[cur.getMonth()])} ${cur.getFullYear()}`)
      : wklbl;

  // Per-day hours + shift counts, computed from the actual grid.
  const dayStats = weekDays.map((dd, c) => {
    let h = 0, n = 0;
    vis.forEach((r) => { const s = vg[r]?.[c]; if (s && s !== "off") { h += cellHrs(r, c, s); n++; } });
    return [c, dd.getDate(), h, n] as [number, number, number, number];
  });
  const totDayHrs = dayStats.reduce((a, d) => a + d[2], 0);
  const totDayShifts = dayStats.reduce((a, d) => a + d[3], 0);

  // KPI tölur fylgja sýninni (vika / dagur / mánuður).
  const dayHrs = useMemo(() => {
    let h = 0; vis.forEach((r) => { const s = vg[r]?.[curCol]; if (s && s !== "off") h += cellHrs(r, curCol, s); }); return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, vg, cellTimes, curCol, extras]);
  const weekShifts = useMemo(() => {
    let n = 0; vis.forEach((r) => vg[r]?.forEach((s, c) => { if (s && s !== "off") n += 1 + extrasOf(r, c).length; })); return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, vg, extras]);
  const dayShiftCount = useMemo(() => {
    let n = 0; vis.forEach((r) => { const s = vg[r]?.[curCol]; if (s && s !== "off") n += 1 + extrasOf(r, curCol).length; }); return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, vg, curCol, extras]);
  // Estimated premium (álag) + overtime hours from the planned grid.
  const est = useMemo(() => {
    let premium = 0; const rowHrs: number[] = [];
    vis.forEach((r) => {
      let rh = 0;
      vg[r]?.forEach((s, c) => { if (s && s !== "off") { rh += cellHrs(r, c, s); premium += cellPremiumHrs(r, c, s); } });
      rowHrs.push(rh);
    });
    const overtime = rowHrs.reduce((a, h) => a + Math.max(0, h - 40), 0); // weekly > 40 klst
    return { premium: Math.round(premium * 10) / 10, overtime: Math.round(overtime * 10) / 10 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, vg, cellTimes, extras]);
  const dayPremium = useMemo(() => {
    let p = 0; vis.forEach((r) => { const s = vg[r]?.[curCol]; if (s && s !== "off") p += cellPremiumHrs(r, curCol, s); }); return Math.round(p * 10) / 10;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, vg, cellTimes, curCol, extras]);
  const estHrs = view === "Dagur" ? { premium: dayPremium, overtime: 0 }
    : view === "Mánuður" ? { premium: Math.round(est.premium * 4.33), overtime: Math.round(est.overtime * 4.33) }
      : est;

  const kpi = view === "Dagur"
    ? { hl: "Tímar dagsins", hrs: dayHrs, sl: "Vaktir í dag", shifts: dayShiftCount, open: false }
    : view === "Mánuður"
      ? (liveCompany && monthMode === "tafla"
        ? { hl: "Tímar mánaðar", hrs: monthTot.hrs, sl: "Vaktir í mánuði", shifts: monthTot.shifts, open: false }
        : { hl: "Tímar mánaðar", hrs: Math.round(totalHrs * 4.33), sl: "Vaktir í mánuði", shifts: weekShifts * 4, open: false })
      : { hl: "Tímar vikunnar", hrs: totalHrs, sl: "Vaktir í viku", shifts: weekShifts, open: true };

  // Launaáætlun: áætlaður launakostnaður ALLS plansins (allar raðir, líka óbirtar
  // breytingar) á móti veltuspá vikunnar × markmiði fyrirtækisins.
  const [budget, setBudget] = useState<WeekBudget | null>(null);
  useEffect(() => {
    if (!liveCompany) return;
    let cancelled = false;
    // síað á deild/stað → spá og markmið fyrir þann stað (deildir eru á stöðum)
    const scope = depts.length ? depts : scopeDepts;
    getWeekBudget(weekMonISO, scope.length ? scope : null, selLocs.length && !depts.length ? selLocs : null).then((b) => { if (!cancelled) setBudget(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [weekMonISO, liveCompany, depts.join("|"), scopeDepts.join("|"), selLocs.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  // kr/klst með launatengdum gjöldum úr launareglum hvers starfsmanns (getWeekBudget); id gengur fyrir nafni.
  const rateOf = (e: Emp): number => (budget && ((e[4] ? budget.ratesById?.[e[4]] : undefined) ?? budget.rates[`${e[0]}|${e[1]}`] ?? budget.avgRate)) || COST_HR;
  // Síað plan (staður/deild): aðeins sýnilegar raðir og þeirra mánaðarlaun — sama og spáin nær yfir.
  const scoped = !!budget?.locationIds?.length;
  const fixedWeek = useMemo(() => {
    if (!budget) return 0;
    if (!scoped || !budget.fixedById) return budget.fixed;
    // Mánaðarlaun teljast á aðalstað starfsmanns (ekki á hvern stað sem hann vinnur á).
    return vis.filter((r) => { const h = homeLoc(r); return !selLocs.length || !h || selLocs.includes(h); })
      .reduce((a, r) => a + ((emp[r]?.[4] && budget.fixedById[emp[r][4]!]) || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, scoped, vis, emp, selLocs]);
  const planCost = useMemo(() => {
    if (!budget) return null;
    let c = fixedWeek;
    (scoped ? vis : emp.map((_, r) => r)).forEach((r) => {
      const rate = rateOf(emp[r]);
      vg[r]?.forEach((s, col) => { if (s && s !== "off") c += cellHrs(r, col, s) * rate; });
    });
    return Math.round(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, emp, vg, cellTimes, vis, scoped, fixedWeek, extras]);
  /** Dag fyrir dag: veltuspá × markmið − mánaðarlaun dagsins → leyfðir tímar á meðaltaxta sýnilegra. */
  const dayPlan = useMemo(() => {
    if (!budget?.days?.length || !budget.days.some((d) => d.revenue > 0)) return null;
    const tgt = budget.target ?? 30;
    const rs = vis.filter((r) => vg[r]?.some((s) => s && s !== "off"));
    const pool = rs.length ? rs : vis;
    const avg = pool.length ? pool.reduce((a, r) => a + rateOf(emp[r]), 0) / pool.length : (budget.avgRate || COST_HR);
    return budget.days.map((d, c) => {
      let planned = 0;
      vis.forEach((r) => { const s = vg[r]?.[c]; if (s && s !== "off") planned += cellHrs(r, c, s); });
      const allowedKr = Math.max(0, (d.revenue * tgt) / 100 - fixedWeek / 7);
      const allowedHrs = avg > 0 ? allowedKr / avg : 0;
      return { ...d, planned, allowedHrs };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, vis, emp, vg, cellTimes, fixedWeek, extras]);
  // Dagur: sama útreikningur og vikan, aðeins dálkur dagsins (mánaðarlaunafólk = sjöundi hluti vikunnar).
  const dayCost = useMemo(() => {
    if (!budget) return null;
    let c = fixedWeek / 7;
    vis.forEach((r) => { const s = vg[r]?.[curCol]; if (s && s !== "off") c += cellHrs(r, curCol, s) * rateOf(emp[r]); });
    return Math.round(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, vis, emp, vg, cellTimes, curCol, fixedWeek, extras]);
  // Mánuður (lifandi fyrirtæki): raunverulegar vaktir mánaðarins — úr töflunni eða dagatalinu — í stað viku × 4,33.
  const monthList = ((): MonthShift[] | null => {
    if (!liveCompany || view !== "Mánuður") return null;
    if (monthMode === "tafla") return monthTot.list;
    const y = cur.getFullYear(), m = cur.getMonth();
    const pre = `${y}-${String(m + 1).padStart(2, "0")}-`;
    const visRefs = new Set(vis.map((r) => empRef(emp[r])));
    const out: MonthShift[] = [];
    for (const [d, list] of Object.entries(monthShifts)) if (d.startsWith(pre)) for (const x of list) if (visRefs.has(x.ref)) out.push({ emp: x.ref, date: d, start: x.start.slice(0, 5), end: x.end.slice(0, 5) });
    return out;
  })();
  const monthFig = (() => {
    if (!monthList) return null;
    const byId = new Map(emp.map((e) => [empRef(e), e]));
    const weekKey = (d: string) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return fmtISO(x); };
    let hrs = 0, premium = 0, var_ = 0;
    const perWeek = new Map<string, number>();
    for (const s of monthList) {
      const h = hrsBetween(s.start, s.end);
      hrs += h; premium += premiumOf(s.date, s.start, s.end);
      const e = byId.get(s.emp); var_ += h * (e ? rateOf(e) : (budget?.avgRate || COST_HR));
      const k = `${s.emp}|${weekKey(s.date)}`; perWeek.set(k, (perWeek.get(k) ?? 0) + h);
    }
    const overtime = [...perWeek.values()].reduce((a, h) => a + Math.max(0, h - 40), 0);
    const days = Math.round((Date.parse(`${monthRange.to}T12:00:00Z`) - Date.parse(`${monthRange.from}T12:00:00Z`)) / 86400000) + 1;
    const cost = budget ? Math.round(var_ + (budget.fixed * days) / 7) : null;
    return { hrs: Math.round(hrs * 10) / 10, shifts: monthList.length, premium: Math.round(premium * 10) / 10, overtime: Math.round(overtime * 10) / 10, cost };
  })();
  const laborTarget = budget?.target ?? 30;
  const planPct = budget && planCost != null && budget.revenue > 0 ? Math.round((planCost / budget.revenue) * 1000) / 10 : null;
  const planColor = planPct == null ? "" : planPct <= laborTarget ? "good" : planPct <= laborTarget + 3 ? "warn" : "bad";
  const budgetCap = budget && budget.revenue > 0 ? Math.round((budget.revenue * laborTarget) / 100) : null;

  /** Samþykkt beiðni getur losað vaktir (veikindi, „losa vakt“) — sækja vikuna aftur svo gridið sýni það. */
  const [openVer, setOpenVer] = useState(0);
  function reloadWeek() {
    if (liveCompany) getWeekShifts(weekMonISO).then((res) => { if (res?.ok) applyWeek(res); }).catch(() => {});
    setOpenVer((v) => v + 1);
  }
  async function decideLeave(id: string | null, approved: boolean) {
    if (!id) { toast(approved ? "Samþykkt" : "Hafnað"); return; }
    const res = await updateLeaveRequest(id, approved);
    toast(res.ok ? (approved ? "Samþykkt" : "Hafnað") : (res.error ?? "Villa"));
    if (res.ok && approved) reloadWeek();
  }
  async function decideSwap(id: string | null, approved = true) {
    if (!id) { toast(approved ? "Samþykkt" : "Hafnað"); return; }
    const res = approved ? await approveShiftSwap(id) : await rejectShiftSwap(id);
    toast(res.ok ? (approved ? "Samþykkt" : "Hafnað") : (res.error ?? "Villa"));
    if (res.ok && approved) reloadWeek();
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
            employeeName: empRef(e),
            date: fmtISO(weekDays[c]),
            startTime: tt ? tt.start : `${a.padStart(2, "0")}:00`,
            endTime: tt ? tt.end : `${b.padStart(2, "0")}:00`,
            shiftTypeName: cellTypes[ckey(r, c)] || typeGuessFor(tt ? tt.start : `${a.padStart(2, "0")}:00`, tt ? tt.end : `${b.padStart(2, "0")}:00`),
            locationId: cellLocs[ckey(r, c)] ?? null,
            slot: 0, deptName: cellDepts[ckey(r, c)] ?? "",
          });
          out.push(...extraPayload(e, r, c, extras));
        }
      });
    });
    return out;
  }
  /** Aðrar vaktir sama dags (0110) sem ShiftInput — fylgja aðalvaktinni í útgáfu. */
  function extraPayload(e: Emp, r: number, c: number, ex: Record<string, ExtraShift[]>): ShiftInput[] {
    return (ex[ckey(r, c)] ?? []).map((x) => ({
      employeeName: empRef(e), date: fmtISO(weekDays[c]), startTime: x.start, endTime: x.end,
      shiftTypeName: x.type || typeGuessFor(x.start, x.end), locationId: x.loc ?? cellLocs[ckey(r, c)] ?? null, slot: x.slot, deptName: x.dept ?? "",
    }));
  }
  // Útgáfa: drög á opna tímabilinu (vika / dagur / mánuður) → „Gefa út plan (N)“, annars „✓ Plan útgefið“.
  const pubFrom = view === "Dagur" ? fmtISO(cur) : view === "Mánuður" ? monthRange.from : fmtISO(weekDays[0]);
  const pubTo = view === "Dagur" ? fmtISO(cur) : view === "Mánuður" ? monthRange.to : fmtISO(weekDays[6]);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [pubVer, setPubVer] = useState(0);
  const [publishing, setPublishing] = useState(false);
  useEffect(() => {
    if (!liveCompany) return;
    let gone = false;
    // Smá bið: vistanir fara á þjóninn um leið og gridið breytist.
    const tm = setTimeout(() => { getDraftCount(pubFrom, pubTo).then((r) => { if (!gone && r.ok) setDrafts(r.count); }); }, 900);
    return () => { gone = true; clearTimeout(tm); };
  }, [liveCompany, pubFrom, pubTo, grid, cellTimes, cellTypes, monthTot, monthVer, pubVer, extras]);

  /** Hvíldarmat vikunnar (11 klst. á hverjum vinnudegi) — allar vaktir starfsmanns, líka á öðrum stöðum. */
  function restWarning(): string | null {
    if (view !== "Vika") return null;
    const shifts: RestShift[] = [];
    vis.forEach((r) => {
      const e = emp[r];
      weekDays.forEach((d, c) => {
        const code = grid[r]?.[c];
        const day = new Date(d); day.setHours(0, 0, 0, 0);
        const at = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return day.getTime() + ((h || 0) * 60 + (m || 0)) * 60000; };
        const push = (s: number, en: number) => shifts.push({ who: e[4] ?? String(r), name: e[1], start: s, end: en <= s ? en + 86400000 : en, label: DAYS[c] });
        if (code && code !== "off") {
          const span = cellSpan(r, c, code);
          if (span) push(day.getTime() + span[0] * 3600000, day.getTime() + span[1] * 3600000);
        }
        for (const x of extras[ckey(r, c)] ?? []) push(at(x.start), at(x.end));
      });
    });
    const gaps = restGaps(shifts);
    if (!gaps.length) return null;
    return `${t("Hvíld undir 11 klst.")}: ${gaps.slice(0, 5).map((g) => `${g.name} (${g.label}, ${dec1(g.hours)} ${t("klst.")})`).join(", ")}${gaps.length > 5 ? ` +${gaps.length - 5}` : ""}. ${t("Frávik veita frítökurétt (1½ klst. fyrir hverja klst. sem vantar).")}`;
  }

  async function publish() {
    const rest = restWarning();
    if (rest && !window.confirm(`${rest}\n\n${t("Birta samt?")}`)) return;
    if (liveCompany) {
      if (!drafts) { toast(t("Planið er þegar útgefið — engar óútgefnar breytingar.")); return; }
      if (view === "Vika" && planPct != null && planPct > laborTarget
        && !window.confirm(`${t("Áætluð laun eru")} ${dec1(planPct)} % ${t("af veltuspá vikunnar — markmiðið er")} ${dec1(laborTarget)} %. ${t("Birta samt?")}`)) return;
      setPublishing(true);
      const res = await publishRange(pubFrom, pubTo);
      setPublishing(false);
      if (!res.ok) { toast(res.error ?? t("Tókst ekki að gefa út planið")); return; }
      setDrafts(0); setPubVer((v) => v + 1); setRosterKey((k) => k + 1); setMonthVer((v) => v + 1);
      toast(`${t("Plan gefið út")} — ${res.count ?? 0} ${t("vaktir")} · ${res.people ?? 0} ${t("starfsmenn fengu tilkynningu")}`);
      return;
    }
    if (planPct != null && planPct > laborTarget
      && !window.confirm(`${t("Áætluð laun eru")} ${dec1(planPct)} % ${t("af veltuspá vikunnar — markmiðið er")} ${dec1(laborTarget)} %. ${t("Birta samt?")}`)) return;
    const res = await publishSchedule(buildShiftPayload());
    if (!res.ok) { toast(res.error ?? "Tókst ekki að birta"); return; }
    toast(res.demo ? `Plan birt (demo — ${res.count} vaktir)` : `Plan birt — ${res.count} vaktir vistaðar${res.skippedClosed ? ` · ${res.skippedClosed} ${t("slepptu vegna lokaðra daga")}` : ""}`);
  }

  async function runAi(prompt: string) {
    setAiQuery(prompt);
    setAiProposal(null);
    setAiLoading(true);
    setAiStage({ stage: "read", shifts: 0 });
    setModal("aiResult");
    // Current plan of the visible week, per employee — so the AI proposes real shifts.
    const planLines = vis.map((r) => {
      const e = emp[r];
      const cells = weekDays.map((_, c) => {
        const code = grid[r]?.[c];
        if (!code || code === "off") return null;
        const tt = timeOf(r, c);
        return `${DAYS[c]} ${tt ? `${tt.start}–${tt.end}` : SH[code].l}`;
      }).filter(Boolean).join(", ");
      return `- ${e[1]} (${e[2]}): ${cells || "engar vaktir"}`;
    }).join("\n");
    // Real weekly revenue when available (real rows + weekday averages), else demo figure.
    let velta = liveCompany ? "" : "Áætluð velta vikunnar: 4.300.000 kr. ";
    if (liveCompany) {
      try {
        const pd = await getDashboardPeriod(fmtISO(weekDays[0]), fmtISO(weekDays[6]));
        if (pd.ok && pd.revenue > 0) velta = `Áætluð velta vikunnar: ${nf(pd.revenue)} kr. `;
      } catch { /* velta line omitted */ }
    }
    const context = `Vikan sem er opin: ${wklbl} ${weekDays[0].getFullYear()} (mánudagur = ${weekMonISO}, day 0=mán … 6=sun).\n`
      + `Starfsmenn á plani: ${vis.map((r) => `${emp[r][1]} (${emp[r][2]})`).join(", ")}.\n`
      + `Núverandi plan vikunnar:\n${planLines}\n`
      + `Tímar vikunnar: ${totalHrs} klst. Launakostnaður: ${nf(cost)} kr. ${velta}`
      + `Vaktategundir: ${types.map((t) => `${t.nm} ${t.t} ${t.prem}`).join("; ")}.`;
    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // weekStart: þjónninn sækir beiðnir, frí og framboð vikunnar sjálfur.
        body: JSON.stringify({ prompt, context, lang, weekStart: weekMonISO }),
      });
      // Streymt svar: stig (les → hugsar → skrifar) og fjöldi vakta jafnóðum; „done“ er tillagan.
      let data: (AiProposal & { ok?: boolean; error?: string }) | null = null;
      if (isNdjson(res)) {
        await readNdjson<ScheduleEvent>(res, (ev) => {
          if (ev.t === "stage") setAiStage((p) => ({ shifts: p?.shifts ?? 0, stage: ev.stage }));
          else if (ev.t === "progress") setAiStage({ stage: "write", shifts: ev.shifts });
          else if (ev.t === "done") data = ev as unknown as AiProposal & { ok?: boolean };
        });
      } else data = (await res.json()) as AiProposal & { ok?: boolean; error?: string };
      if (!data || !res.ok || data.ok === false) { toast((data as { error?: string } | null)?.error ?? t("Tókst ekki að ná í AI — reyndu aftur.")); setAiProposal(null); return; } // t.d. leið/kvóti: „Í boði í Vexti …“
      setAiProposal(data);
    } catch {
      toast(t("Tókst ekki að ná í AI — reyndu aftur."));
      setAiProposal(null);
    } finally {
      setAiLoading(false);
      setAiStage(null);
    }
  }

  /** Apply the AI's proposed shifts to the visible week's grid, then publish.
   * Rows of employees the proposal names are replaced in full; others untouched. */
  async function approveAiProposal() {
    setModal(null);
    const shifts = (aiProposal?.shifts ?? []).filter((s) => s.day >= 0 && s.day <= 6 && /^\d{1,2}:\d{2}$/.test(s.start) && /^\d{1,2}:\d{2}$/.test(s.end));
    const blocked = (aiProposal?.blocked ?? []).filter((b) => b.day >= 0 && b.day <= 6);
    if (!shifts.length && !blocked.length) { await publish(); return; }
    const rowOf = (name: string) => {
      const n = name.trim().toLowerCase();
      let r = emp.findIndex((e) => e[1].toLowerCase() === n);
      if (r < 0) r = emp.findIndex((e) => e[1].toLowerCase().startsWith(n.split(/\s+/)[0]));
      return r;
    };
    const touched = new Set<number>();
    for (const s of shifts) { const r = rowOf(s.employee); if (r >= 0) touched.add(r); }
    const ng = grid.map((row) => [...row]);
    const nt = { ...cellTimes };
    const nty = { ...cellTypes };
    // Vaktir á öðrum stöðum (síað á stað) haldast — AI-tillagan á aðeins við valda staði.
    const nex = { ...extras };
    touched.forEach((r) => { ng[r] = ng[r].map((x, c) => (foreign(r, c) ? x : "off")); weekDays.forEach((_, c) => { if (!foreign(r, c)) { delete nt[ckey(r, c)]; delete nty[ckey(r, c)]; delete nex[ckey(r, c)]; } }); });
    const nlo = { ...cellLocs };
    // Dagar með samþykkt frí sem AI reyndi að manna: engin vakt þar, líka ef hún var fyrir í planinu.
    for (const b of blocked) { const r = rowOf(b.employee); if (r >= 0) { ng[r][b.day] = "off"; delete nt[ckey(r, b.day)]; } }
    let applied = 0;
    for (const s of shifts) {
      const r = rowOf(s.employee);
      if (r < 0) continue;
      const start = s.start.padStart(5, "0"), end = s.end.padStart(5, "0");
      ng[r][s.day] = codeForStart(start);
      nt[ckey(r, s.day)] = { start, end };
      const pl = pickLoc(r); if (pl) nlo[ckey(r, s.day)] = pl;
      applied++;
    }
    setGrid(ng); setCellTimes(nt); setCellTypes(nty); setCellLocs(nlo); setExtras(nex);
    // Publish from the NEW grid (state is async — build the payload directly).
    const payload: ShiftInput[] = [];
    emp.forEach((e, r) => {
      ng[r]?.forEach((code, c) => {
        if (!code || code === "off") return;
        const tt = nt[ckey(r, c)];
        const [a, b] = SH[code].l.split("–");
        payload.push({
          employeeName: empRef(e),
          date: fmtISO(weekDays[c]),
          startTime: tt ? tt.start : `${a.padStart(2, "0")}:00`,
          endTime: tt ? tt.end : `${b.padStart(2, "0")}:00`,
          shiftTypeName: nty[ckey(r, c)] || typeGuessFor(tt ? tt.start : `${a.padStart(2, "0")}:00`, tt ? tt.end : `${b.padStart(2, "0")}:00`),
          locationId: nlo[ckey(r, c)] ?? null,
          slot: 0, deptName: cellDepts[ckey(r, c)] ?? "",
        });
        payload.push(...extraPayload(e, r, c, nex));
      });
    });
    const res = await publishSchedule(payload);
    if (!res.ok) { toast(res.error ?? "Tókst ekki að birta"); return; }
    toast(res.demo ? `AI-plan sett í grid (${applied} vaktir, demo)` : `AI-plan samþykkt — ${res.count ?? applied} vaktir settar og planið birt${res.skippedClosed ? ` · ${res.skippedClosed} ${t("slepptu vegna lokaðra daga")}` : ""}`);
  }

  function dropOn(tr: number, tc: number) {
    if (!drag) return;
    if (foreign(drag.r, drag.c) || foreign(tr, tc)) { setDrag(null); toast(t("Vakt á öðrum stað — veldu þann stað til að breyta henni")); return; }
    const from = ckey(drag.r, drag.c), to = ckey(tr, tc);
    setCellLocs((m) => { const n = { ...m }; const a = n[from], b = n[to]; if (b) n[from] = b; else delete n[from]; if (a) n[to] = a; else delete n[to]; return n; });
    setGrid((g) => {
      const ng = g.map((row) => [...row]);
      const tmp = ng[drag.r][drag.c];
      ng[drag.r][drag.c] = ng[tr][tc];
      ng[tr][tc] = tmp;
      return ng;
    });
    setCellTimes((m) => { const n = { ...m }; const a = n[from], b = n[to]; if (b) n[from] = b; else delete n[from]; if (a) n[to] = a; else delete n[to]; return n; });
    setCellTypes((m) => { const n = { ...m }; const a = n[from], b = n[to]; if (b) n[from] = b; else delete n[from]; if (a) n[to] = a; else delete n[to]; return n; });
    setCellDepts((m) => { const n = { ...m }; const a = n[from], b = n[to]; if (b) n[from] = b; else delete n[from]; if (a) n[to] = a; else delete n[to]; return n; });
    setExtras((m) => { const n = { ...m }; const a = n[from], b = n[to]; if (b) n[from] = b; else delete n[from]; if (a) n[to] = a; else delete n[to]; return n; });
    setDrag(null);
  }
  function cellClick(r: number, c: number) {
    if (foreign(r, c)) { const l = locOf(r, c); toast(`${t("Vakt á")} ${(l && locName.get(l)) || t("öðrum stað")} — ${t("veldu þann stað til að breyta henni")}`); return; }
    if (paint?.kind === "erase") { if ((grid[r]?.[c] ?? "off") !== "off") delCell(r, c); return; }
    if (paint?.kind === "type") {
      const tt = typeTimes(paint.ty);
      if (tt) { saveCell(r, c, tt[0], tt[1], paint.ty.nm); return; }
      if ((grid[r]?.[c] ?? "off") !== "off") { assignType(r, c, paint.ty.nm); return; } // tegund án fasts tíma: aðeins litur/álag
    }
    if (clip !== null) {
      setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = clip.code; return ng; });
      if (clip.code !== "off" && clip.start && clip.end) {
        setCellTimes((m) => ({ ...m, [ckey(r, c)]: { start: clip.start!, end: clip.end! } }));
        setCellTypes((m) => { const n = { ...m }; if (clip.type) n[ckey(r, c)] = clip.type; else delete n[ckey(r, c)]; return n; });
        const pl = cellLocs[ckey(r, c)] ?? pickLoc(r);
        if (pl) setCellLocs((m) => ({ ...m, [ckey(r, c)]: pl }));
        if (liveCompany) void saveShift({ employeeName: empRef(emp[r]), date: fmtISO(weekDays[c]), startTime: clip.start, endTime: clip.end, shiftTypeName: clip.type ?? "", locationId: pl ?? null });
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
  function saveCell(r: number, c: number, start: string, end: string, typeName: string, slot = 0, dept?: string) {
    if (slot > 0) { saveExtra(r, c, slot, start, end, typeName, dept); return; }
    if (dept !== undefined) setCellDepts((m) => { const n = { ...m }; if (dept) n[ckey(r, c)] = dept; else delete n[ckey(r, c)]; return n; });
    setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = codeForStart(start); return ng; });
    setCellTimes((m) => ({ ...m, [ckey(r, c)]: { start, end } }));
    // Valin tegund helst á reitnum (annars litaði gridið eftir tíma og sýndi aðra tegund).
    const known = types.some((x) => x.nm === typeName);
    setCellTypes((m) => { const n = { ...m }; if (known) n[ckey(r, c)] = typeName; else delete n[ckey(r, c)]; return n; });
    setModal(null);
    const pl = cellLocs[ckey(r, c)] ?? pickLoc(r);
    if (pl) setCellLocs((m) => ({ ...m, [ckey(r, c)]: pl }));
    if (liveCompany) {
      saveShift({ employeeName: empRef(emp[r]), date: fmtISO(weekDays[c]), startTime: start, endTime: end, shiftTypeName: typeName, locationId: pl ?? null, slot: 0, ...(dept !== undefined ? { deptName: dept } : {}) })
        .then((res) => toast(res.ok ? "Vakt vistuð" : (res.error ?? "Villa")));
    } else toast("Vakt vistuð (demo)");
  }
  /** Önnur vakt sama dags (0110): t.d. morgunmatur 7–10 og svo þrif 10–15 hjá sama starfsmanni. */
  function saveExtra(r: number, c: number, slot: number, start: string, end: string, typeName: string, dept?: string) {
    const k = ckey(r, c);
    const known = types.some((x) => x.nm === typeName);
    const prev = (extras[k] ?? []).find((x) => x.slot === slot);
    const loc = prev?.loc ?? cellLocs[k] ?? pickLoc(r);
    const nd = dept === undefined ? prev?.dept : dept || undefined;
    const row: ExtraShift = { slot, start, end, type: known ? typeName : undefined, loc, dept: nd, draft: true };
    setExtras((m) => ({ ...m, [k]: [...(m[k] ?? []).filter((x) => x.slot !== slot), row].sort((a, b) => a.slot - b.slot) }));
    setModal(null);
    if (liveCompany) {
      saveShift({ employeeName: empRef(emp[r]), date: fmtISO(weekDays[c]), startTime: start, endTime: end, shiftTypeName: typeName, locationId: loc ?? null, slot, ...(dept !== undefined ? { deptName: dept } : {}) })
        .then((res) => toast(res.ok ? t("Vakt vistuð") : (res.error ?? "Villa")));
    } else toast("Vakt vistuð (demo)");
  }
  /** Assign a shift TYPE (color/premium) to an existing shift WITHOUT touching
   * its times — "helgin má öll vera rauð" without rescheduling anyone. */
  function assignType(r: number, c: number, typeName: string) {
    setCellTypes((m) => ({ ...m, [ckey(r, c)]: typeName }));
    const tt = timeOf(r, c);
    const st = tt?.start ?? `${SH[grid[r]?.[c] ?? "D"].l.split("–")[0].padStart(2, "0")}:00`;
    const en = tt?.end ?? `${SH[grid[r]?.[c] ?? "D"].l.split("–")[1].padStart(2, "0")}:00`;
    if (liveCompany) {
      saveShift({ employeeName: empRef(emp[r]), date: fmtISO(weekDays[c]), startTime: st, endTime: en, shiftTypeName: typeName })
        .then((res) => toast(res.ok ? "Vaktategund breytt" : (res.error ?? "Villa")));
    } else toast("Vaktategund breytt (demo)");
  }
  function delCell(r: number, c: number, slot = 0) {
    const k = ckey(r, c);
    const ex = extras[k] ?? [];
    const drop1 = <T,>(m: Record<string, T>) => { const n = { ...m }; delete n[k]; return n; };
    if (slot > 0) {
      // Aukavakt eydd: þær á eftir færast upp um eitt sæti (eins og á þjóninum).
      setExtras((m) => {
        const rest = (m[k] ?? []).filter((x) => x.slot !== slot).map((x) => (x.slot > slot ? { ...x, slot: x.slot - 1 } : x));
        const n = { ...m }; if (rest.length) n[k] = rest; else delete n[k]; return n;
      });
    } else if (ex.length) {
      // Aðalvakt eydd en önnur vakt eftir þann dag → hún verður aðalvaktin.
      const [nx, ...rest] = ex;
      setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = codeForStart(nx.start); return ng; });
      setCellTimes((m) => ({ ...m, [k]: { start: nx.start, end: nx.end } }));
      setCellTypes((m) => { const n = drop1(m); if (nx.type) n[k] = nx.type; return n; });
      setCellLocs((m) => { const n = drop1(m); if (nx.loc) n[k] = nx.loc; return n; });
      setCellDepts((m) => { const n = drop1(m); if (nx.dept) n[k] = nx.dept; return n; });
      setExtras((m) => { const n = { ...m }; if (rest.length) n[k] = rest.map((x) => ({ ...x, slot: x.slot - 1 })); else delete n[k]; return n; });
    } else {
      setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = "off"; return ng; });
      setCellTimes(drop1);
      setCellTypes(drop1);
      setCellLocs(drop1);
      setCellDepts(drop1);
    }
    setModal(null);
    if (liveCompany) {
      deleteShift({ employeeName: empRef(emp[r]), dateISO: fmtISO(weekDays[c]), slot })
        .then((res) => { if (res.ok) offerUndo(res.deleted, t, reloadWeek); else toast(res.error ?? "Villa"); });
    } else toast("Vakt eydd (demo)");
  }
  /** Veikindi skráð á vaktina: hún er orðin laus vakt á þjóninum (registerAbsence) — tökum hana úr gridinu. */
  function sickCell(r: number, c: number) {
    setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = "off"; return ng; });
    setCellTimes((m) => { const n = { ...m }; delete n[ckey(r, c)]; return n; });
    setCellTypes((m) => { const n = { ...m }; delete n[ckey(r, c)]; return n; });
    setExtras((m) => { const n = { ...m }; delete n[ckey(r, c)]; return n; });
    setModal(null);
    reloadWeek(); // veikindi losa allar vaktir dagsins á þjóninum
  }
  function removeEmpRow(r: number) {
    const nm = emp[r][1];
    // Persist: delete the employee's shifts for the visible week so they don't
    // reappear on refresh (live companies only).
    if (liveCompany) {
      weekDays.forEach((d, c) => { if (grid[r]?.[c] && grid[r][c] !== "off" && !foreign(r, c)) void deleteShift({ employeeName: empRef(emp[r]), dateISO: fmtISO(d) }); });
    }
    setPool((p) => [...p, emp[r]]);
    setEmp((e) => e.filter((_, i) => i !== r));
    setGrid((g) => g.filter((_, i) => i !== r));
    // Reindex per-cell times + types after the removed row (types hliðruðust áður á næsta mann).
    const reindex = <T,>(m: Record<string, T>) => {
      const n: Record<string, T> = {};
      Object.entries(m).forEach(([k, v]) => {
        const [rr, cc] = k.split(":").map(Number);
        if (rr === r) return;
        n[`${rr > r ? rr - 1 : rr}:${cc}`] = v;
      });
      return n;
    };
    setCellTimes((m) => reindex(m));
    setCellTypes((m) => reindex(m));
    setCellLocs((m) => reindex(m));
    setCellDepts((m) => reindex(m));
    setExtras((m) => reindex(m));
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
      const s = vg[r]?.[c];
      if (s && s !== "off") {
        const tt = timeOf(r, c);
        const dep = cellDepts[ckey(r, c)] || e[2];
        out.push({ i: e[0], n: e[1], c: deptColors[dep] ?? e[3], dep, l: cellLabel(r, c, s), h: primHrs(r, c, s), type: SH[s].c, start: tt ? parseInt(tt.start) : parseInt(SH[s].l) });
        // Aðrar vaktir sama dags (0110) sem sér línur í dagsýn.
        for (const x of extrasOf(r, c)) {
          const xd = x.dept || e[2];
          out.push({ i: e[0], n: e[1], c: deptColors[xd] ?? e[3], dep: xd, l: `${x.start.slice(0, 2)}–${x.end.slice(0, 2)}`, h: hrsBetween(x.start, x.end), type: SH[codeForStart(x.start)].c, start: parseInt(x.start) });
        }
      }
    });
    return out.sort((a, b) => a.start - b.start);
  }
  // Blocks for a month-calendar day (live → real month data; demo → week pattern).
  function monthBlocks(iso: string, wd: number) {
    if (liveCompany) {
      return (monthShifts[iso] ?? []).slice().sort((a, b) => a.start.localeCompare(b.start))
        .map((s) => ({ name: s.first, ref: s.ref, tn: s.tn, slot: s.slot ?? 0, time: `${s.start.slice(0, 5)}–${s.end.slice(0, 5)}`, hrs: hrsBetween(s.start, s.end), type: SH[codeForStart(s.start)].c }));
    }
    const out: MonthBlock[] = [];
    vis.forEach((r) => { const s = vg[r]?.[wd]; if (s && s !== "off") { const tt = timeOf(r, wd); out.push({ name: emp[r][1], ref: empRef(emp[r]), tn: cellTypes[ckey(r, wd)], time: tt ? `${tt.start}–${tt.end}` : SH[s].l, hrs: primHrs(r, wd, s), type: SH[s].c }); } });
    return out;
  }

  // Entries (with real times) for one day — used by the month popup editor.
  const norm = (x: string) => (x.length === 2 ? x + ":00" : x.slice(0, 5));
  function entriesFor(date: Date): { first: string; ref: string; start: string; end: string; tn?: string; slot?: number }[] {
    const iso = fmtISO(date);
    if (liveCompany) return (monthShifts[iso] ?? []).map((x) => ({ first: x.first, ref: x.ref, tn: x.tn, slot: x.slot ?? 0, start: norm(x.start), end: norm(x.end) }));
    return monthBlocks(iso, (date.getDay() + 6) % 7).map((b) => {
      const [a, z] = b.time.split("–");
      return { first: b.name, ref: b.ref, tn: b.tn, start: norm(a ?? "08:00"), end: norm(z ?? "16:00") };
    });
  }
  // Vaktategund út frá tímum — aðeins ef tímarnir passa NÁKVÆMLEGA við eina tegund (annars engin tegund,
  // svo vaktin fái ekki rangt heiti/álag). Áður var giskað á fyrstu tegundina eða út frá „Kvöld“ o.s.frv.
  const typeGuessFor = (start: string, end?: string) => {
    const hit = types.filter((x) => { const [a, z] = (x.t || "").split("–").map((v) => v?.trim().slice(0, 5)); return a === start.slice(0, 5) && (!end || z === end.slice(0, 5)); });
    return hit.length === 1 ? hit[0].nm : "";
  };
  async function pasteMonthShift(toISO: string) {
    if (!monthClip) return;
    const res = await saveShift({ employeeName: monthClip.ref, date: toISO, startTime: monthClip.start, endTime: monthClip.end, shiftTypeName: monthClip.tn || typeGuessFor(monthClip.start, monthClip.end) });
    if (!res.ok) { toast(res.error ?? "Villa"); return; }
    setMonthVer((v) => v + 1);
    toast(res.demo ? t("Vakt límd (demo)") : t("Vakt límd"));
  }

  async function moveMonthShift(toISO: string) {
    const d = monthDragRef.current; monthDragRef.current = null;
    if (!d || d.fromISO === toISO) return;
    const r1 = await saveShift({ employeeName: d.ref, date: toISO, startTime: d.start, endTime: d.end, shiftTypeName: d.tn || typeGuessFor(d.start, d.end) });
    if (!r1.ok) { toast(r1.error ?? "Villa"); return; }
    if (!r1.demo) await deleteShift({ employeeName: d.ref, dateISO: d.fromISO, slot: d.slot ?? 0 });
    setMonthVer((v) => v + 1);
    toast(r1.demo ? t("Vakt færð (demo)") : t("Vakt færð"));
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
      // Sama deildasía og í planinu (tómt val = allir).
      const okRef = new Set(vis.map((r) => emp[r][4]).filter(Boolean) as string[]);
      if (res.ok) for (const row of res.rows) {
        if ((depts.length || scopeDepts.length) && (!row.employeeId || !okRef.has(row.employeeId))) continue;
        if (selLocs.length && row.locationId && !selLocs.includes(row.locationId)) continue; // vaktir annarra staða
        (byDate[row.date] ??= []).push({ first: row.first, full: row.name, dept: row.dept, time: `${row.start}–${row.end}`, hours: hrsBetween(row.start, row.end) });
      }
    } else {
      const pushCell = (iso: string, r: number, c: number) => {
        const code = grid[r]?.[c];
        if (!code || code === "off") return;
        const tt = timeOf(r, c);
        const [a, b] = SH[code].l.split("–");
        const time = tt ? `${tt.start}–${tt.end}` : `${a}:00–${b}:00`;
        (byDate[iso] ??= []).push({ first: emp[r][1], full: emp[r][1], dept: emp[r][2], time, hours: primHrs(r, c, code) });
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
    <div className={`db2x${full ? " sched-full" : ""}`}>
      <div className="db2-top">
        <div><h1>{t("Vaktaplan")}</h1><div className="db2-sub">{t("Dragðu vaktir til, sjáðu kostnaðinn strax og birtu planið.")}</div></div>
        {liveCompany && drafts === 0 ? (
          <button className="btn pub-done" onClick={publish} title={t("Allar vaktir á þessu tímabili eru útgefnar. Nýjar breytingar verða drög þar til þú gefur út aftur.")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12.5l4 4 10-10" /></svg>{t("Plan útgefið")}
          </button>
        ) : (
          <button className="btn pub-state" onClick={publish} disabled={publishing}
            title={liveCompany && drafts ? t("Starfsfólk sér ekki drög fyrr en planið er gefið út.") : undefined}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.5l4 4 10-10" /></svg>
            {publishing ? t("Gef út…") : t("Birta plan")}
            {liveCompany && !!drafts && <span className="n">{drafts}</span>}
          </button>
        )}
      </div>

      <div className="stoolbar">
        <div className="wk">
          <button onClick={() => shiftPeriod(-1)}>‹</button>
          <span className="lbl">{periodLabel}</span>
          <button onClick={() => shiftPeriod(1)}>›</button>
          {!onCurrentPeriod && <button className="wk-now" onClick={() => setCur(parseISO(todayISO))}>{t(resetLabel)}</button>}
        </div>
        <div className="seg" style={{ marginLeft: 4 }}>
          {(["Vika", "Dagur", "Mánuður"] as const).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{t(v)}</button>
          ))}
        </div>
        {multiLoc && (
          <DeptPicker
            values={selLocs.map((id) => locName.get(id) ?? "").filter(Boolean)}
            onChange={(names) => chooseLocs(locTree.locations.filter((l) => names.includes(l.name)).map((l) => l.id))}
            options={locTree.locations.map((l) => l.name)}
            allLabel="Allir staðir"
            unit="staðir"
            colors={{}}
            translate={false}
          />
        )}
        <DeptPicker
          values={depts}
          onChange={setDepts}
          options={(scopeDepts.length ? scopeDepts : deptList).filter((d) => !deptsInLocs || deptsInLocs.includes(d))}
          allLabel={scopeDepts.length ? "Allar mínar deildir" : "Allar deildir"}
          colors={deptColors}
          translate={false}
        />
        {view !== "Mánuður" && (
          <button className={`ctl${onlyShifts ? " on" : ""}`} aria-pressed={onlyShifts} onClick={() => setOnlyShifts((v) => !v)}
            title={t("Fela starfsfólk sem er ekki á vakt þessa viku")}>
            <span className="ctl-lbl">{t("Bara með vaktir")}</span>
          </button>
        )}
        {view === "Mánuður" && liveCompany && (
          <div className="seg">
            <button className={monthMode === "tafla" ? "on" : ""} onClick={() => setMonthMode("tafla")}>{t("Tafla")}</button>
            <button className={monthMode === "dagatal" ? "on" : ""} onClick={() => setMonthMode("dagatal")}>{t("Dagatal")}</button>
          </div>
        )}
        <div className="sp" style={{ flex: 1 }} />
        {view === "Vika" && (
          <button className="btn ghost sm" onClick={copyLastWeek}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>{t("Afrita síðustu viku")}
          </button>
        )}
        {!(view === "Mánuður" && liveCompany && monthMode === "tafla") && (
          <button className="btn ghost sm" onClick={() => setFull((v) => !v)} title={full ? t("Loka heilskjá (Esc)") : t("Heilskjár")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}</svg>{full ? t("Loka") : t("Heilskjár")}
          </button>
        )}
        <button className="btn ghost sm" onClick={() => setModal("ai")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z" /></svg>{t("Biðja AI")}
        </button>
        <div style={{ position: "relative" }}>
          <button className="btn ghost sm" aria-label={t("Fleiri aðgerðir")} aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
          {moreOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setMoreOpen(false)} />
              <div className="tmenu show" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", left: "auto" }} onClick={() => setMoreOpen(false)}>
                <div className="mi" onClick={openNewShift}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>{t("Vakt")}
                </div>
                <div className="mi" onClick={exportPdf}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3v5h5" /><path d="M7 3h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></svg>{t("Sækja PDF")}
                </div>
                {view === "Vika" && (
                  <>
                    <div className="sep" />
                    <div className="mi danger" onClick={clearWeek}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>{t("Eyða viku")}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {clip !== null && (
        <div id="pastebar" style={{ display: "flex" }}>
          <span className="pbtxt"><b>{t("Líma-hamur:")}</b> {t("smelltu á reiti til að líma")} {clip.code !== "off" ? `„${clip.start && clip.end ? `${clip.start}–${clip.end}` : SH[clip.code].l}"` : t("frí")}</span>
          <button className="btn ghost sm" onClick={() => setClip(null)}>{t("Hætta")}</button>
        </div>
      )}

      {/* Slim one-line summary so the grid itself stays at the top of the
          screen — the schedule is the point, the numbers just ride along.
          Day view has its own strip with the same figures, so skip here. */}
      {!full && (() => {
        // Sömu fjögur spjöld í öllum sýnum. Kostnaður = taxti hvers starfsmanns m. gjöldum (getWeekBudget);
        // mánuður lifandi fyrirtækis reiknast úr raunverulegum vöktum mánaðarins (monthFig).
        const mf = view === "Mánuður" ? monthFig : null;
        const hrsV = mf ? mf.hrs : kpi.hrs, shiftsV = mf ? mf.shifts : kpi.shifts;
        const cost = view === "Vika" && planCost != null ? planCost
          : view === "Dagur" && dayCost != null ? dayCost
            : mf?.cost != null ? mf.cost : Math.round(hrsV * COST_HR);
        const otV = mf ? mf.overtime : estHrs.overtime, premV = mf ? mf.premium : estHrs.premium;
        const showBudget = view === "Vika" && planPct != null && budgetCap != null;
        const room = showBudget ? budgetCap! - (planCost ?? 0) : 0;
        return (
        <div className="db2-row4 db2-mini">
          <section className="db2-card db2-tile">
            <div className="db2-k">{t(kpi.hl)}</div>
            <div className="db2-v">{dec1(hrsV)}<small>{t("klst")}</small></div>
            <div className="db2-s">{t(kpi.sl)} {shiftsV}{kpi.open && !liveCompany ? ` · 2 ${t("opnar")}` : ""}</div>
          </section>
          <section className="db2-card db2-tile">
            <div className="db2-k">{t("Áætl. launakostnaður")}</div>
            <div className="db2-v">{krCompact(cost)}</div>
            <div className="db2-s">{nf(cost)} kr {t("með gjöldum")}</div>
          </section>
          <section className="db2-card db2-tile" title={budget?.revenueSource === "estimated" || budget?.revenueSource === "mixed" ? t("Veltuspá byggir á meðalveltu vikudaga þar sem rauntölur vantar") : undefined}>
            <div className="db2-k">{t("Laun % af veltuspá")}</div>
            {showBudget ? (<>
              <div className="db2-v" style={{ color: `var(--${planColor})` }}>{dec1(planPct!)}<small>% · {t("markmið")} {dec1(laborTarget)} %</small></div>
              <div className="db2-prog"><span style={{ width: `${Math.min(100, ((planCost ?? 0) / Math.max(1, budgetCap!)) * 100)}%`, background: `var(--${planColor})` }} /></div>
              <div className="db2-s">{room >= 0 ? <>{t("svigrúm")} <b>{nf(room)} kr</b></> : <span style={{ color: "var(--bad)" }}>{nf(-room)} kr {t("yfir launaáætlun")}</span>}</div>
            </>) : <div className="db2-s" style={{ marginTop: 10 }}>{view === "Vika" ? t("Skráðu veltu til að sjá hlutfallið.") : t("Sést í vikusýn")}</div>}
          </section>
          {view === "Dagur" ? (
            <section className="db2-card db2-tile">
              <div className="db2-k">{t("Áætl. álagstímar")}</div>
              <div className="db2-v">{dec1(premV)}<small>{t("klst")}</small></div>
              <div className="db2-s">{t("Yfirvinna reiknast á viku — sjá vikusýn")}</div>
            </section>
          ) : (
            <section className="db2-card db2-tile">
              <div className="db2-k">{t("Áætl. yfirvinna")}</div>
              <div className="db2-v" style={{ color: otV > 0 ? "var(--bad)" : undefined }}>{dec1(otV)}<small>{t("klst")}</small></div>
              <div className="db2-s">{t("Áætl. álagstímar")} {dec1(premV)} {t("klst")}</div>
            </section>
          )}
        </div>
        );
      })()}

      {closed.length > 0 && (
        <div className="muted" role="note" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, margin: "12px 0 0", padding: "8px 12px", borderRadius: 10, background: "var(--line2)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flex: "none" }}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span><b style={{ color: "var(--ink)" }}>{t("Lokað")}:</b> {closed.map((c) => {
            const a = c.from < closedRange[0] ? closedRange[0] : c.from, b = c.to > closedRange[1] ? closedRange[1] : c.to;
            const dd = (x: string) => { const [, mo, da] = x.split("-").map(Number); return `${da}.${mo}`; };
            return `${dd(a)}${b !== a ? `–${dd(b)}` : ""} ${closedText(c)}`;
          }).join(" · ")} — {t("ekki hægt að setja vaktir á þessa daga")}</span>
        </div>
      )}
      {view === "Vika" && (
        <div>
          <div className="week-paint"><PaintTools types={types} tool={paint} setTool={(x) => { setPaint(x); if (x) setClip(null); }} onTypes={() => setModal("types")} /></div>
          <div className="sgrid-wrap" style={{ marginTop: 8 }}>
            <table className="sgrid">
              <thead>
                <tr>
                  <th>{t("Starfsmaður")}</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className={i === todayCol ? "tod" : ""} title={closuresOn(closed, fmtISO(weekDays[i])).map(closedText).join(", ") || undefined}>{t(d)}<span className="dn">{weekDays[i].getDate()}</span>{closuresOn(closed, fmtISO(weekDays[i])).length > 0 && <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--bad)" }}>{t("Lokað")}</span>}</th>
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
                          <span className="who"><span className="avt" style={{ background: deptColors[e[2]] ?? e[3] }}>{e[0]}</span><span>{e[1]}<small>{t(e[2])}</small></span></span>
                          <button className="rmemp" title={t("Fjarlægja af plani")} onClick={() => removeEmpRow(r)}>✕</button>
                        </div>
                      </td>
                      {grid[r].map((s, c) => {
                        const isUnav = ((e[4] ? unavail[e[4]] : undefined) ?? unavail[e[1].toLowerCase()] ?? []).includes(c);
                        if (foreign(r, c)) {
                          // Vakt á öðrum stað: sést (svo enginn tvíbókar) en er læst hér.
                          const ln = locName.get(locOf(r, c) ?? "") ?? t("Annar staður");
                          return (
                            <td key={c} className={c === todayCol ? "tod" : ""}>
                              <div className="shift" style={{ cursor: "not-allowed", background: "transparent", border: "1px dashed var(--line2)", color: "var(--ink2)", boxShadow: "none", opacity: 0.8 }}
                                title={`${t("Vakt á")} ${ln} — ${t("veldu þann stað til að breyta henni")}`} onClick={() => cellClick(r, c)}>
                                {cellLabel(r, c, s)}<small>{ln}</small>
                              </div>
                            </td>
                          );
                        }
                        return (
                        <td
                          key={c}
                          className={`${c === todayCol ? "tod" : ""}${isUnav ? (s === "off" ? " unav" : " unav conf") : ""}`}
                          onDragOver={(ev) => { ev.preventDefault(); ev.currentTarget.classList.add("cellh"); }}
                          onDragLeave={(ev) => ev.currentTarget.classList.remove("cellh")}
                          onDrop={(ev) => { ev.preventDefault(); ev.currentTarget.classList.remove("cellh"); dropOn(r, c); }}
                        >
                          <div
                            className={`shift ${SH[s].c}`}
                            style={(() => {
                              if (s === "off") return undefined;
                              const st = timeOf(r, c)?.start ?? `${SH[s].l.split("–")[0].padStart(2, "0")}:00`;
                              const ty = types.find((x) => x.nm === cellTypes[ckey(r, c)]) ?? types.find((x) => !!x.t && x.t !== "–" && x.t.startsWith(st));
                              return ty ? { background: ty.bg, borderColor: ty.bd, color: ty.fg } : undefined;
                            })()}
                            title={isUnav ? (s === "off" ? t("Skráð ólaus þennan dag") : t("ATH: skráð ólaus þennan dag — árekstur")) : t("hægrismelltu fyrir aðgerðir")}
                            draggable
                            onDragStart={() => setDrag({ r, c })}
                            onClick={() => cellClick(r, c)}
                            onContextMenu={(ev) => {
                              const tt = timeOf(r, c);
                              const items: { label: string; danger?: boolean; color?: string; act: () => void }[] = [];
                              if (s !== "off") {
                                items.push({ label: t("Breyta"), act: () => { setSel({ r, c }); setModal("shift"); } });
                                items.push({ label: t("Önnur vakt sama dag"), act: () => { setSel({ r, c, slot: 1 + (extras[ckey(r, c)]?.length ?? 0) }); setModal("shift"); } });
                                items.push({ label: t("Afrita"), act: () => { setClip({ code: s, start: tt?.start, end: tt?.end, type: cellTypes[ckey(r, c)] }); toast(t("Vakt afrituð — smelltu á reiti til að líma")); } });
                              } else {
                                items.push({ label: t("Ný vakt"), act: () => { setSel({ r, c }); setModal("shift"); } });
                              }
                              if (clip) items.push({ label: t("Líma hér"), act: () => cellClick(r, c) });
                              if (s !== "off") {
                                for (const ty of types) {
                                  items.push({ label: t(ty.nm), color: ty.fg, act: () => assignType(r, c, ty.nm) });
                                }
                                items.push({ label: t("Eyða vakt"), danger: true, act: () => delCell(r, c) });
                              }
                              openCtx(ev, items);
                            }}
                          >
                            {s === "off" ? "+" : <>{cellLabel(r, c, s)}<small>{cellTypes[ckey(r, c)] ? t(cellTypes[ckey(r, c)]) : SH[s].s ? t("sh:" + SH[s].s) :" "}</small>
                              {cellDepts[ckey(r, c)] && cellDepts[ckey(r, c)] !== e[2] && <span className="sdept">{cellDepts[ckey(r, c)]}</span>}</>}
                          </div>
                          {s !== "off" && (extras[ckey(r, c)] ?? []).map((x) => {
                            const ty = types.find((y) => y.nm === x.type) ?? types.find((y) => !!y.t && y.t !== "–" && y.t.startsWith(x.start));
                            return (
                              <div key={x.slot} className="shift-x">
                                <div className={`shift ${SH[codeForStart(x.start)].c}${x.draft ? " draft" : ""}`} style={ty ? { background: ty.bg, borderColor: ty.bd, color: ty.fg } : undefined}
                                  title={`${x.start}–${x.end}${x.dept ? ` · ${x.dept}` : ""}`}
                                  onClick={(ev) => { ev.stopPropagation(); setSel({ r, c, slot: x.slot }); setModal("shift"); }}
                                  onContextMenu={(ev) => openCtx(ev, [
                                    { label: t("Breyta"), act: () => { setSel({ r, c, slot: x.slot }); setModal("shift"); } },
                                    { label: t("Eyða vakt"), danger: true, act: () => delCell(r, c, x.slot) },
                                  ])}>
                                  {x.start.slice(0, 2)}–{x.end.slice(0, 2)}<small>{x.type ? t(x.type) : " "}</small>
                                  {x.dept && x.dept !== e[2] && <span className="sdept">{x.dept}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </td>
                        );
                      })}
                      <td className="r rowsum">{dec1(vg[r].reduce((a, s, c) => (s && s !== "off" ? a + cellHrs(r, c, s) : a), 0))}</td>
                    </tr>
                  );
                })}
                <tr className="foot">
                  <td style={{ textAlign: "left" }}>{t("Klst þann dag")}</td>
                  {Array.from({ length: 7 }, (_, c) => {
                    let n = 0;
                    vis.forEach((r) => { const s = vg[r][c]; if (s && s !== "off") n += cellHrs(r, c, s); });
                    return <td key={c} className={c === todayCol ? "tod" : ""}>{dec1(n)}</td>;
                  })}
                  <td className="r rowsum">{dec1(vis.reduce((a, r) => a + vg[r].reduce((b, s, c) => (s && s !== "off" ? b + cellHrs(r, c, s) : b), 0), 0))}</td>
                </tr>
                {dayPlan && (<>
                  <tr className="foot fc">
                    <td style={{ textAlign: "left" }} title={t("Skráð velta, annars meðaltal sama vikudags síðustu 8 vikna")}>{t("Veltuspá")}</td>
                    {dayPlan.map((d, c) => <td key={c} className={c === todayCol ? "tod" : ""} title={d.estimated ? t("Spá") : t("Skráð velta")}>{d.revenue > 0 ? `${d.estimated ? "≈ " : ""}${krCompact(d.revenue)}` : "—"}</td>)}
                    <td className="r rowsum">{krCompact(dayPlan.reduce((a, d) => a + d.revenue, 0))}</td>
                  </tr>
                  <tr className="foot fc">
                    <td style={{ textAlign: "left" }} title={`${t("Planaðir tímar / tímar sem launamarkmiðið leyfir")} (${dec1(laborTarget)} %)`}>{t("Klst / svigrúm")} <small style={{ fontWeight: 500, opacity: 0.7 }}>{dec1(laborTarget)} %</small></td>
                    {dayPlan.map((d, c) => {
                      const over = d.allowedHrs > 0 && d.planned > d.allowedHrs * 1.03;
                      const under = d.allowedHrs > 0 && d.planned < d.allowedHrs * 0.85;
                      return <td key={c} className={c === todayCol ? "tod" : ""} style={{ color: d.revenue <= 0 ? undefined : over ? "var(--bad)" : under ? "var(--warn)" : "var(--good)", fontWeight: 600 }}
                        title={d.revenue > 0 ? `${dec1(d.planned)} ${t("klst planaðar")} · ${t("markmiðið leyfir")} ${dec1(d.allowedHrs)} ${t("klst")}` : undefined}>
                        {d.revenue > 0 ? `${Math.round(d.planned)} / ${Math.round(d.allowedHrs)}` : "—"}
                      </td>;
                    })}
                    <td className="r rowsum">{Math.round(dayPlan.reduce((a, d) => a + d.planned, 0))} / {Math.round(dayPlan.reduce((a, d) => a + d.allowedHrs, 0))}</td>
                  </tr>
                </>)}
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
        </div>
      )}

      {view === "Dagur" && <div className="week-paint" style={{ marginTop: 16 }}><PaintTools types={types} tool={paint} setTool={(x) => { setPaint(x); if (x) setClip(null); }} onTypes={() => setModal("types")} /></div>}
      {view === "Dagur" && <DayView day={cur} col={curCol} rows={colShifts(curCol)} need={targets[curCol] ?? 0} onAdd={openNewShift}
        painting={!!paint}
        idle={vis.filter((r) => (vg[r]?.[curCol] ?? "off") === "off").map((r) => ({ r, i: emp[r][0], n: emp[r][1], c: deptColors[emp[r][2]] ?? emp[r][3], dep: emp[r][2] }))}
        onCell={(r) => cellClick(r, curCol)}
        onBar={(x) => { const r = emp.findIndex((e) => e[1] === x.n); if (r >= 0 && paint) { cellClick(r, curCol); return true; } return false; }}
        onEdit={(x) => { const r = emp.findIndex((e) => e[1] === x.n); if (r >= 0) { setSel({ r, c: curCol }); setModal("shift"); } }}
        onCtx={(x, ev) => {
        const r = emp.findIndex((e) => e[1] === x.n);
        if (r < 0) return;
        const code = grid[r]?.[curCol] ?? "off";
        const tt = timeOf(r, curCol);
        openCtx(ev, [
          { label: t("Breyta"), act: () => { setSel({ r, c: curCol }); setModal("shift"); } },
          { label: t("Afrita"), act: () => { setClip({ code, start: tt?.start, end: tt?.end, type: cellTypes[ckey(r, curCol)] }); toast(t("Vakt afrituð — smelltu á reiti til að líma")); } },
          ...types.map((ty) => ({ label: t(ty.nm), color: ty.fg, act: () => assignType(r, curCol, ty.nm) })),
          { label: t("Eyða vakt"), danger: true, act: () => delCell(r, curCol) },
        ]);
      }} />}
      {view === "Mánuður" && monthClip && (
        <div id="pastebar" style={{ display: "flex", marginTop: 12 }}>
          <span className="pbtxt"><b>{t("Líma-hamur:")}</b> {monthClip.first} · {monthClip.start}–{monthClip.end} — {t("smelltu á daga til að líma")}</span>
          <button className="btn ghost sm" onClick={() => setMonthClip(null)}>{t("Hætta")}</button>
        </div>
      )}
      {view === "Mánuður" && liveCompany && monthMode === "tafla" && (
        <MonthRoster range={monthRange} allDepts={deptList} todayISO={todayISO} types={types} deptSel={depts.length ? depts : (deptsInLocs ?? [])} scopeDepts={scopeDepts}
          onOpenDay={(d) => { setCur(d); setView("Dagur"); setFull(false); }} onTotals={setMonthTot}
          full={full} onToggleFull={() => setFull((v) => !v)} onTypes={() => setModal("types")} reloadKey={rosterKey} />
      )}
      {view === "Mánuður" && (!liveCompany || monthMode === "dagatal") && <MonthView monthDate={cur} todayISO={todayISO} blocks={monthBlocks}
        onEdit={(d) => { if (monthClip) { void pasteMonthShift(fmtISO(d)); } else setDayModal(d); }}
        onCtxBlock={(b, iso, ev) => openCtx(ev, [
          { label: t("Breyta"), act: () => setDayModal(parseISO(iso)) },
          ...types.map((ty) => ({ label: t(ty.nm), color: ty.fg, act: () => {
            const [a, z] = b.time.split("–");
            void saveShift({ employeeName: b.ref, date: iso, startTime: norm(a ?? "08:00"), endTime: norm(z ?? "16:00"), shiftTypeName: ty.nm, slot: b.slot ?? 0 })
              .then((res) => { setMonthVer((v) => v + 1); toast(res.ok ? t("Vaktategund breytt") : (res.error ?? "Villa")); });
          } })),
          { label: t("Afrita"), act: () => { const [a, z] = b.time.split("–"); setMonthClip({ first: b.name, ref: b.ref, tn: b.tn, start: norm(a ?? "08:00"), end: norm(z ?? "16:00") }); toast(t("Vakt afrituð — smelltu á daga til að líma")); } },
          ...(monthClip ? [{ label: t("Líma hér"), act: () => { void pasteMonthShift(iso); } }] : []),
          { label: t("Eyða vakt"), danger: true, act: () => {
            if (!liveCompany) { toast("Vakt eydd (demo)"); return; }
            void deleteShift({ employeeName: b.ref, dateISO: iso, slot: b.slot ?? 0 }).then((res) => { setMonthVer((v) => v + 1); if (res.ok) offerUndo(res.deleted, t, () => setMonthVer((v) => v + 1)); else toast(res.error ?? "Villa"); });
          } },
        ])}
        onCtxDay={(d, ev) => openCtx(ev, [
          { label: t("Ný vakt"), act: () => setDayModal(d) },
          ...(monthClip ? [{ label: t("Líma hér"), act: () => { void pasteMonthShift(fmtISO(d)); } }] : []),
        ])}
        onDragBlock={(b, iso) => { const [a, z] = b.time.split("–"); monthDragRef.current = { first: b.name, ref: b.ref, tn: b.tn, slot: b.slot ?? 0, start: norm(a ?? "08:00"), end: norm(z ?? "16:00"), fromISO: iso }; }}
        onDropDay={(iso) => moveMonthShift(iso)} />}
      {dayModal && <MonthShiftModal date={dayModal} entries={entriesFor(dayModal)} names={[...emp, ...pool].map((x) => ({ ref: empRef(x), name: x[1] }))} types={types}
        onClose={() => setDayModal(null)} onChanged={() => setMonthVer((v) => v + 1)}
        onOpenDayView={() => { setCur(dayModal); setView("Dagur"); setDayModal(null); }} />}

      {!full && <>
      <div className="grid2b">
        <div className="card">
          <div className="ch"><div className="ct"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 6 }}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></svg>{t("AI-vaktaplan")}</div><div className="cs">{t("segðu markmið — Vakto endurraðar")}</div></div>
          <div className="cb att">
            {[
              ["Lækka launakostnað um 10%", "haltu mönnun en lægri launum"],
              ["Minnka yfirvinnu", "dreifa tímum, laga hvíld"],
              [`Halda launum undir ${laborTarget}% af veltu`, "stilla mönnun að veltuspá"],
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
              <div className="tx"><b>{t(r.title)}</b><span>{t(r.detail)}</span>
                {r.hints?.map((h, hi) => <span key={hi} style={h.warn ? { color: "var(--warn)", fontWeight: 600 } : undefined}>{h.text}</span>)}
              </div>
              {r.kind === "leave" && <>
                <button className="btn sm" onClick={() => decideLeave(r.id, true)}>{t("Samþykkja")}</button>
                <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => decideLeave(r.id, false)}>{t("Hafna")}</button>
              </>}
              {r.kind === "swap" && <><button className="btn sm" onClick={() => decideSwap(r.id)}>{t("Samþykkja")}</button><button className="btn ghost sm" onClick={() => decideSwap(r.id, false)}>{t("Hafna")}</button></>}
              {r.kind === "avail" && <span className="tag mut">{t("skráð")}</span>}
            </div>
          ))}
          {!liveCompany && <div className="it"><div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg></div><div className="tx"><b>{t("Opin vakt: laugardag 12–20")}</b><span>{t("2 starfsmenn sóttu um — Ha Vu, Dalya")}</span></div><button className="btn sm" onClick={() => toast("Úthlutað")}>{t("Úthluta")}</button></div>}
        </div>
      </div>
      )}

      {liveCompany && <OpenShifts weekDays={weekDays} types={types.map((x) => ({ nm: x.nm, t: x.t }))} todayISO={todayISO} refresh={openVer} locationId={selLocs.length === 1 ? selLocs[0] : null} />}
      </>}

      {modal === "staff" && <StaffNeedModal targets={targets} onClose={() => setModal(null)} onSave={(ts) => { setTargets(ts); setModal(null); setStaffingTargets(ts).then((r) => toast(r.ok ? "Mönnunarþörf vistuð" : (r.error ?? "Villa"))); }} />}
      {modal === "types" && <ShiftTypesModal types={types} setTypes={persistTypes} onClose={() => setModal(null)} />}
      {modal === "addEmp" && <AddEmpModal pool={pool} onPick={pickEmp} onClose={() => setModal(null)} />}
      {ctx && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setCtx(null)} onContextMenu={(e) => { e.preventDefault(); setCtx(null); }} />
          <div className="tmenu show" style={{ position: "fixed", zIndex: 91, left: Math.min(ctx.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 190), top: Math.min(ctx.y, (typeof window !== "undefined" ? window.innerHeight : 800) - ctx.items.length * 42 - 10), right: "auto" }}>
            {ctx.items.map((it) => (
              <div className="mi" key={it.label} style={it.danger ? { color: "var(--bad)" } : undefined} onClick={() => { setCtx(null); it.act(); }}>
                {it.color && <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: it.color, marginRight: 7, flexShrink: 0 }} />}
                {it.label}
              </div>
            ))}
          </div>
        </>
      )}
      {modal === "shift" && <ShiftEditModal cellType={(r, c) => cellTypes[ckey(r, c)] ?? ""} types={types} emp={emp} weekDays={weekDays} sel={sel} gridCode={(r, c) => grid[r]?.[c] ?? "off"} timeOf={timeOf}
        extrasAt={(r, c) => extras[ckey(r, c)] ?? []} deptAt={(r, c) => cellDepts[ckey(r, c)]} allDepts={deptList}
        onSave={saveCell} onDelete={delCell} onSick={liveCompany ? sickCell : undefined} onClose={() => setModal(null)} onCopy={() => { if (sel) { const code = grid[sel.r]?.[sel.c] ?? "off"; const tt = timeOf(sel.r, sel.c); setClip({ code, start: tt?.start, end: tt?.end, type: cellTypes[ckey(sel.r, sel.c)] }); } setModal(null); toast(t("Vakt afrituð — smelltu á reiti til að líma")); }} onTypes={() => setModal("types")} />}
      {modal === "ai" && <AiPromptModal query={aiQuery} setQuery={setAiQuery} onClose={() => setModal(null)} onGen={() => runAi(aiQuery)} names={emp.map((e) => e[1])} depts={[...new Set(emp.map((e) => e[2]).filter(Boolean))]} live={liveCompany} />}
      {modal === "aiResult" && <AiResultModal query={aiQuery} proposal={aiProposal} loading={aiLoading} stage={aiStage} onClose={() => setModal(null)} onEdit={() => setModal("ai")} onApprove={approveAiProposal} />}
    </div>
  );
}

type DayRow = { i: string; n: string; c: string; dep: string; l: string; h: number; type: string; start: number };

function DayView({ day, col, rows, onAdd, onEdit, onCtx, need = 0, idle = [], onCell, onBar, painting = false }: {
  day: Date; col: number; rows: DayRow[]; onAdd: () => void; onEdit: (x: DayRow) => void; onCtx: (x: DayRow, ev: React.MouseEvent) => void; need?: number;
  /** Sýnilegt starfsfólk án vaktar þennan dag — smellur á línuna setur vakt (eða málar valda tegund). */
  idle?: { r: number; i: string; n: string; c: string; dep: string }[];
  onCell?: (r: number) => void;
  /** Mála-hamur: smellur á vakt málar/strokar út í stað þess að opna hana (skilar true ef það var gert). */
  onBar?: (x: DayRow) => boolean;
  painting?: boolean;
}) {
  const { t } = useLang();
  // Parse "08:00–16:00" / "08–16" labels into fractional hours.
  const parse = (lbl: string): { s: number; e: number } | null => {
    const m = lbl.match(/(\d{1,2})(?::(\d{2}))?\s*–\s*(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    const st = Number(m[1]) + Number(m[2] ?? 0) / 60;
    let en = Number(m[3]) + Number(m[4] ?? 0) / 60;
    if (en <= st) en += 24;
    return { s: st, e: en };
  };
  const spans = rows.map((x) => ({ ...x, span: parse(x.l) }));
  const withSpan = spans.filter((x) => x.span);
  const hMin = withSpan.length ? Math.min(6, ...withSpan.map((x) => Math.floor(x.span!.s))) : 6;
  const hMax = withSpan.length ? Math.max(24, ...withSpan.map((x) => Math.ceil(x.span!.e))) : 24;
  const range = Math.max(1, hMax - hMin);
  const pct = (h: number) => ((h - hMin) / range) * 100;
  const today = new Date();
  const isToday = day.toDateString() === today.toDateString();
  const nowH = today.getHours() + today.getMinutes() / 60;
  const ticks: number[] = [];
  for (let h = hMin; h <= hMax; h += range > 14 ? 3 : 2) ticks.push(h);
  return (
    <div style={{ marginTop: 16 }}>
      {need > 0 && (
        <div className="kstrip">
          <span className={rows.length < need ? "bad" : ""}>{t("Mönnunarþörf")} <b>{rows.length}</b> / {need}</span>
        </div>
      )}
      <div className="card" style={{ marginTop: need > 0 ? 16 : 0 }}>
        <div className="ch"><div><div className="ct">{t(DAYNAMES[col])} {day.getDate()}. {t(MONTHS_IS[day.getMonth()])}</div><div className="cs">{t("tímalína dagsins — smelltu á vakt til að breyta, hægrismelltu fyrir aðgerðir")}</div></div><button className="btn sm" onClick={onAdd}>{t("+ Bæta við vakt")}</button></div>
        <div className="cb" style={{ paddingTop: 6 }}>
          {rows.length || idle.length ? (
            <div className="dtl-wrap">
              <div className="dtl">
                <div className="dtl-row dtl-head">
                  <div className="dtl-who" />
                  <div className="dtl-track" style={{ height: 26 }}>
                    {ticks.map((h) => (
                      <span key={h} className="dtl-tick" style={{ left: `${pct(h)}%` }}>{String(h % 24).padStart(2, "0")}:00</span>
                    ))}
                  </div>
                </div>
                {spans.map((x, i) => (
                  <div className="dtl-row" key={i}>
                    <div className="dtl-who">
                      <span className="avt" style={{ background: x.c, width: 28, height: 28, fontSize: 11 }}>{x.i}</span>
                      <span className="dtl-nm">{x.n}<small>{t(x.dep)}</small></span>
                    </div>
                    <div className="dtl-track">
                      {ticks.map((h) => <i key={h} className="dtl-line" style={{ left: `${pct(h)}%` }} />)}
                      {isToday && nowH >= hMin && nowH <= hMax && <i className="dtl-now" style={{ left: `${pct(nowH)}%` }} />}
                      {x.span && (
                        <div
                          className={`dtl-bar ${x.type}`}
                          style={{ left: `${pct(x.span.s)}%`, width: `${Math.max(4, pct(x.span.e) - pct(x.span.s))}%` }}
                          onClick={() => { if (!onBar?.(x)) onEdit(x); }}
                          onContextMenu={(ev) => onCtx(x, ev)}
                          title={`${x.n} · ${x.l} · ${t("hægrismelltu fyrir aðgerðir")}`}
                        >
                          <span>{x.l}</span><small>{dec1(x.h)} {t("klst")}</small>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {idle.map((x) => (
                  <div className="dtl-row" key={`idle-${x.r}`} style={{ opacity: 0.85 }}>
                    <div className="dtl-who">
                      <span className="avt" style={{ background: x.c, width: 28, height: 28, fontSize: 11 }}>{x.i}</span>
                      <span className="dtl-nm">{x.n}<small>{t(x.dep)}</small></span>
                    </div>
                    <div className="dtl-track" role="button" tabIndex={0} style={{ cursor: "pointer" }}
                      title={painting ? t("Smelltu til að mála vakt") : t("Smelltu til að setja vakt")}
                      onClick={() => onCell?.(x.r)} onKeyDown={(ev) => { if (ev.key === "Enter") onCell?.(x.r); }}>
                      {ticks.map((h) => <i key={h} className="dtl-line" style={{ left: `${pct(h)}%` }} />)}
                      {isToday && nowH >= hMin && nowH <= hMax && <i className="dtl-now" style={{ left: `${pct(nowH)}%` }} />}
                      <span className="dtl-idle">{painting ? t("Smelltu til að mála vakt") : t("+ Setja vakt")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="muted" style={{ padding: 16, textAlign: "center" }}>{t("Engar vaktir þennan dag.")}</div>}
        </div>
      </div>
    </div>
  );
}

function MonthView({ monthDate, todayISO, blocks, onEdit, onCtxBlock, onCtxDay, onDragBlock, onDropDay }: { monthDate: Date; todayISO: string; blocks: (iso: string, wd: number) => MonthBlock[]; onEdit: (d: Date) => void; onCtxBlock: (b: MonthBlock, iso: string, ev: React.MouseEvent) => void; onCtxDay: (d: Date, ev: React.MouseEvent) => void; onDragBlock: (b: MonthBlock, iso: string) => void; onDropDay: (iso: string) => void }) {
  const { t } = useLang();
  const hd = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
  const y = monthDate.getFullYear(), m = monthDate.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="card">
        <div className="ch"><div><div className="ct">{t(MONTHS_IS[m])} {y}</div><div className="cs">{t("smelltu á dag eða vakt til að breyta · dragðu vakt á annan dag til að færa")}</div></div></div>
        <div className="cb">
          <div className="mcal-wrap">
          <div className="mcal">
            {hd.map((h) => <div className="hd" key={h}>{t(h)}</div>)}
            {Array.from({ length: lead + days + ((7 - ((lead + days) % 7)) % 7) }, (_, k) => k - lead + 1).map((d) => {
              const date = new Date(y, m, d);
              const adj = d < 1 || d > days;
              const wd = (date.getDay() + 6) % 7, we = wd >= 5;
              const tod = fmtISO(date) === todayISO;
              const sh = blocks(fmtISO(date), wd);
              return (
                <div key={d} className={`cell mcell ${we ? "we" : ""} ${tod ? "tod" : ""}${adj ? " adj" : ""}`} onClick={() => onEdit(date)}
                  onContextMenu={(ev) => onCtxDay(date, ev)}
                  onDragOver={(ev) => { ev.preventDefault(); ev.currentTarget.classList.add("cellh"); }}
                  onDragLeave={(ev) => ev.currentTarget.classList.remove("cellh")}
                  onDrop={(ev) => { ev.preventDefault(); ev.currentTarget.classList.remove("cellh"); onDropDay(fmtISO(date)); }}>
                  <div className="mhead"><span className="dd">{date.getDate()}</span>{sh.length > 0 && <span className="mtot">{dec1(sh.reduce((a, s) => a + s.hrs, 0))} {t("klst")}</span>}</div>
                  <div className="mblocks">
                    {sh.slice(0, 4).map((x, i) => (
                      <div key={i} className={`mblock ${x.type}`} draggable
                        onDragStart={(ev) => { ev.stopPropagation(); onDragBlock(x, fmtISO(date)); }}
                        onContextMenu={(ev) => onCtxBlock(x, fmtISO(date), ev)}
                        onClick={(e) => { e.stopPropagation(); onEdit(date); }} title={`${x.name} · ${x.time} · ${t("hægrismelltu fyrir aðgerðir")}`}>
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
    </div>
  );
}

/** Month-view popup: the day's shifts inline-editable + add a new one. */
function MonthShiftModal({ date, entries, names, types, onClose, onChanged, onOpenDayView }: {
  date: Date; entries: { first: string; ref: string; start: string; end: string; tn?: string; slot?: number }[]; names: { ref: string; name: string }[]; types: ShiftType[];
  onClose: () => void; onChanged: () => void; onOpenDayView: () => void;
}) {
  const { t: tr } = useLang();
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [rows, setRows] = useState(entries);
  useEffect(() => { setRows(entries); }, [entries]); // eslint-disable-line react-hooks/set-state-in-effect -- nýjar færslur utan frá
  const [busy, setBusy] = useState(false);
  // Tegund aðeins ef tímar passa nákvæmlega við eina tegund — annars engin (ekki rangt álag).
  const typeOf = (start: string, end: string) => {
    const hit = types.filter((x) => { const [a, z] = (x.t || "").split("–").map((v) => v?.trim().slice(0, 5)); return a === start && z === end; });
    return hit.length === 1 ? hit[0].nm : "";
  };
  const DN = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
  const title = `${tr(DN[(date.getDay() + 6) % 7])} ${date.getDate()}. ${tr(MONTHS_IS[date.getMonth()])}`;

  // Sama vaktaform og í öðrum sýnum: smellt á vakt (eða „Ný vakt“) opnar ShiftForm.
  const [editing, setEditing] = useState<{ i: number | null; ref: string } | null>(null);
  async function save(ref: string, start: string, end: string, type: string, slot?: number) {
    setBusy(true);
    // Ný vakt hjá starfsmanni sem er þegar á vakt þennan dag = önnur vakt dagsins (0110), ekki yfirskrift.
    const sl = slot ?? rows.filter((x) => x.ref === ref).length;
    const res = await saveShift({ employeeName: ref, date: iso, startTime: start, endTime: end, shiftTypeName: type || typeOf(start, end), slot: sl });
    setBusy(false);
    toast(res.ok ? (res.demo ? "Vistað (demo)" : tr("Vakt vistuð")) : (res.error ?? "Villa"));
    if (res.ok) { setEditing(null); onChanged(); }
  }
  async function del(i: number) {
    const r = rows[i];
    setBusy(true);
    const res = await deleteShift({ employeeName: r.ref, dateISO: iso, slot: r.slot ?? 0 });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Villa");
    else if (res.demo) toast("Eytt (demo)");
    else offerUndo(res.deleted, tr, onChanged);
    if (res.ok) { setRows((rs) => rs.filter((_, j) => j !== i)); setEditing(null); onChanged(); }
  }

  if (editing) {
    const r = editing.i != null ? rows[editing.i] : null;
    return (
      <ShiftSheet title={`${r ? r.first : tr("Ný vakt")} · ${title}`} onClose={() => setEditing(null)}>
        <ShiftForm types={types} isEdit={!!r} onClose={() => setEditing(null)}
          initial={r ? { type: r.tn || typeOf(r.start, r.end), start: r.start, end: r.end } : defaultsFor(types)}
          head={!r ? (
            <div className="field"><label>{tr("Starfsmaður")}</label>
              <select value={editing.ref} onChange={(e) => setEditing({ i: null, ref: e.target.value })}>
                {names.map((n) => <option key={n.ref} value={n.ref}>{n.name}</option>)}
              </select>
            </div>
          ) : undefined}
          onSave={(st, en, ty) => save(r ? r.ref : editing.ref, st, en, ty, r ? r.slot ?? 0 : undefined)}
          onDelete={editing.i != null ? () => del(editing.i!) : undefined} />
      </ShiftSheet>
    );
  }

  return (
    <Modal onClose={onClose} title={title}>
      {rows.length === 0 && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{tr("Engar vaktir þennan dag.")}</p>}
      {rows.map((r, i) => {
        const ty = types.find((x) => x.nm === (r.tn || typeOf(r.start, r.end)));
        return (
          <button type="button" key={`${r.first}-${i}`} className="sf-row" disabled={busy} onClick={() => setEditing({ i, ref: r.ref })}>
            <b>{r.first}</b>
            {ty && <span className="mr-tool" style={{ background: ty.bg, borderColor: ty.bd, color: ty.fg, padding: "2px 9px", fontSize: 11.5 }}>{tr(ty.nm)}</span>}
            <span className="muted" style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{r.start}–{r.end}</span>
          </button>
        );
      })}
      <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn" disabled={busy || !names.length} onClick={() => setEditing({ i: null, ref: names[0]?.ref ?? "" })}>{tr("+ Ný vakt")}</button>
        <button className="btn ghost" onClick={onOpenDayView}>{tr("Opna dagsýn")}</button>
        <button className="btn ghost" onClick={onClose}>{tr("Loka")}</button>
      </div>
    </Modal>
  );
}

function ShiftTypesModal({ types, setTypes, onClose }: { types: ShiftType[]; setTypes: (f: (t: ShiftType[]) => ShiftType[]) => void; onClose: () => void }) {
  const { t: tr } = useLang();
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [nm, setNm] = useState(""); const [s, setS] = useState("00:00"); const [e, setE] = useState("08:00");
  const [noTime, setNoTime] = useState(false);
  const [prem, setPrem] = useState("Dagvinna"); const [color, setColor] = useState("#7c6ff2");
  function startEdit(i: number) {
    const ty = types[i];
    setEditIdx(i); setNm(ty.nm);
    const unbound = !ty.t || ty.t === "–";
    setNoTime(unbound);
    const [a, z] = (ty.t || "").split("–");
    setS(a || "00:00"); setE(z || "08:00");
    setPrem(ty.prem); setColor(ty.fg);
  }
  function reset() { setEditIdx(null); setNm(""); setS("00:00"); setE("08:00"); setNoTime(false); setPrem("Dagvinna"); setColor("#7c6ff2"); }
  function submit() {
    if (!nm) { toast("Sláðu inn heiti"); return; }
    const row: ShiftType = { nm, t: noTime ? "" : `${s}–${e}`, prem, bg: color + "1f", bd: color + "59", fg: color };
    if (editIdx !== null) {
      setTypes((t) => t.map((x, j) => (j === editIdx ? row : x)));
      toast(tr("Vaktategund uppfærð"));
    } else {
      setTypes((t) => [...t, row]);
      toast(`Vaktategund „${nm}" búin til`);
    }
    reset();
  }
  function del(i: number) {
    setTypes((t) => (t.length <= 1 ? (toast("Þarf a.m.k. eina vaktategund"), t) : t.filter((_, j) => j !== i)));
    if (editIdx === i) reset();
  }
  return (
    <Modal onClose={onClose} title={tr("Vaktategundir")}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{tr("Smelltu á vaktategund til að breyta henni — heiti, tímum, álagi eða lit. Breytingar vistast og litirnir uppfærast í planinu.")}</p>
      <div className="att">
        {types.map((ty, i) => (
          <div className={`it rowlink`} key={i} onClick={() => startEdit(i)} style={editIdx === i ? { outline: "2px solid var(--brand)", outlineOffset: -2, borderRadius: 10 } : undefined}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: ty.bg, border: `1px solid ${ty.bd}`, flexShrink: 0 }} />
            <div className="tx"><b>{tr(ty.nm)}</b><span>{ty.t && ty.t !== "–" ? ty.t : tr("Enginn fastur tími")} · {tr(ty.prem)}</span></div>
            <button className="tag mut" style={{ background: "var(--line2)", color: "var(--ink3)", cursor: "pointer", border: "none" }} onClick={(ev) => { ev.stopPropagation(); del(i); }}>{tr("Eyða")}</button>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 12 }}>{editIdx !== null ? `${tr("Breyta")}: ${tr(types[editIdx]?.nm ?? "")}` : tr("Búa til nýja vaktategund")}</div>
        <div className="field"><label>{tr("Heiti")}</label><input value={nm} onChange={(e) => setNm(e.target.value)} placeholder={tr("t.d. Næturvakt")} /></div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={noTime} onChange={(ev) => setNoTime(ev.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--brand)" }} />
          {tr("Enginn fastur tími — bara litur og álag (t.d. Helgarvakt óháð klukku)")}
        </label>
        {!noTime && (
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1 }}><label>{tr("Upphaf")}</label><TimeField value={s} onChange={setS} style={{ width: "100%" }} /></div>
          <div className="field" style={{ flex: 1 }}><label>{tr("Lok")}</label><TimeField value={e} onChange={setE} style={{ width: "100%" }} /></div>
        </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1.4 }}><label>{tr("Álag")}</label>
            <select value={prem} onChange={(e) => setPrem(e.target.value)}>
              <option value="Dagvinna">{tr("Dagvinna")}</option><option value="+33% morgun/kvöld">{tr("+33% morgun/kvöld")}</option><option value="+45% helgi">{tr("+45% helgi")}</option><option value="+90% yfirvinna">{tr("+90% yfirvinna")}</option><option value="Næturálag">{tr("Næturálag")}</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>{tr("Litur")}</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ height: 38, padding: 3, cursor: "pointer" }} /></div>
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
          <button className="btn" onClick={submit}>{editIdx !== null ? tr("Vista breytingar") : tr("Bæta við")}</button>
          {editIdx !== null && <button className="btn ghost" onClick={reset}>{tr("Hætta við breytingu")}</button>}
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
  types, emp, weekDays, sel, gridCode, timeOf, cellType, onSave, onDelete, onSick, onClose, onCopy, onTypes, extrasAt, deptAt, allDepts,
}: {
  /** 0110: aðrar vaktir sama dags, deild aðalvaktar og allar deildir fyrirtækisins. */
  extrasAt: (r: number, c: number) => ExtraShift[];
  deptAt: (r: number, c: number) => string | undefined;
  allDepts: string[];
  /** Veikindi tilkynnt: vaktin verður laus og fjarvist skráð (aðeins lifandi fyrirtæki). */
  onSick?: (r: number, c: number) => void;
  types: ShiftType[]; emp: Emp[]; weekDays: Date[]; sel: { r: number; c: number; slot?: number };
  cellType: (r: number, c: number) => string;
  gridCode: (r: number, c: number) => string;
  timeOf: (r: number, c: number) => { start: string; end: string } | undefined;
  onSave: (r: number, c: number, start: string, end: string, typeName: string, slot?: number, dept?: string) => void;
  onDelete: (r: number, c: number, slot?: number) => void;
  onClose: () => void; onCopy: () => void; onTypes: () => void;
}) {
  // Sama vaktaform og í mánaðartöflunni (shift-form.tsx); hér bætist við val á starfsmanni/degi og verkefni.
  const { t: tr } = useLang();
  const [ri, setRi] = useState(sel.r < emp.length ? sel.r : 0);
  const [ci, setCi] = useState(sel.c);
  // Vakt nr. dagsins sem er breytt (0110). Skipti um starfsmann/dag → fyrsta vaktin.
  const [sl, setSl] = useState(sel.slot ?? 0);
  const tt0 = timeOf(ri, ci);
  const ex = extrasAt(ri, ci);
  const primaryOn = gridCode(ri, ci) !== "off";
  const slotItems = primaryOn && tt0 ? [{ slot: 0, start: tt0.start, end: tt0.end, dept: deptAt(ri, ci) ?? null }, ...ex.map((x) => ({ slot: x.slot, start: x.start, end: x.end, dept: x.dept ?? null }))] : [];
  const curEx = sl > 0 ? ex.find((x) => x.slot === sl) : undefined;
  const lastEnd = (ex[ex.length - 1]?.end ?? tt0?.end) || "";
  // Tegund vaktarinnar sem er breytt (áður alltaf fyrsta tegundin → vistun skipti um tegund).
  const existingType = cellType(ri, ci);
  const guessed = tt0 ? types.find((x) => { const tm = typeTimes(x); return tm && tm[0] === tt0.start && tm[1] === tt0.end; })?.nm : undefined;
  const plus4 = (hm: string) => `${String((Number(hm.slice(0, 2)) + 4) % 24).padStart(2, "0")}${hm.slice(2, 5)}`;
  const init = sl === 0
    ? (tt0 ? { type: existingType || guessed || "", start: tt0.start, end: tt0.end, dept: deptAt(ri, ci) } : defaultsFor(types))
    : curEx ? { type: curEx.type ?? "", start: curEx.start, end: curEx.end, dept: curEx.dept }
    // Ný aukavakt byrjar þar sem síðasta vakt dagsins endar (morgunmatur til 10 → þrif frá 10).
    : { type: "", start: lastEnd || "10:00", end: lastEnd ? plus4(lastEnd) : "14:00" };
  const filled = sl === 0 ? primaryOn : !!curEx;
  const e0 = emp[ri];
  const empDeptList = e0 ? [e0[2], ...((e0[5] ?? "").split("|"))].filter(Boolean) : [];
  const DNAMES = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
  // Verkefni vaktarinnar (starfsmaður hakar við í Mitt svæði).
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState("");
  const dateISOOf = (c: number) => {
    const d = weekDays[c];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  useEffect(() => {
    let gone = false;
    getShiftTasks(emp[ri] ? empRef(emp[ri]) : "", dateISOOf(ci)).then((res) => { if (!gone && res.ok) setTasks(res.tasks.map((x) => x.title)); });
    return () => { gone = true; };
  }, [ri, ci]); // eslint-disable-line react-hooks/exhaustive-deps
  async function persistTasks() {
    const all = newTask.trim() ? [...tasks, newTask.trim()] : tasks;
    await saveShiftTasks(emp[ri] ? empRef(emp[ri]) : "", dateISOOf(ci), all);
  }
  const addTask = () => { if (newTask.trim()) { setTasks((ts) => [...ts, newTask.trim()]); setNewTask(""); } };
  const d = weekDays[ci];
  return (
    <ShiftSheet title={`${filled ? tr("Breyta vakt") : tr("Ný vakt")} · ${emp[ri]?.[1] ?? ""} · ${tr(DNAMES[ci]).slice(0, 3)} ${d.getDate()}.${d.getMonth() + 1}.`} onClose={onClose}>
      <ShiftForm key={`${ri}|${ci}|${sl}`} types={types} initial={init} isEdit={filled} onTypes={onTypes} onClose={onClose}
        depts={empDeptList} mainDept={e0?.[2]} otherDepts={allDepts}
        head={
          <>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="field" style={{ flex: 1.4 }}><label>{tr("Starfsmaður")}</label>
                <select value={ri} onChange={(e) => { setRi(Number(e.target.value)); setSl(0); }}>{emp.map((x, i) => <option key={i} value={i}>{x[1]}</option>)}</select>
              </div>
              <div className="field" style={{ flex: 1 }}><label>{tr("Dagur")}</label>
                <select value={ci} onChange={(e) => { setCi(Number(e.target.value)); setSl(0); }}>{weekDays.map((dd, i) => <option key={i} value={i}>{tr(DNAMES[i]).slice(0, 3)} {dd.getDate()}.{dd.getMonth() + 1}</option>)}</select>
              </div>
            </div>
            <SlotTabs items={slotItems} current={sl} onPick={setSl} onAdd={() => setSl(slotItems.length)} />
          </>
        }
        sick={onSick && emp[ri]?.[4] ? { employeeId: emp[ri][4]!, name: emp[ri][1], dateISO: dateISOOf(ci), onDone: () => onSick(ri, ci) } : null}
        extra={
          <details className="sf-tasks" open={tasks.length > 0}>
            <summary>{tr("Verkefni vaktarinnar")}{tasks.length ? ` (${tasks.length})` : ""}</summary>
            {tasks.map((title, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13.5 }}>
                <span style={{ flex: 1 }}>{title}</span>
                <button className="x" style={{ fontSize: 12 }} onClick={() => setTasks((ts) => ts.filter((_, j) => j !== i))} aria-label={tr("Eyða")}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder={tr("t.d. Opna kassa, fylla á sósur…")}
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} style={{ flex: 1, minWidth: 0 }} />
              <button className="btn ghost sm" type="button" onClick={addTask}>{tr("Bæta við")}</button>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{tr("Starfsmaðurinn hakar við verkefnin í Mitt svæði á vaktinni.")}</p>
          </details>
        }
        onSave={async (start, end, type, dept) => { if (sl === 0) await persistTasks(); onSave(ri, ci, start, end, type, sl, dept); }}
        onDelete={() => onDelete(ri, ci, sl)} onCopy={onCopy} />
    </ShiftSheet>
  );
}

function AiPromptModal({ query, setQuery, onClose, onGen, names = [], depts = [], live = false }: { query: string; setQuery: (s: string) => void; onClose: () => void; onGen: () => void; names?: string[]; depts?: string[]; live?: boolean }) {
  const { t: tr, lang } = useLang();
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const speechOk = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  /** Voice input: dictate the instruction (is-IS), appended into the textarea. */
  function toggleVoice() {
    if (listening) { recRef.current?.stop(); return; }
    const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor() as {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void; onerror: () => void; start: () => void; stop: () => void;
    };
    rec.lang = "is-IS";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      const text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0]?.transcript ?? "").join(" ").trim();
      if (text) setQuery(query ? `${query} ${text}` : text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  // Relevant examples built from the REAL roster (names + departments).
  const ex = lang === "pl" ? [
    names[0] ? `Daj ${names[0]} poranne zmiany 05:00–12:00 w każdy dzień roboczy` : "Poranne zmiany 05:00–12:00 w każdy dzień roboczy",
    "Ogranicz nadgodziny w tym tygodniu",
    depts.length >= 2 ? `Obsadź weekend: 2 osoby w ${depts[0]} i 2 w ${depts[1]}` : "Obsadź weekend: 2 osoby rano i 2 po południu",
    names[1] ? `Daj ${names[1]} wolny piątek i przenieś zmianę na kogoś innego` : "Skopiuj ten tydzień na kolejne 4 tygodnie",
  ] : lang !== "is" ? [
    names[0] ? `Put ${names[0]} on morning shifts 05:00–12:00 every weekday` : "Morning shifts 05:00–12:00 every weekday",
    "Minimise overtime this week",
    depts.length >= 2 ? `Staff the weekend with 2 in ${depts[0]} and 2 in ${depts[1]}` : "Staff the weekend with 2 on mornings and 2 in the afternoon",
    names[1] ? `Give ${names[1]} Friday off and move the shift to someone else` : "Copy this week to the next 4 weeks",
  ] : [
    names[0] ? `Settu ${names[0]} á morgunvaktir 05:00–12:00 alla virka daga` : "Morgunvaktir 05:00–12:00 alla virka daga",
    "Lágmarkaðu yfirvinnu í þessari viku",
    depts.length >= 2 ? `Mannaðu helgina með 2 í ${depts[0]} og 2 í ${depts[1]}` : "Mannaðu helgina með 2 á morgunvakt og 2 eftir hádegi",
    names[1] ? `Gefðu ${names[1]} frí á föstudag og færðu vaktina á annan` : "Afritaðu þessa viku á næstu 4 vikur",
  ];
  return (
    <Modal onClose={onClose} title={<><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 7, verticalAlign: -3 }}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></svg>{tr("Biðja AI um vaktaplan")}</>}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{tr("Lýstu því sem þú vilt á venjulegri íslensku — VAKTO býr til vaktirnar og þú samþykkir.")}</p>
      <p className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}>{tr("Tillagan gildir fyrir vikuna sem er opin í planinu — flettu fyrst á réttu vikuna (t.d. næstu viku) með örvunum efst.")}</p>
      <div style={{ position: "relative" }}>
        <textarea className="lf-ta" rows={3} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("sched:aiph")} style={speechOk ? { paddingRight: 44 } : undefined} />
        {speechOk && (
          <button
            type="button"
            onClick={toggleVoice}
            title={listening ? tr("Stöðva upptöku") : tr("Tala inn fyrirmæli")}
            style={{
              position: "absolute", right: 8, top: 8, width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--line)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              background: listening ? "var(--bad)" : "var(--line2)", color: listening ? "#fff" : "var(--ink2)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></svg>
          </button>
        )}
      </div>
      {listening && <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", color: "var(--bad)" }}>{tr("Hlusta… talaðu fyrirmælin og smelltu svo aftur á hljóðnemann.")}</p>}
      <div className="chips">{ex.map((c) => <button className="chip" key={c} onClick={() => setQuery(c)}>{c}</button>)}</div>
      {live && <PlanningRules examples={names[0] ? [`${names[0]} vinnur aðeins morgunvaktir`] : []} />}
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

function AiResultModal({ query, proposal, loading, stage, onClose, onEdit, onApprove }: { query: string; proposal: AiProposal | null; loading: boolean; stage: AiStage | null; onClose: () => void; onEdit: () => void; onApprove: () => void }) {
  const { t: tr } = useLang();
  // Sekúndur frá því beðið var um — uppfært einu sinni á sekúndu á meðan AI vinnur.
  // (glugginn opnast um leið og beðið er um tillöguna, svo upphafstíminn er tíminn sem hann opnaðist)
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => { if (!loading) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [loading]);
  const secs = Math.max(0, Math.round((now - start) / 1000));
  const steps: { key: AiStage["stage"]; label: string }[] = [
    { key: "read", label: tr("Les beiðnir, frí og framboð") },
    { key: "think", label: tr("Hugsar um vikuna") },
    { key: "write", label: stage?.stage === "write" && stage.shifts ? `${tr("Skrifar tillöguna")} · ${stage.shifts} ${tr("vaktir")}` : tr("Skrifar tillöguna") },
  ];
  const at = stage ? steps.findIndex((x) => x.key === stage.stage) : -1;
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
        <div className="ai-steps" aria-live="polite">
          {steps.map((x, i) => (
            <div key={x.key} className={`ai-step${i < at ? " done" : i === at ? " on" : ""}`}>
              <span className="ai-step-ic">{i < at ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : i === at ? <span className="vai-dots"><i /><i /><i /></span> : null}</span>
              <span>{x.label}</span>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 4 }}>{tr("sched:ailoading")}{secs ? ` · ${secs} s` : ""}</div>
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
      {!loading && proposal && (proposal.shifts?.length ?? 0) > 0 && (
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          <b style={{ color: "var(--brand)" }}>{proposal.shifts!.length}</b> {tr("vaktir í tillögunni — við samþykki eru þær settar í planið og það birt.")}
        </p>
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
