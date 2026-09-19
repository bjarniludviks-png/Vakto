import "server-only";
// Laun % af veltu — THE signature metric, computed in exactly one place.
//
// Every screen that shows labor cost, revenue or laun% (dashboard, Innsýn,
// Frammistaða history, AI reports, schedule context) must go through
// getLaborPct / getLaborPeriod(s) below. Never re-derive the number elsewhere.
//
// Rules of the calculation (per company, per inclusive date range):
//   cost     = hourly staff: punch-based pay (classifyPay → base × premium/OT
//              rules) × (1 + BURDEN); monthly staff: salary × (1 + BURDEN),
//              prorated by calendar days of the range (a full month = 1×).
//              Inactive employees never cost anything.
//   revenue  = revenue rows for the company's locations in the range; days
//              WITHOUT a real row are gap-filled from companies.weekday_revenue
//              and flagged "estimated" (real rows always win per day).
//   pct      = cost / revenue × 100 — or NULL when either side is 0. Never a
//              placeholder number.

import type { createClient } from "@/lib/supabase/server";
import { computeLine, classifyPay, BURDEN } from "@/lib/payroll";
import { resolveRuleSet, type CustomRules } from "@/lib/payrules";
import { initials } from "@/lib/employees";

export type Db = Awaited<ReturnType<typeof createClient>>;

export type RevenueSource = "manual" | "api" | "inventra" | "estimated" | "mixed" | "none";

/** The public contract: one number (or null) + what it was made of. */
export type LaborPct = {
  pct: number | null;       // laun% (1 dp) — null when revenue or cost is 0
  revenue: number;          // kr, whole range (real + estimated days)
  cost: number;             // kr, employer cost incl. burden
  revenueSource: RevenueSource;
  hours: number;            // worked hours (closed punches) in the range
};

export type LaborColor = "good" | "warn" | "bad";

export type LaborStaffRow = {
  id: string; name: string; av: string; c: string; dept: string;
  planned: number; actual: number; deviation: number; over: boolean;
  cost: number; // this employee's share of `cost` (kr)
};
export type LaborDayPoint = { date: string; label: string; planned: number; actual: number };

/** Full breakdown for one range — everything the dashboard/insights need, all
 * derived from the same pass that produces `pct`. */
export type LaborPeriod = LaborPct & {
  planned: number;        // scheduled hours
  actual: number;         // = hours
  overtime: number;       // hours over the weekly/monthly threshold
  premium: number;        // hours inside a premium window
  plannedCost: number;    // kr the plan implies
  overtimePay: number;    // extra kr from overtime
  premiumPay: number;     // extra kr from premiums
  levies: number;         // launatengd gjöld share of cost
  coveredDays: number;    // days with a REAL revenue row
  days: number;           // calendar days in the range
  staff: LaborStaffRow[];
  series: LaborDayPoint[];
};

export const DEFAULT_LABOR_TARGET = 30;

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Inclusive ISO date list (capped at ~1 year). */
function dateRange(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const d = new Date(fy, fm - 1, fd), end = new Date(ty, tm - 1, td);
  while (d <= end && out.length < 370) { out.push(isoOf(d)); d.setDate(d.getDate() + 1); }
  return out;
}

function shiftHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h < 0) h += 24;
  return h;
}

/** Share of a monthly salary that falls inside `days` — 1/daysInMonth per day,
 * so a whole calendar month is exactly 1× and a week is ~0.23×. */
function monthShareOf(days: string[]): number {
  let s = 0;
  for (const d of days) {
    const [y, m] = d.split("-").map(Number);
    s += 1 / new Date(y, m, 0).getDate();
  }
  return s;
}

function mapSource(raw: unknown): "manual" | "api" | "inventra" {
  const s = String(raw ?? "manual").toLowerCase();
  return s === "inventra" ? "inventra" : s === "api" ? "api" : "manual";
}

type EmpRow = {
  id: string; fullName: string; payType: "hourly" | "monthly"; rate: number; employmentRatio: number;
  union: string | null; status: string; avatarColor: string; department: string | null; rules: CustomRules;
};

/** Resolve the signed-in user's company (users.company_id). */
export async function getCompanyId(supabase: Db): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  return (data?.company_id as string | undefined) ?? null;
}

/**
 * Labor breakdown for SEVERAL ranges of one company in one pass (one set of
 * queries over the whole span, then partitioned per range). Used by history
 * views; single-range callers use getLaborPeriod / getLaborPct.
 */
