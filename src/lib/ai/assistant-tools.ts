import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getDashboardPeriod } from "@/app/(app)/maelabord/actions";
import { getWhoIsOn } from "@/app/(app)/timaskraning/attendance.server";
import { fetchAttendance, setClockOut } from "@/app/(app)/timaskraning/actions";
import { getShiftsInRange, saveShift, deleteShift, updateLeaveRequest, approveShiftSwap, getWeekBudget, getWeekShifts, deleteWeekShifts, publishSchedule } from "@/app/(app)/vaktaplan/actions";
import { getEmployees } from "@/lib/employees.server";
import { createClient } from "@/lib/supabase/server";
import { getPendingRequests } from "@/app/(app)/vaktaplan/requests.server";

// VAKTO AI — verkfæri. LESverkfæri keyra strax (sömu aðgerðir og skjáirnir nota, sama aðgangsstýring).
// SKRIFverkfæri keyra ALDREI í líkaninu sjálfu: þau verða „tillaga" sem notandinn staðfestir með hnappi,
// og /api/assistant/execute framkvæmir hana eftir að hafa athugað innskráningu og hlutverk aftur.

const DATE = { type: "string", description: "YYYY-MM-DD" } as const;
const TIME = { type: "string", description: "HH:MM (24 klst.)" } as const;

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: "labor_summary",
    description: "Laun sem % af veltu, velta, launakostnaður, unnir og áætlaðir tímar, frávik og kostnaður þess, yfirvinna og álag, og tölur per starfsmann, fyrir tímabil.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "who_is_on_now",
    description: "Hverjir eru stimplaðir inn núna (og síðan hvenær), og hverjir á plani dagsins hafa ekki mætt.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "staff_hours",
    description: "Áætlaðir og unnir tímar per starfsmann á tímabili, frávik og kostnaður.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "shifts",
    description: "Vaktir á tímabili (nafn, deild, dagsetning, tímar, vaktategund). Notaðu til að skoða vaktaplan áður en þú leggur til breytingar.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "pending_requests",
    description: "Opnar beiðnir starfsfólks: frí-beiðnir, vaktaskipti og óframboð, með auðkennum (id) sem þarf til að afgreiða þær.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "week_planning_context",
    description: "Allt sem þarf til að setja upp vaktaplan fyrir heila viku: starfsfólk (deild, starfshlutfall, tímakaup/föst laun), núverandi vaktir vikunnar, hverjir eru ekki tiltækir hvaða daga (óframboð), samþykkt frí, vaktategundir með tímum, mönnunarþörf per dag og launaáætlun (veltuspá, launamarkmið, kostnaður per klst). Kallaðu á þetta ÁÐUR en þú notar plan_week.",
    input_schema: { type: "object", properties: { monday: { type: "string", description: "Mánudagur vikunnar, YYYY-MM-DD" } }, required: ["monday"] },
  },
];

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "set_shift",
    description: "LEGGJA TIL að setja eða breyta vakt starfsmanns á dagsetningu. Framkvæmist ekki fyrr en notandinn staðfestir.",
    input_schema: {
      type: "object",
      properties: { employee: { type: "string", description: "Fornafn starfsmanns eins og það birtist í kerfinu" }, date: DATE, start: TIME, end: TIME, shiftType: { type: "string", description: "Heiti vaktategundar, t.d. Dagvakt (valfrjálst)" } },
      required: ["employee", "date", "start", "end"],
    },
  },
  {
    name: "remove_shift",
    description: "LEGGJA TIL að eyða vakt starfsmanns á dagsetningu. Framkvæmist ekki fyrr en notandinn staðfestir.",
    input_schema: { type: "object", properties: { employee: { type: "string" }, date: DATE }, required: ["employee", "date"] },
  },
  {
    name: "decide_leave",
    description: "LEGGJA TIL að samþykkja eða hafna frí-beiðni (id úr pending_requests).",
    input_schema: { type: "object", properties: { id: { type: "string" }, approve: { type: "boolean" }, label: { type: "string", description: "Stutt lýsing, t.d. „Frí-beiðni Mínu 12.–14. okt.“" } }, required: ["id", "approve", "label"] },
  },
  {
    name: "approve_swap",
    description: "LEGGJA TIL að samþykkja vaktaskipti (id úr pending_requests).",
    input_schema: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } }, required: ["id", "label"] },
  },
  {
    name: "clock_out",
    description: "LEGGJA TIL að stimpla starfsmann út (t.d. ef hann gleymdi því) á tilteknum tíma í dag.",
    input_schema: { type: "object", properties: { employee: { type: "string" }, time: TIME }, required: ["employee", "time"] },
  },
  {
    name: "plan_week",
    description: "LEGGJA TIL heilt vaktaplan fyrir eina viku (mánudag–sunnudag) í einni tillögu. KEMUR Í STAÐ allra vakta vikunnar: taktu því með ALLAR vaktir sem eiga að vera, líka þær sem breytast ekki. Þegar notandinn staðfestir er planið birt og starfsfólk fær tilkynningu. Notaðu þetta fyrir beiðnir eins og „settu upp næstu viku“, „allir vinni 35 tíma og fái einn frídag“. Fyrir stakar breytingar notaðu set_shift.",
    input_schema: {
      type: "object",
      properties: {
        monday: { type: "string", description: "Mánudagur vikunnar, YYYY-MM-DD" },
        label: { type: "string", description: "Ein setning sem lýsir planinu, t.d. „Allir 35–38 klst., einn frídagur hver, helgar mannaðar 4“" },
        shifts: {
          type: "array",
          items: {
            type: "object",
            properties: { employee: { type: "string", description: "Fornafn eins og í week_planning_context" }, date: DATE, start: TIME, end: TIME, shiftType: { type: "string", description: "Heiti vaktategundar (valfrjálst)" } },
            required: ["employee", "date", "start", "end"],
          },
        },
      },
      required: ["monday", "label", "shifts"],
    },
  },
];

