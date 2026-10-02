"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCompanyId, getLaborPeriod, getLaborPeriods, getLaborTarget, laborColor, DEFAULT_LABOR_TARGET, type RevenueSource, type LaborColor } from "@/lib/labor";

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
  laborPct: number | null; // null = not computable (no revenue or no cost) — never a placeholder
  laborColor: LaborColor | null; // traffic light vs the company target
  target: number;          // laun% target (companies.labor_target, default 30)
  hasRevenue: boolean;
  revenue: number;         // total velta over the period (kr)
  revenueSource: RevenueSource;
  levies: number;          // launatengd/opinber gjöld portion of cost (kr)
  costPerHour: number;     // avg employer cost per worked hour (kr)
  series: SeriesPoint[];
  staff: StaffRow[];
};

const EMPTY: PeriodData = { ok: false, planned: 0, actual: 0, overtime: 0, premium: 0, deviation: 0, cost: 0, plannedCost: 0, deviationCost: 0, overtimePay: 0, premiumPay: 0, laborPct: null, laborColor: null, target: DEFAULT_LABOR_TARGET, hasRevenue: false, revenue: 0, revenueSource: "none", levies: 0, costPerHour: 0, series: [], staff: [] };

/** Headline figures (hours + labor cost + laun%) for an arbitrary date range
 * of the signed-in company. Server Action used by the dashboard period
 * picker, the schedule AI context and Innsýn — all numbers come from the
 * single shared calculation in src/lib/labor.ts. */
export async function getDashboardPeriod(fromISO: string, toISO: string): Promise<PeriodData> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const supabase = await createClient();
    const company = await getCompanyId(supabase);
    if (!company) return EMPTY;
    const [p, target] = await Promise.all([getLaborPeriod(supabase, company, fromISO, toISO), getLaborTarget(supabase, company)]);
    return {
      ok: true,
      planned: p.planned,
      actual: p.actual,
      overtime: p.overtime,
      premium: p.premium,
      deviation: Math.round((p.actual - p.planned) * 10) / 10,
      cost: p.cost,
      plannedCost: p.plannedCost,
      deviationCost: p.cost - p.plannedCost,
      overtimePay: p.overtimePay,
      premiumPay: p.premiumPay,
      laborPct: p.pct,
      laborColor: laborColor(p.pct, target),
      target,
      hasRevenue: p.revenue > 0,
      revenue: p.revenue,
      revenueSource: p.revenueSource,
      levies: p.levies,
      costPerHour: p.actual > 0 ? Math.round(p.cost / p.actual) : 0,
      series: p.series.map((s) => ({ label: s.label, planned: s.planned, actual: s.actual })),
      staff: p.staff.map((s) => ({ name: s.name, av: s.av, c: s.c, dept: s.dept, planned: s.planned, actual: s.actual, deviation: s.deviation, over: s.over })),
    };
  } catch (e) {
    console.error("getDashboardPeriod failed:", e);
    return EMPTY;
  }
}

export type TrendPoint = { label: string; from: string; pct: number | null };

/** Laun % af veltu fyrir síðustu `weeks` vikur (mán–sun, núverandi vika til dagsins í dag),
 * reiknað í einni umferð með sama útreikningi og allt annað (lib/labor). */
export async function getLaborTrend(weeks = 8): Promise<{ ok: boolean; target: number; points: TrendPoint[] }> {
  if (!isSupabaseConfigured()) return { ok: false, target: DEFAULT_LABOR_TARGET, points: [] };
  try {
    const supabase = await createClient();
    const company = await getCompanyId(supabase);
    if (!company) return { ok: false, target: DEFAULT_LABOR_TARGET, points: [] };
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const ranges: { from: string; to: string; label: string }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const a = new Date(mon); a.setDate(a.getDate() - 7 * i);
      const b = new Date(a); b.setDate(b.getDate() + 6);
      const end = b > today ? today : b;
      ranges.push({ from: iso(a), to: iso(end), label: `${a.getDate()}.${a.getMonth() + 1}.` });
    }
    const [periods, target] = await Promise.all([getLaborPeriods(supabase, company, ranges), getLaborTarget(supabase, company)]);
    return { ok: true, target, points: periods.map((p, i) => ({ label: ranges[i].label, from: ranges[i].from, pct: p.pct })) };
  } catch (e) {
    console.error("getLaborTrend failed:", e);
    return { ok: false, target: DEFAULT_LABOR_TARGET, points: [] };
  }
}