export async function getLaborPeriods(supabase: Db, companyId: string, ranges: { from: string; to: string }[]): Promise<LaborPeriod[]> {
  if (!ranges.length) return [];
  const spanFrom = ranges.reduce((a, r) => (r.from < a ? r.from : a), ranges[0].from);
  const spanTo = ranges.reduce((a, r) => (r.to > a ? r.to : a), ranges[0].to);

  const [empRes, ruleRes, shiftRes, punchRes, locRes, compRes] = await Promise.all([
    supabase.from("employees")
      .select("id, full_name, pay_type, rate, employment_ratio, union_agreement, status, avatar_color, departments(name)")
      .eq("company_id", companyId),
    supabase.from("employees").select("id, pay_rule").eq("company_id", companyId), // tolerant: null before migration 0013
    supabase.from("shifts").select("employee_id, date, start_time, end_time")
      .eq("company_id", companyId).gte("date", spanFrom).lte("date", spanTo),
    supabase.from("punches").select("employee_id, clock_in, clock_out")
      .eq("company_id", companyId).gte("clock_in", spanFrom).lte("clock_in", spanTo + "T23:59:59"),
    supabase.from("locations").select("id").eq("company_id", companyId),
    supabase.from("companies").select("weekday_revenue").eq("id", companyId).maybeSingle(),
  ]);

  const ruleMap = new Map<string, unknown>();
  if (!ruleRes.error) for (const r of ruleRes.data ?? []) ruleMap.set(r.id as string, (r.pay_rule as never) ?? null);

  const employees: EmpRow[] = (empRes.data ?? []).map((r) => {
    const dep = (Array.isArray(r.departments) ? r.departments[0] : r.departments) as { name?: string } | null;
    const union = (r.union_agreement as string | null) ?? null;
    return {
      id: r.id as string, fullName: r.full_name as string,
      payType: (r.pay_type as "hourly" | "monthly") ?? "hourly",
      rate: Number(r.rate) || 0, employmentRatio: Number(r.employment_ratio) || 100,
      union, status: (r.status as string) ?? "active",
      avatarColor: (r.avatar_color as string) ?? "#5b50e6", department: dep?.name ?? null,
      rules: resolveRuleSet(union, ruleMap.get(r.id as string) as never),
    };
  });

  const locIds = (locRes.data ?? []).map((l) => l.id as string);
  const revRows = locIds.length
    ? (await supabase.from("revenue").select("amount, source, date").in("location_id", locIds).gte("date", spanFrom).lte("date", spanTo)).data ?? []
    : [];
  const weekdayRev = (compRes.data?.weekday_revenue as Record<string, number> | null | undefined) ?? null;

  // Effective hourly employer cost + full monthly employer cost per employee.
  const eff = new Map<string, number>();
  const monthlyCost = new Map<string, number>();
  for (const e of employees) {
    const l = computeLine(e);
    eff.set(e.id, l.hours > 0 ? l.cost / l.hours : 0);
    monthlyCost.set(e.id, l.cost);
  }

  const shifts = (shiftRes.data ?? []).map((s) => ({ eid: s.employee_id as string, date: String(s.date).slice(0, 10), h: shiftHours(s.start_time as string, s.end_time as string) }));
  const punches = (punchRes.data ?? []).filter((p) => p.clock_out).map((p) => {
    const ci = p.clock_in as string, co = p.clock_out as string;
    return { eid: p.employee_id as string, clockIn: ci, clockOut: co, date: isoOf(new Date(ci)), h: (new Date(co).getTime() - new Date(ci).getTime()) / 3600000 };
  }).filter((p) => p.h > 0);
  const revs = revRows.map((r) => ({ date: String(r.date).slice(0, 10), amount: Number(r.amount ?? 0), source: mapSource(r.source) }));

  return ranges.map(({ from, to }) => {
    const days = dateRange(from, to);
    const daySet = new Set(days);
    const monthShare = monthShareOf(days);

    const plannedMap = new Map<string, number>(), dayPlanned = new Map<string, number>();
    for (const s of shifts) {
      if (!daySet.has(s.date)) continue;
      plannedMap.set(s.eid, (plannedMap.get(s.eid) ?? 0) + s.h);
      dayPlanned.set(s.date, (dayPlanned.get(s.date) ?? 0) + s.h);
    }
    const actualMap = new Map<string, number>(), dayActual = new Map<string, number>();
    const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
    for (const p of punches) {
      if (!daySet.has(p.date)) continue;
      actualMap.set(p.eid, (actualMap.get(p.eid) ?? 0) + p.h);
      dayActual.set(p.date, (dayActual.get(p.date) ?? 0) + p.h);
      if (!byEmp.has(p.eid)) byEmp.set(p.eid, []);
      byEmp.get(p.eid)!.push({ clockIn: p.clockIn, clockOut: p.clockOut });
    }

    let planned = 0, actual = 0, overtime = 0, premium = 0, cost = 0, plannedCost = 0, overtimePay = 0, premiumPay = 0;
    const staff: LaborStaffRow[] = [];
    for (const e of employees) {
      if (e.status === "inactive") continue;
      const pl = plannedMap.get(e.id) ?? 0, ac = actualMap.get(e.id) ?? 0;
      const cls = classifyPay(e.rate, e.payType === "hourly", byEmp.get(e.id) ?? [], e.rules);
      planned += pl; actual += ac; overtime += cls.overtime; premium += cls.premium;
      overtimePay += cls.overtimePay; premiumPay += cls.premiumPay;
      let mine = 0, minePlanned = 0;
      if (e.payType === "monthly") {
        mine = (monthlyCost.get(e.id) ?? 0) * monthShare; minePlanned = mine;
      } else {
        mine = ac * (eff.get(e.id) ?? 0); minePlanned = pl * (eff.get(e.id) ?? 0);
      }
      cost += mine; plannedCost += minePlanned;
      if (pl > 0 || ac > 0 || mine > 0) staff.push({
        id: e.id, name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—",
        planned: r1(pl), actual: r1(ac), deviation: r1(ac - pl), over: ac > pl + 0.05, cost: Math.round(mine),
      });
    }
    staff.sort((a, b) => b.deviation - a.deviation);

    // Revenue: real rows per day, then weekday-average gap fill (flagged).
    let revenue = 0;
    const covered = new Set<string>();
    const srcs = new Set<"manual" | "api" | "inventra">();
    for (const r of revs) {
      if (!daySet.has(r.date)) continue;
      revenue += r.amount; covered.add(r.date); srcs.add(r.source);
    }
    let revenueSource: RevenueSource = srcs.size === 0 ? "none" : srcs.size > 1 ? "mixed" : [...srcs][0];
    if (weekdayRev && covered.size < days.length) {
      let est = 0;
      for (const d of days) if (!covered.has(d)) est += Number(weekdayRev[String(new Date(d + "T00:00:00").getDay())] ?? 0);
      if (est > 0) { revenue += est; revenueSource = revenueSource === "none" ? "estimated" : "mixed"; }
    }

    const series: LaborDayPoint[] = days.map((d) => {
      const [, mo, da] = d.split("-");
      return { date: d, label: `${Number(da)}.${Number(mo)}`, planned: r1(dayPlanned.get(d) ?? 0), actual: r1(dayActual.get(d) ?? 0) };
    });

    const costR = Math.round(cost), revenueR = Math.round(revenue);
    return {
      pct: revenueR > 0 && costR > 0 ? r1((costR / revenueR) * 100) : null,
      revenue: revenueR, cost: costR, revenueSource, hours: r1(actual),
      planned: r1(planned), actual: r1(actual), overtime: r1(overtime), premium: r1(premium),
      plannedCost: Math.round(plannedCost), overtimePay: Math.round(overtimePay), premiumPay: Math.round(premiumPay),
      levies: Math.round(cost * (BURDEN / (1 + BURDEN))),
      coveredDays: covered.size, days: days.length, staff, series,
    };
  });
}