export const WRITE_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

type In = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const okDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(v));
const okTime = (v: unknown) => /^\d{1,2}:\d{2}$/.test(str(v));

/** Dagarnir sjö frá mánudegi (YYYY-MM-DD). */
function weekDates(mon: string): string[] {
  const [y, m, d] = mon.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => { const dt = new Date(y, m - 1, d + i); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; });
}
type PlanShift = { employee: string; date: string; start: string; end: string; shiftType: string };
/** Sannreynir vikuplan: mánudagur, vaktir innan vikunnar, ein vakt per starfsmann per dag. */
function parseWeekPlan(input: In): { ok: true; mon: string; dates: string[]; shifts: PlanShift[] } | { ok: false; error: string } {
  if (!okDate(input.monday)) return { ok: false, error: "monday verður að vera YYYY-MM-DD" };
  const mon = str(input.monday), dates = weekDates(mon);
  if (new Date(`${mon}T12:00:00`).getDay() !== 1) return { ok: false, error: `${mon} er ekki mánudagur` };
  if (!Array.isArray(input.shifts) || !input.shifts.length) return { ok: false, error: "Engar vaktir í planinu" };
  if (input.shifts.length > 400) return { ok: false, error: "Of margar vaktir í einu plani" };
  const out: PlanShift[] = []; const seen = new Set<string>();
  for (const raw of input.shifts as In[]) {
    const who = str(raw?.employee), date = str(raw?.date);
    if (!who || !okDate(date) || !okTime(raw?.start) || !okTime(raw?.end)) return { ok: false, error: "Hver vakt þarf employee, date (YYYY-MM-DD), start og end (HH:MM)" };
    if (!dates.includes(date)) return { ok: false, error: `Vakt ${date} er utan vikunnar ${dates[0]}–${dates[6]}` };
    const k = `${who.toLowerCase()}|${date}`;
    if (seen.has(k)) return { ok: false, error: `${who} er með tvær vaktir ${date} — aðeins ein vakt per dag` };
    seen.add(k);
    out.push({ employee: who, date, start: str(raw.start).padStart(5, "0"), end: str(raw.end).padStart(5, "0"), shiftType: str(raw.shiftType) });
  }
  return { ok: true, mon, dates, shifts: out };
}
const shortDate = (iso: string) => `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}.`;

