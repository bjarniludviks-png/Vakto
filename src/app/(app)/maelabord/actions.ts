"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { computeLine } from "@/lib/payroll";

export type PeriodData = {
  ok: boolean;
  planned: number;
  actual: number;
  overtime: number;
  deviation: number;
  costM: string; // m kr, 1 dp
  laborPct: number;
  hasRevenue: boolean;
};

const EMPTY: PeriodData = { ok: false, planned: 0, actual: 0, overtime: 0, deviation: 0, costM: "0", laborPct: 0, hasRevenue: false };

function shiftHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h < 0) h += 24;
  return h;
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

    const [{ data: shifts }, { data: punches }] = await Promise.all([
      supabase.from("shifts").select("employee_id, start_time, end_time")
        .eq("company_id", company).gte("date", fromISO).lte("date", toISO),
      supabase.from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59"),
    ]);

    const plannedMap = new Map<string, number>();
    for (const s of shifts ?? []) {
      const h = shiftHours(s.start_time as string, s.end_time as string);
      plannedMap.set(s.employee_id as string, (plannedMap.get(s.employee_id as string) ?? 0) + h);
    }
    const actualMap = new Map<string, number>();
    for (const p of punches ?? []) {
      if (!p.clock_out) continue;
      const h = (new Date(p.clock_out as string).getTime() - new Date(p.clock_in as string).getTime()) / 3600000;
      if (h > 0) actualMap.set(p.employee_id as string, (actualMap.get(p.employee_id as string) ?? 0) + h);
    }
    // Effective hourly cost (incl. employer burden) per employee.
    const eff = new Map<string, number>();
    for (const e of employees) { const l = computeLine(e); eff.set(e.id, l.hours > 0 ? l.cost / l.hours : 0); }

    let planned = 0, actual = 0, overtime = 0, cost = 0;
    for (const e of employees) {
      const pl = plannedMap.get(e.id) ?? 0, ac = actualMap.get(e.id) ?? 0;
      planned += pl; actual += ac; overtime += Math.max(0, ac - pl);
      cost += (ac > 0 ? ac : pl) * (eff.get(e.id) ?? 0);
    }

    let revenue = 0;
    const { data: locs } = await supabase.from("locations").select("id").eq("company_id", company);
    const locIds = (locs ?? []).map((l) => l.id as string);
    if (locIds.length) {
      const { data: rev } = await supabase.from("revenue").select("amount")
        .in("location_id", locIds).gte("date", fromISO).lte("date", toISO);
      revenue = (rev ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
    }
    const m = (n: number) => (Math.round(n / 100000) / 10).toFixed(1).replace(".", ",");
    return {
      ok: true,
      planned: Math.round(planned * 10) / 10,
      actual: Math.round(actual * 10) / 10,
      overtime: Math.round(overtime * 10) / 10,
      deviation: Math.round((actual - planned) * 10) / 10,
      costM: m(cost),
      laborPct: revenue > 0 ? Math.round((cost / revenue) * 1000) / 10 : 0,
      hasRevenue: revenue > 0,
    };
  } catch {
    return EMPTY;
  }
}
