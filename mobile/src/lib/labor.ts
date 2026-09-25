// Laun % af veltu í appinu — sömu reglur og á vefnum (src/lib/labor.ts).
// Haldið viljandi eins svo sama fyrirtæki fái aldrei tvær ólíkar tölur.
//
//   kostnaður = tímakaupsfólk: launin úr stimplunum (classifyPay → grunnur +
//               álag/yfirvinna) × (1 + BURDEN); mánaðarlaunafólk: laun ×
//               (1 + BURDEN), hlutfallað eftir dagafjölda tímabilsins.
//               Óvirkir starfsmenn kosta ekkert.
//   velta     = veltulínur staðanna á tímabilinu; dagar án línu eru fylltir
//               úr companies.weekday_revenue og merktir sem áætlun.
//   hlutfall  = kostnaður / velta × 100 — eða null ef annað hvort er 0.
import { supabase } from "./supabase";
import { computeLine, classifyPay, BURDEN } from "./payroll";
import { resolveRuleSet, type CustomRules } from "./payrules";

export type RevenueSource = "manual" | "api" | "inventra" | "estimated" | "mixed" | "none";

export type LaborPeriod = {
  pct: number | null;
  revenue: number;
  cost: number;
  revenueSource: RevenueSource;
  hours: number;
  planned: number;
  overtime: number;      // klst yfir þröskuldi
  premium: number;       // klst á álagstíma
  plannedCost: number;
  overtimePay: number;
  premiumPay: number;
  levies: number;        // launatengd gjöld innifalin í cost
  coveredDays: number;
  days: number;
};

export const DEFAULT_LABOR_TARGET = 30;

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const r1 = (n: number) => Math.round(n * 10) / 10;

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

/** Hlutur mánaðarlauna sem fellur inn í dagana — heill mánuður = 1×. */
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
  id: string; payType: "hourly" | "monthly"; rate: number; employmentRatio: number;
  status: string; rules: CustomRules; fullName: string;
};

