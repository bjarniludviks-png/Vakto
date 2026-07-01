"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { computeLine, classifyPay, BURDEN } from "@/lib/payroll";
import { resolveRuleSet } from "@/lib/payrules";
import { initials } from "@/lib/employees";

export type SeriesPoint = { label: string; planned: number; actual: number };
export type StaffRow = { name: string; av: string; c: string; dept: string; planned: number; actual: number; deviation: number; over: boolean };
export type PeriodData = {
  ok: boolean;
  planned: number;
  actual: number;
  overtime: number;      // REAL overtime hours (over the weekly/monthly threshold)
  premium: number;       // álagstímar (evening/weekend/night/holiday/band hours)
  deviation: number;     // actual − planned (hours)
  cost: number;          // actual-based labor cost (kr, incl. burden)
  plannedCost: number;   // cost implied by the PLAN (kr)
  deviationCost: number; // cost − plannedCost (what the deviation costs, kr)
  overtimePay: number;   // extra kr from overtime
  premiumPay: number;    // extra kr from premiums (álag)
  laborPct: number;
  hasRevenue: boolean;
  revenue: number;         // total velta over the period (kr)
  revenueSource: "inventra" | "manual" | "mixed" | "none";
  levies: number;          // launatengd/opinber gjöld portion of cost (kr)
  costPerHour: number;     // avg employer cost per worked hour (kr)
  series: SeriesPoint[];
  staff: StaffRow[];
};

const EMPTY: PeriodData = { ok: false, planned: 0, actual: 0, overtime: 0, premium: 0, deviation: 0, cost: 0, plannedCost: 0, deviationCost: 0, overtimePay: 0, premiumPay: 0, laborPct: 0, hasRevenue: false, revenue: 0, revenueSource: "none", levies: 0, costPerHour: 0, series: [], staff: [] };

function shiftHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h < 0) h += 24;
  return h;
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Inclusive list of ISO dates from..to (capped for safety). */
function dateRange(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const d = new Date(fy, fm - 1, fd), end = new Date(ty, tm - 1, td);
  while (d <= end && out.length < 40) { out.push(isoOf(d)); d.setDate(d.getDate() + 1); }
  return out;
}

