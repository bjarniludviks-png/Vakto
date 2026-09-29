import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getLaborMetrics } from "@/lib/revenue.server";
import { getEmployees } from "@/lib/employees.server";
import { computeLine, totals as sumTotals } from "@/lib/payroll";
import { nf, dec1 } from "@/lib/format";

/** „Fyrstu skrefin“ — hvert skref er hakað sjálfkrafa út frá raungögnum fyrirtækisins. */
export type Onboarding = {
  show: boolean;
  hasCompanyInfo: boolean;  // kennitala + heimilisfang (þarf í ráðningarsamninga)
  hasLocation: boolean;
  hasStaff: boolean;
  hasPayRules: boolean;     // allt virkt starfsfólk með kjarasamning/stéttarfélag
  hasSchedule: boolean;     // birt vaktaplan
  hasClockIn: boolean;      // einhver hefur stimplað sig (app, vefur eða stimpilklukka)
  hasRevenue: boolean;      // velta skráð (handvirkt, meðalvelta eða tenging)
};
export type DashboardView = {
  laborPct: number;
  laborCostWeek: string; // m kr (1 dp)
  hoursWeek: string;
  live: boolean;
  onboarding: Onboarding;
};

const WEEKS_PER_MONTH = 4.33;
const NO_ONBOARD: Onboarding = { show: false, hasCompanyInfo: true, hasLocation: true, hasStaff: true, hasPayRules: true, hasSchedule: true, hasClockIn: true, hasRevenue: true };
// Unconfigured/signed-out fallback — zeros, never placeholder figures.
const DEMO: DashboardView = { laborPct: 0, laborCostWeek: "0", hoursWeek: "0", live: false, onboarding: NO_ONBOARD };

/** Dashboard headline KPIs + new-company onboarding status.
 *  `scopeDepts` (a scoped manager's departments; empty = all) limits the labor
 *  cost/hours KPIs to those departments. laborPct stays company-wide (revenue
 *  is not split by department). */
export async function getDashboard(scopeDepts: string[] = []): Promise<DashboardView> {
  const metrics = await getLaborMetrics();
  const { employees: allEmployees, live } = await getEmployees();
  const employees = scopeDepts.length
    ? allEmployees.filter((e) => !!e.department && scopeDepts.includes(e.department))
    : allEmployees;
  if (!live) return { ...DEMO, laborPct: metrics.live ? (metrics.laborPct ?? 0) : DEMO.laborPct, live: metrics.live };

  // Signed-in company. Compute onboarding completion from real tables.
  let hasCompanyInfo = false, hasLocation = false, hasPayRules = false, hasSchedule = false, hasClockIn = false, hasRevenue = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (company) {
      const [compRes, { data: locs }, { count: shiftCount }, { count: punchCount }, unionRes] = await Promise.all([
        supabase.from("companies").select("kennitala, address, weekday_revenue").eq("id", company).maybeSingle(),
        supabase.from("locations").select("id").eq("company_id", company),
        supabase.from("shifts").select("id", { count: "exact", head: true }).eq("company_id", company).eq("published", true),
        supabase.from("punches").select("id", { count: "exact", head: true }).eq("company_id", company),
        supabase.from("employees").select("union_agreement, union_name, status").eq("company_id", company),
      ]);
      const c = compRes.data as { kennitala?: string | null; address?: string | null; weekday_revenue?: Record<string, number> | null } | null;
      hasCompanyInfo = !!(c?.kennitala?.trim() && c?.address?.trim());
      const locIds = (locs ?? []).map((l) => l.id as string);
      hasLocation = locIds.length > 0;
      hasSchedule = (shiftCount ?? 0) > 0;
      hasClockIn = (punchCount ?? 0) > 0;
      const active = (unionRes.data ?? []).filter((e) => e.status !== "inactive");
      hasPayRules = active.length > 0 && active.every((e) => !!((e.union_agreement as string | null)?.trim() || (e.union_name as string | null)?.trim()));
      const avg = Object.values(c?.weekday_revenue ?? {}).some((v) => Number(v) > 0);
      if (avg) hasRevenue = true;
      else if (locIds.length) {
        const { count: revCount } = await supabase.from("revenue").select("id", { count: "exact", head: true }).in("location_id", locIds);
        hasRevenue = (revCount ?? 0) > 0;
      }
    }
  } catch { /* keep defaults */ }

  const hasStaff = employees.length > 0;
  const flags = { hasCompanyInfo, hasLocation, hasStaff, hasPayRules, hasSchedule, hasClockIn, hasRevenue };
  const onboarding: Onboarding = { show: !Object.values(flags).every(Boolean), ...flags };

  if (!hasStaff) {
    return { laborPct: metrics.live ? (metrics.laborPct ?? 0) : 0, laborCostWeek: "0", hoursWeek: "0", live: true, onboarding };
  }

  const tot = sumTotals(employees.map((e) => computeLine(e)));
  return {
    laborPct: metrics.live ? (metrics.laborPct ?? 0) : 0,
    laborCostWeek: dec1(Math.round((tot.cost / WEEKS_PER_MONTH) / 100000) / 10),
    hoursWeek: nf(Math.round(tot.hours / WEEKS_PER_MONTH)),
    live: true,
    onboarding,
  };
}