/** Sömu fyrirspurnir og vefurinn, en yfir marga daga í einu og skipt á tímabil. */
export async function getLaborPeriods(companyId: string, ranges: { from: string; to: string }[]): Promise<LaborPeriod[]> {
  if (!ranges.length) return [];
  const spanFrom = ranges.reduce((a, r) => (r.from < a ? r.from : a), ranges[0].from);
  const spanTo = ranges.reduce((a, r) => (r.to > a ? r.to : a), ranges[0].to);

  const [empRes, ruleRes, shiftRes, punchRes, locRes, compRes] = await Promise.all([
    supabase.from("employees")
      .select("id, full_name, pay_type, rate, employment_ratio, union_agreement, status")
      .eq("company_id", companyId),
    supabase.from("employees").select("id, pay_rule").eq("company_id", companyId),
    supabase.from("shifts").select("employee_id, date, start_time, end_time")
      .eq("company_id", companyId).gte("date", spanFrom).lte("date", spanTo),
    supabase.from("punches").select("employee_id, clock_in, clock_out")
      .eq("company_id", companyId).gte("clock_in", spanFrom).lte("clock_in", `${spanTo}T23:59:59`),
    supabase.from("locations").select("id").eq("company_id", companyId),
    supabase.from("companies").select("weekday_revenue").eq("id", companyId).maybeSingle(),
  ]);

  const ruleMap = new Map<string, unknown>();
  if (!ruleRes.error) for (const r of (ruleRes.data ?? []) as { id: string; pay_rule: unknown }[]) ruleMap.set(r.id, r.pay_rule ?? null);

  const employees: EmpRow[] = ((empRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    fullName: (r.full_name as string) ?? "",
    payType: ((r.pay_type as string) === "monthly" ? "monthly" : "hourly"),
    rate: Number(r.rate) || 0,
    employmentRatio: Number(r.employment_ratio) || 100,
    status: (r.status as string) ?? "active",
    rules: resolveRuleSet((r.union_agreement as string) ?? null, ruleMap.get(r.id as string) as never),
  }));

  const locIds = ((locRes.data ?? []) as { id: string }[]).map((l) => l.id);
  const revRows = locIds.length
    ? (await supabase.from("revenue").select("amount, source, date").in("location_id", locIds).gte("date", spanFrom).lte("date", spanTo)).data ?? []
    : [];
  const weekdayRev = ((compRes.data as { weekday_revenue?: Record<string, number> | null } | null)?.weekday_revenue) ?? null;

  // Kostnaður á klst (tímakaup) og fullur mánaðarkostnaður.
  const eff = new Map<string, number>();
  const monthlyCost = new Map<string, number>();
  for (const e of employees) {
    const l = computeLine({ id: e.id, fullName: e.fullName, payType: e.payType, rate: e.rate, employmentRatio: e.employmentRatio });
    eff.set(e.id, l.hours > 0 ? l.cost / l.hours : 0);
    monthlyCost.set(e.id, l.cost);
  }

  const shifts = ((shiftRes.data ?? []) as Record<string, unknown>[]).map((s) => ({
    eid: s.employee_id as string, date: String(s.date).slice(0, 10),
    h: shiftHours(s.start_time as string, s.end_time as string),
  }));
  const punches = ((punchRes.data ?? []) as Record<string, unknown>[])
    .filter((p) => p.clock_out)
    .map((p) => {
      const ci = p.clock_in as string, co = p.clock_out as string;
      return { eid: p.employee_id as string, clockIn: ci, clockOut: co, date: isoOf(new Date(ci)), h: (new Date(co).getTime() - new Date(ci).getTime()) / 3600000 };
    })
    .filter((p) => p.h > 0);
  const revs = (revRows as Record<string, unknown>[]).map((r) => ({
    date: String(r.date).slice(0, 10), amount: Number(r.amount ?? 0), source: mapSource(r.source),
  }));

  return ranges.map(({ from, to }) => {
    const days = dateRange(from, to);
    const daySet = new Set(days);
    const monthShare = monthShareOf(days);

    const plannedMap = new Map<string, number>();
    for (const s of shifts) if (daySet.has(s.date)) plannedMap.set(s.eid, (plannedMap.get(s.eid) ?? 0) + s.h);

    const actualMap = new Map<string, number>();
    const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
    for (const p of punches) {
      if (!daySet.has(p.date)) continue;
      actualMap.set(p.eid, (actualMap.get(p.eid) ?? 0) + p.h);
      if (!byEmp.has(p.eid)) byEmp.set(p.eid, []);
      byEmp.get(p.eid)!.push({ clockIn: p.clockIn, clockOut: p.clockOut });
    }

    let planned = 0, actual = 0, overtime = 0, premium = 0, cost = 0, plannedCost = 0, overtimePay = 0, premiumPay = 0;
    for (const e of employees) {
      if (e.status === "inactive") continue;
      const pl = plannedMap.get(e.id) ?? 0, ac = actualMap.get(e.id) ?? 0;
      const cls = classifyPay(e.rate, e.payType === "hourly", byEmp.get(e.id) ?? [], e.rules);
      planned += pl; actual += ac; overtime += cls.overtime; premium += cls.premium;
      overtimePay += cls.overtimePay; premiumPay += cls.premiumPay;
      if (e.payType === "monthly") {
        const mine = (monthlyCost.get(e.id) ?? 0) * monthShare;
        cost += mine; plannedCost += mine;
      } else {
        cost += ac * (eff.get(e.id) ?? 0);
        plannedCost += pl * (eff.get(e.id) ?? 0);
      }
    }

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
      for (const d of days) if (!covered.has(d)) est += Number(weekdayRev[String(new Date(`${d}T00:00:00`).getDay())] ?? 0);
      if (est > 0) { revenue += est; revenueSource = revenueSource === "none" ? "estimated" : "mixed"; }
    }

    const costR = Math.round(cost), revenueR = Math.round(revenue);
    return {
      pct: revenueR > 0 && costR > 0 ? r1((costR / revenueR) * 100) : null,
      revenue: revenueR, cost: costR, revenueSource, hours: r1(actual),
      planned: r1(planned), overtime: r1(overtime), premium: r1(premium),
      plannedCost: Math.round(plannedCost), overtimePay: Math.round(overtimePay), premiumPay: Math.round(premiumPay),
      levies: Math.round(cost * (BURDEN / (1 + BURDEN))),
      coveredDays: covered.size, days: days.length,
    };
  });
}

export function laborColor(pct: number | null | undefined, target = DEFAULT_LABOR_TARGET): "good" | "warn" | "bad" | null {
  if (pct == null) return null;
  if (pct <= target) return "good";
  if (pct <= target + 5) return "warn";
  return "bad";
}
