import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId, getLaborPeriods, type LaborPeriod, type Db } from "@/lib/labor";
import { BURDEN } from "@/lib/payroll";

// VAKTO AI — samanburður og saga (sama hugmynd og sales_report í INVENTRA AI).
// Allar tölur koma úr sama útreikningi og mælaborðið (lib/labor) eða úr vistuðum launakeyrslum.

export type CompareMode = "fyrra" | "manudur" | "ar" | "sersnid";
const MS = 864e5;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Færir dagsetningu um n mánuði; dagur 31 → síðasti dagur styttri mánaðar. */
function shiftMonths(d: string, n: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last)));
}

/** Samanburðartímabil fyrir from–to (báðir dagar meðtaldir). */
export function comparePeriod(from: string, to: string, mode: CompareMode, custom?: { from?: string; to?: string }): { from: string; to: string } | null {
  if (mode === "sersnid") {
    if (!custom?.from || !custom?.to || !ISO.test(custom.from) || !ISO.test(custom.to)) return null;
    return custom.from <= custom.to ? { from: custom.from, to: custom.to } : { from: custom.to, to: custom.from };
  }
  if (mode === "manudur") return { from: shiftMonths(from, -1), to: shiftMonths(to, -1) };
  if (mode === "ar") return { from: shiftMonths(from, -12), to: shiftMonths(to, -12) };
  const days = Math.round((utc(to) - utc(from)) / MS) + 1;
  return { from: iso(utc(from) - days * MS), to: iso(utc(from) - MS) };
}

/** Útreikningurinn í lib/labor nær yfir mest ~1 ár í einni umferð; lengri bil eru reiknuð hvert fyrir sig. */
async function periods(supabase: Db, company: string, ranges: { from: string; to: string }[]): Promise<LaborPeriod[]> {
  const a = ranges.reduce((x, r) => (r.from < x ? r.from : x), ranges[0].from);
  const b = ranges.reduce((x, r) => (r.to > x ? r.to : x), ranges[0].to);
  if ((utc(b) - utc(a)) / MS <= 365) return getLaborPeriods(supabase, company, ranges);
  return (await Promise.all(ranges.map((r) => getLaborPeriods(supabase, company, [r])))).map((x) => x[0]);
}

function summary(p: LaborPeriod) {
  return {
    revenue: p.revenue, revenueSource: p.revenueSource, daysWithRealRevenue: p.coveredDays, days: p.days,
    laborCost: p.cost, laborPct: p.pct,
    hoursWorked: r1(p.actual), hoursPlanned: r1(p.planned), overtimeHours: r1(p.overtime), premiumHours: r1(p.premium),
    overtimePay: p.overtimePay, premiumPay: p.premiumPay, levies: p.levies,
    costPerHour: p.actual > 0 ? Math.round(p.cost / p.actual) : 0,
    staffWorked: p.staff.filter((s) => s.actual > 0).length,
  };
}
type Sum = ReturnType<typeof summary>;
const NUM: (keyof Sum)[] = ["revenue", "laborCost", "hoursWorked", "hoursPlanned", "overtimeHours", "premiumHours", "overtimePay", "premiumPay", "costPerHour", "staffWorked"];
function change(a: Sum, b: Sum) {
  const out: Record<string, { diff: number; pct: number | null }> = {};
  for (const k of NUM) {
    const x = a[k] as number, y = b[k] as number;
    out[k] = { diff: r1(x - y), pct: y ? r1(((x - y) / y) * 100) : null };
  }
  out.laborPctPoints = { diff: a.laborPct != null && b.laborPct != null ? r1(a.laborPct - b.laborPct) : 0, pct: null };
  return out;
}

async function ctx() {
  const supabase = await createClient();
  const company = await getCompanyId(supabase);
  return { supabase, company };
}

export async function comparePeriods(from: string, to: string, mode: CompareMode, custom?: { from?: string; to?: string }) {
  const cmp = comparePeriod(from, to, mode, custom);
  if (!cmp) return { error: "Samanburðartímabil vantar (compareFrom/compareTo, YYYY-MM-DD)" };
  const { supabase, company } = await ctx();
  if (!company) return { error: "Ekkert fyrirtæki" };
  const [a, b] = await periods(supabase, company, [{ from, to }, cmp]);
  const sa = summary(a), sb = summary(b);

  const dept = new Map<string, { hoursA: number; hoursB: number; costA: number; costB: number }>();
  const emp = new Map<string, { name: string; dept: string; hoursA: number; hoursB: number; costA: number; costB: number }>();
  for (const [p, side] of [[a, "A"], [b, "B"]] as const) {
    for (const s of p.staff) {
      const d = dept.get(s.dept || "—") ?? { hoursA: 0, hoursB: 0, costA: 0, costB: 0 };
      d[`hours${side}`] += s.actual; d[`cost${side}`] += s.cost; dept.set(s.dept || "—", d);
      const e = emp.get(s.id) ?? { name: s.name, dept: s.dept, hoursA: 0, hoursB: 0, costA: 0, costB: 0 };
      e[`hours${side}`] += s.actual; e[`cost${side}`] += s.cost; emp.set(s.id, e);
    }
  }
  const round = <T extends { hoursA: number; hoursB: number; costA: number; costB: number }>(x: T) =>
    ({ ...x, hoursA: r1(x.hoursA), hoursB: r1(x.hoursB), costA: Math.round(x.costA), costB: Math.round(x.costB), costDiff: Math.round(x.costA - x.costB) });
  const employees = [...emp.values()].filter((e) => e.hoursA || e.hoursB).map(round)
    .sort((x, y) => Math.abs(y.costDiff) - Math.abs(x.costDiff));
  return {
    period: { from, to }, comparedWith: cmp,
    note: "A = period, B = comparedWith. laborCost er kostnaður launagreiðanda með launatengdum gjöldum (áætlað út frá tímum, sama og mælaborðið).",
    period_A: sa, comparedWith_B: sb, change: change(sa, sb),
    byDepartment: [...dept.entries()].map(([name, d]) => ({ name, ...round(d) })).sort((x, y) => y.costA - x.costA),
    byEmployee: employees.slice(0, 40), employeesOmitted: Math.max(0, employees.length - 40),
  };
}