/** Headline figures (hours + labor cost + labor%) for an arbitrary date range. */
export async function getDashboardPeriod(fromISO: string, toISO: string): Promise<PeriodData> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const { employees, live } = await getEmployees();
    if (!live) return EMPTY;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (!company) return EMPTY;

    const [{ data: shifts }, { data: punches }, prRes] = await Promise.all([
      supabase.from("shifts").select("employee_id, date, start_time, end_time")
        .eq("company_id", company).gte("date", fromISO).lte("date", toISO),
      supabase.from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59"),
      supabase.from("employees").select("id, pay_rule").eq("company_id", company),
    ]);

    // Per-employee custom rules (tolerant — null before migration 0013).
    const ruleMap = new Map<string, unknown>();
    if (!prRes.error) for (const r of prRes.data ?? []) ruleMap.set(r.id as string, (r.pay_rule as never) ?? null);

    const plannedMap = new Map<string, number>();
    const dayPlanned = new Map<string, number>();
    for (const s of shifts ?? []) {
      const h = shiftHours(s.start_time as string, s.end_time as string);
      plannedMap.set(s.employee_id as string, (plannedMap.get(s.employee_id as string) ?? 0) + h);
      const d = s.date as string;
      dayPlanned.set(d, (dayPlanned.get(d) ?? 0) + h);
    }
    // Actual hours (per employee + per day) and punch groups for OT/premium calc.
    const actualMap = new Map<string, number>();
    const dayActual = new Map<string, number>();
    const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
    for (const p of punches ?? []) {
      if (!p.clock_out) continue;
      const ci = p.clock_in as string, co = p.clock_out as string;
      const h = (new Date(co).getTime() - new Date(ci).getTime()) / 3600000;
      if (h <= 0) continue;
      const eid = p.employee_id as string;
      actualMap.set(eid, (actualMap.get(eid) ?? 0) + h);
      const d = isoOf(new Date(ci));
      dayActual.set(d, (dayActual.get(d) ?? 0) + h);
      if (!byEmp.has(eid)) byEmp.set(eid, []);
      byEmp.get(eid)!.push({ clockIn: ci, clockOut: co });
    }
    // Effective hourly cost (incl. employer burden) per employee.
    const eff = new Map<string, number>();
    for (const e of employees) { const l = computeLine(e); eff.set(e.id, l.hours > 0 ? l.cost / l.hours : 0); }

    let planned = 0, actual = 0, overtime = 0, premium = 0, cost = 0, plannedCost = 0, overtimePay = 0, premiumPay = 0;
    const staff: StaffRow[] = [];
    for (const e of employees) {
      const pl = plannedMap.get(e.id) ?? 0, ac = actualMap.get(e.id) ?? 0;
      const rules = resolveRuleSet(e.union, ruleMap.get(e.id) as never);
      const cls = classifyPay(e.rate, e.payType === "hourly", byEmp.get(e.id) ?? [], rules);
      planned += pl; actual += ac; overtime += cls.overtime; premium += cls.premium;
      overtimePay += cls.overtimePay; premiumPay += cls.premiumPay;
      cost += ac * (eff.get(e.id) ?? 0);
      plannedCost += pl * (eff.get(e.id) ?? 0);
      if (pl > 0 || ac > 0) staff.push({
        name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—",
        planned: Math.round(pl * 10) / 10, actual: Math.round(ac * 10) / 10,
        deviation: Math.round((ac - pl) * 10) / 10, over: ac > pl + 0.05,
      });
    }
    // Over plan first (worst on top), then within plan.
    staff.sort((a, b) => b.deviation - a.deviation);

    // Per-day planned vs actual series (compact d.m labels).
    const days = dateRange(fromISO, toISO);
    const series: SeriesPoint[] = days.map((d) => {
      const [, mo, da] = d.split("-");
      return { label: `${Number(da)}.${Number(mo)}`, planned: Math.round((dayPlanned.get(d) ?? 0) * 10) / 10, actual: Math.round((dayActual.get(d) ?? 0) * 10) / 10 };
    });

    let revenue = 0;
    let revenueSource: PeriodData["revenueSource"] = "none";
    const { data: locs } = await supabase.from("locations").select("id").eq("company_id", company);
    const locIds = (locs ?? []).map((l) => l.id as string);
    if (locIds.length) {
      const { data: rev } = await supabase.from("revenue").select("amount, source")
        .in("location_id", locIds).gte("date", fromISO).lte("date", toISO);
      revenue = (rev ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
      const srcs = new Set((rev ?? []).map((r) => (String(r.source ?? "manual") === "inventra" ? "inventra" : "manual")));
      revenueSource = srcs.size === 0 ? "none" : srcs.size > 1 ? "mixed" : (srcs.has("inventra") ? "inventra" : "manual");
    }
    return {
      ok: true,
      planned: Math.round(planned * 10) / 10,
      actual: Math.round(actual * 10) / 10,
      overtime: Math.round(overtime * 10) / 10,
      premium: Math.round(premium * 10) / 10,
      deviation: Math.round((actual - planned) * 10) / 10,
      cost: Math.round(cost),
      plannedCost: Math.round(plannedCost),
      deviationCost: Math.round(cost - plannedCost),
      overtimePay: Math.round(overtimePay),
      premiumPay: Math.round(premiumPay),
      laborPct: revenue > 0 ? Math.round((cost / revenue) * 1000) / 10 : 0,
      hasRevenue: revenue > 0,
      revenue: Math.round(revenue),
      revenueSource,
      levies: Math.round(cost * (BURDEN / (1 + BURDEN))),
      costPerHour: actual > 0 ? Math.round(cost / actual) : 0,
      series,
      staff,
    };
  } catch {
    return EMPTY;
  }
}