/** Keyrir lesverkfæri og skilar JSON-streng fyrir líkanið. */
export async function runReadTool(name: string, input: In): Promise<string> {
  try {
    if (name === "labor_summary" || name === "staff_hours" || name === "shifts") {
      if (!okDate(input.from) || !okDate(input.to)) return JSON.stringify({ error: "from/to verða að vera YYYY-MM-DD" });
      const from = str(input.from), to = str(input.to);
      if (name === "labor_summary") {
        const d = await getDashboardPeriod(from, to);
        const { series: _s, ...rest } = d; void _s;
        return JSON.stringify(rest);
      }
      if (name === "staff_hours") return JSON.stringify((await fetchAttendance(from, to)).rows.map(({ c: _c, av: _a, ...r }) => r));
      const res = await getShiftsInRange(from, to);
      return JSON.stringify(res.rows.slice(0, 400));
    }
    if (name === "week_planning_context") {
      if (!okDate(input.monday)) return JSON.stringify({ error: "monday verður að vera YYYY-MM-DD" });
      const mon = str(input.monday), dates = weekDates(mon);
      if (new Date(`${mon}T12:00:00`).getDay() !== 1) return JSON.stringify({ error: `${mon} er ekki mánudagur` });
      const supabase = await createClient();
      const [{ employees }, shifts, wk, budget, types, leave, co] = await Promise.all([
        getEmployees(), getShiftsInRange(dates[0], dates[6]), getWeekShifts(mon), getWeekBudget(mon),
        supabase.from("shift_types").select("name, start_time, end_time, premium_pct"),
        supabase.from("leave_requests").select("from_date, to_date, type, employees(full_name)").eq("status", "approved").lte("from_date", dates[6]).gte("to_date", dates[0]),
        supabase.from("companies").select("staffing_targets").limit(1).maybeSingle(),
      ]);
      const first = (n: string) => n.split(/\s+/)[0];
      const staff = employees.filter((e) => e.status !== "inactive" && (e as { role?: string }).role !== "contractor");
      // Fornöfn verða að vera einkvæm — annars getur plan_week ekki vitað hver er hver.
      const seen = new Map<string, number>(); for (const e of staff) seen.set(first(e.fullName), (seen.get(first(e.fullName)) ?? 0) + 1);
      const unavail: Record<string, string[]> = {};
      for (const [k, days] of Object.entries((wk as { unavail?: Record<string, number[]> }).unavail ?? {})) unavail[k] = days.map((d) => dates[d]).filter(Boolean);
      return JSON.stringify({
        week: { monday: dates[0], sunday: dates[6], dates },
        staff: staff.map((e) => ({ name: first(e.fullName), fullName: e.fullName, dept: e.department, pay: e.payType === "monthly" ? "föst laun" : "tímakaup", ratioPct: e.employmentRatio, ...(seen.get(first(e.fullName))! > 1 ? { warning: "Fleiri en einn með þetta fornafn — notaðu fullt nafn í employee" } : {}) })),
        currentShifts: shifts.rows.map((r) => ({ employee: r.first, date: r.date, start: r.start, end: r.end, type: r.type ?? null })),
        unavailable: unavail,
        approvedLeave: ((leave.data ?? []) as unknown as { from_date: string; to_date: string; type: string; employees: { full_name?: string } | { full_name?: string }[] | null }[]).map((l) => ({ employee: first((Array.isArray(l.employees) ? l.employees[0] : l.employees)?.full_name ?? ""), from: l.from_date, to: l.to_date, type: l.type })),
        shiftTypes: (types.data ?? []).map((t) => ({ name: t.name, start: String(t.start_time ?? "").slice(0, 5), end: String(t.end_time ?? "").slice(0, 5), premiumPct: t.premium_pct })),
        staffingTargetsMonToSun: (co.data?.staffing_targets as number[] | null) ?? null,
        budget: budget ? { revenueForecast: budget.revenue, revenueSource: budget.revenueSource, laborTargetPct: budget.target, fixedSalaryCostKr: budget.fixed, avgCostPerHourKr: Math.round(budget.avgRate) } : null,
      });
    }
    if (name === "who_is_on_now") {
      const w = await getWhoIsOn();
      return JSON.stringify({
        onShift: w.rows.map((r) => ({ name: r.name, dept: r.dept, since: r.in, unscheduled: !!r.unscheduled })),
        notArrived: w.missing.map((m) => ({ name: m.name, dept: m.dept, plannedStart: m.start, late: m.late, minutes: m.mins })),
      });
    }
    if (name === "pending_requests") {
      const r = await getPendingRequests();
      return JSON.stringify(r.items.filter((i) => i.id).map((i) => ({ id: i.id, kind: i.kind, title: i.title, detail: i.detail, hints: i.hints?.map((h) => h.text) })));
    }
    return JSON.stringify({ error: "Óþekkt verkfæri" });
  } catch (e) {
    console.error("[assistant tool]", name, e);
    return JSON.stringify({ error: "Tókst ekki að sækja gögnin" });
  }
}

/** Ein staðfestingartillaga sem UI sýnir með „Staðfesta"-hnappi. */
export type PendingAction = { tool: string; input: In; summary: string };