/** Bil á mánuði, viku (mán–sun) eða degi, klippt við from/to. */
function buckets(from: string, to: string, by: "month" | "week" | "day"): { from: string; to: string; label: string }[] {
  const out: { from: string; to: string; label: string }[] = [];
  let cur = from;
  while (cur <= to && out.length <= 24) {
    let end: string;
    const d = new Date(utc(cur));
    if (by === "day") end = cur;
    else if (by === "week") end = iso(utc(cur) + ((7 - d.getUTCDay()) % 7) * MS);
    else end = iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    if (end > to) end = to;
    const label = by === "month" ? cur.slice(0, 7) : by === "week" ? `vika frá ${cur}` : cur;
    out.push({ from: cur, to: end, label });
    cur = iso(utc(end) + MS);
  }
  return out;
}

export async function laborTrend(from: string, to: string, by: "month" | "week" | "day") {
  if (from > to) return { error: "from er á eftir to" };
  const ranges = buckets(from, to, by);
  if (ranges.length > 24) return { error: "Of mörg bil (mest 24) — veldu styttra tímabil eða grófari skiptingu" };
  const { supabase, company } = await ctx();
  if (!company) return { error: "Ekkert fyrirtæki" };
  const ps = await periods(supabase, company, ranges);
  const rows = ps.map((p, i) => ({ label: ranges[i].label, from: ranges[i].from, to: ranges[i].to, ...summary(p) }));
  const withCost = rows.filter((r) => r.laborCost > 0);
  return {
    by, rows,
    totals: { revenue: rows.reduce((s, r) => s + r.revenue, 0), laborCost: rows.reduce((s, r) => s + r.laborCost, 0), hoursWorked: r1(rows.reduce((s, r) => s + r.hoursWorked, 0)) },
    highestCost: withCost.length ? withCost.reduce((x, y) => (y.laborCost > x.laborCost ? y : x)).label : null,
    lowestCost: withCost.length ? withCost.reduce((x, y) => (y.laborCost < x.laborCost ? y : x)).label : null,
  };
}

const n = (v: unknown) => Number(v) || 0;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export async function payrollRuns(from: string, to: string, employee?: string) {
  const { supabase, company } = await ctx();
  if (!company) return { error: "Ekkert fyrirtæki" };
  const { data: runs } = await supabase.from("payroll_runs").select("id, period_start, period_end, status, created_at")
    .eq("company_id", company).lte("period_start", to).gte("period_end", from).order("period_start");
  if (!runs?.length) return { runs: [], note: "Engar launakeyrslur á þessu bili. labor_summary/compare_periods sýna áætlaðan launakostnað út frá tímum." };
  const { data: lines } = await supabase.from("payroll_lines").select("*, employees(full_name)").in("run_id", runs.map((r) => r.id as string));
  const want = employee ? norm(employee) : "";
  const who = (l: Record<string, unknown>) => {
    const e = l.employees as { full_name?: string } | { full_name?: string }[] | null;
    return (Array.isArray(e) ? e[0] : e)?.full_name ?? "";
  };
  // Keyrslur fyrir 0081 geymdu ekki kostnað launagreiðanda — þá gróft hlutfall (merkt estimated).
  const costOf = (l: Record<string, unknown>) => (l.cost != null ? n(l.cost) : n(l.gross) * (1 + BURDEN));
  const out = runs.map((r) => {
    const ls = (lines ?? []).filter((l) => l.run_id === r.id) as Record<string, unknown>[];
    const mine = want ? ls.filter((l) => norm(who(l)).includes(want)) : ls;
    const sum = (k: string) => Math.round(mine.reduce((s, l) => s + n(l[k]), 0));
    return {
      period: { from: r.period_start, to: r.period_end }, status: r.status, employees: mine.length,
      hours: r1(mine.reduce((s, l) => s + n(l.hours), 0)),
      gross: sum("gross"), net: sum("net"), withholding: sum("withholding"),
      pension: sum("pension") + sum("extra_pension"), unionFee: sum("union_fee"),
      orlof: sum("orlof") + sum("orlof_accrued"), insurance: sum("insurance"),
      employerCost: Math.round(mine.reduce((s, l) => s + costOf(l), 0)),
      costEstimated: mine.some((l) => l.cost == null),
      ...(want ? { lines: mine.map((l) => ({ name: who(l), hours: r1(n(l.hours)), gross: Math.round(n(l.gross)), net: Math.round(n(l.net)), overtime: Math.round(n(l.overtime)), premiums: Math.round(n(l.premiums)) })) } : {}),
    };
  }).filter((r) => !want || r.employees > 0);
  if (want && !out.length) return { error: `Fann engan starfsmann sem passar við „${employee}“ í launakeyrslum á bilinu` };
  return {
    runs: out,
    totals: { gross: out.reduce((s, r) => s + r.gross, 0), net: out.reduce((s, r) => s + r.net, 0), employerCost: out.reduce((s, r) => s + r.employerCost, 0), hours: r1(out.reduce((s, r) => s + r.hours, 0)) },
  };
}