/** Full breakdown for one inclusive date range. */
export async function getLaborPeriod(supabase: Db, companyId: string, fromISO: string, toISO: string): Promise<LaborPeriod> {
  const [p] = await getLaborPeriods(supabase, companyId, [{ from: fromISO, to: toISO }]);
  return p;
}

/**
 * THE single source of truth for laun % af veltu.
 * pct is null — never a placeholder — when revenue or cost is 0.
 */
export async function getLaborPct(supabase: Db, companyId: string, fromISO: string, toISO: string): Promise<LaborPct> {
  const p = await getLaborPeriod(supabase, companyId, fromISO, toISO);
  return { pct: p.pct, revenue: p.revenue, cost: p.cost, revenueSource: p.revenueSource, hours: p.hours };
}

/** Traffic light: green at/below target, yellow up to target+3, red above. */
export function laborColor(pct: number | null | undefined, target = DEFAULT_LABOR_TARGET): LaborColor | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return pct <= target ? "good" : pct <= target + 3 ? "warn" : "bad";
}

/** companies.labor_target (migration 0045) — falls back to 30 when the column
 * is missing, null or nonsense. */
export async function getLaborTarget(supabase: Db, companyId: string): Promise<number> {
  try {
    const { data, error } = await supabase.from("companies").select("labor_target").eq("id", companyId).maybeSingle();
    if (error) return DEFAULT_LABOR_TARGET;
    const n = Number(data?.labor_target);
    return Number.isFinite(n) && n > 0 && n < 100 ? n : DEFAULT_LABOR_TARGET;
  } catch {
    return DEFAULT_LABOR_TARGET;
  }
}