/** Sannreynir inntak skrifverkfæris og býr til lýsingu fyrir notandann (ekkert framkvæmt). */
export function describeWrite(name: string, input: In, lang: string): { ok: true; summary: string } | { ok: false; error: string } {
  const en = lang === "en";
  const who = str(input.employee);
  switch (name) {
    case "plan_week": {
      const p = parseWeekPlan(input);
      if (!p.ok) return p;
      const people = new Set(p.shifts.map((x) => x.employee.toLowerCase())).size;
      const hours = p.shifts.reduce((a, x) => { let h = (Number(x.end.slice(0, 2)) * 60 + Number(x.end.slice(3))) - (Number(x.start.slice(0, 2)) * 60 + Number(x.start.slice(3))); if (h <= 0) h += 1440; return a + h / 60; }, 0);
      const lbl = str(input.label);
      return { ok: true, summary: en
        ? `Publish week plan ${shortDate(p.dates[0])}–${shortDate(p.dates[6])}: ${p.shifts.length} shifts for ${people} people, ${Math.round(hours)} hrs. Replaces all shifts that week and notifies staff.${lbl ? ` ${lbl}` : ""}`
        : `Birta vaktaplan ${shortDate(p.dates[0])}–${shortDate(p.dates[6])}: ${p.shifts.length} vaktir hjá ${people} starfsmönnum, ${Math.round(hours)} klst. Kemur í stað allra vakta vikunnar og starfsfólk fær tilkynningu.${lbl ? ` ${lbl}` : ""}` };
    }
    case "set_shift":
      if (!who || !okDate(input.date) || !okTime(input.start) || !okTime(input.end)) return { ok: false, error: "Vantar starfsmann, dagsetningu eða tíma (HH:MM)" };
      return { ok: true, summary: en ? `Set ${who}'s shift on ${input.date}: ${input.start}–${input.end}${str(input.shiftType) ? ` (${input.shiftType})` : ""}` : `Setja vakt hjá ${who} ${input.date}: ${input.start}–${input.end}${str(input.shiftType) ? ` (${input.shiftType})` : ""}` };
    case "remove_shift":
      if (!who || !okDate(input.date)) return { ok: false, error: "Vantar starfsmann eða dagsetningu" };
      return { ok: true, summary: en ? `Remove ${who}'s shift on ${input.date}` : `Eyða vakt hjá ${who} ${input.date}` };
    case "decide_leave":
      if (!str(input.id) || typeof input.approve !== "boolean") return { ok: false, error: "Vantar id eða ákvörðun" };
      return { ok: true, summary: `${input.approve ? (en ? "Approve" : "Samþykkja") : (en ? "Reject" : "Hafna")}: ${str(input.label) || str(input.id)}` };
    case "approve_swap":
      if (!str(input.id)) return { ok: false, error: "Vantar id" };
      return { ok: true, summary: `${en ? "Approve shift swap" : "Samþykkja vaktaskipti"}: ${str(input.label) || str(input.id)}` };
    case "clock_out":
      if (!who || !okTime(input.time)) return { ok: false, error: "Vantar starfsmann eða tíma" };
      return { ok: true, summary: en ? `Clock out ${who} at ${input.time}` : `Stimpla ${who} út kl. ${input.time}` };
  }
  return { ok: false, error: "Óþekkt aðgerð" };
}

/** Framkvæmir staðfesta aðgerð (kallað úr /api/assistant/execute eftir hlutverkaathugun). */
export async function executeWrite(name: string, input: In): Promise<{ ok: boolean; error?: string }> {
  switch (name) {
    case "plan_week": {
      const p = parseWeekPlan(input);
      if (!p.ok) return p;
      // Öll nöfn verða að finnast ÁÐUR en nokkru er eytt (publishSchedule sleppir óþekktum nöfnum hljóðlaust).
      const { employees } = await getEmployees();
      const names = employees.map((e) => e.fullName.toLowerCase());
      const unknown = [...new Set(p.shifts.map((x) => x.employee))].filter((n) => !names.some((f) => f.startsWith(n.toLowerCase())));
      if (unknown.length) return { ok: false, error: `Starfsmaður fannst ekki: ${unknown.join(", ")}` };
      const cleared = await deleteWeekShifts(p.dates);
      if (!cleared.ok) return { ok: false, error: "Tókst ekki að hreinsa vikuna" };
      const res = await publishSchedule(p.shifts.map((x) => ({ employeeName: x.employee, date: x.date, startTime: x.start, endTime: x.end, shiftTypeName: x.shiftType || "Dagvakt" })));
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Tókst ekki að birta planið" };
    }
    case "set_shift":
      return saveShift({ employeeName: str(input.employee), date: str(input.date), startTime: str(input.start), endTime: str(input.end), shiftTypeName: str(input.shiftType) });
    case "remove_shift":
      return deleteShift({ employeeName: str(input.employee), dateISO: str(input.date) });
    case "decide_leave":
      return updateLeaveRequest(str(input.id), input.approve === true);
    case "approve_swap":
      return approveShiftSwap(str(input.id));
    case "clock_out":
      return setClockOut({ employeeName: str(input.employee), time: str(input.time) });
  }
  return { ok: false, error: "Óþekkt aðgerð" };
}
