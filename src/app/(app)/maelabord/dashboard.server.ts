import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getLaborMetrics } from "@/lib/revenue.server";
import { getEmployees } from "@/lib/employees.server";
import { computeLine, totals as sumTotals } from "@/lib/payroll";
import { nf, dec1 } from "@/lib/format";

export type Onboarding = { show: boolean; hasLocation: boolean; hasStaff: boolean; hasSchedule: boolean; hasRevenue: boolean };
export type DashboardView = {
  laborPct: number;
  laborCostWeek: string; // m kr (1 dp)
  hoursWeek: string;
  live: boolean;
  onboarding: Onboarding;
};

const WEEKS_PER_MONTH = 4.33;
const NO_ONBOARD: Onboarding = { show: false, hasLocation: true, hasStaff: true, hasSchedule: true, hasRevenue: true };
const DEMO: DashboardView = { laborPct: 32.1, laborCostWeek: "1,40", hoursWeek: "374", live: false, onboarding: NO_ONBOARD };

/** Dashboard headline KPIs + new-company onboarding status. */
export async function getDashboard(): Promise<DashboardView> {
  const metrics = await getLaborMetrics();
  const { employees, live } = await getEmployees();
  if (!live) return { ...DEMO, laborPct: metrics.live ? metrics.laborPct : DEMO.laborPct, live: metrics.live };

  // Signed-in company. Compute onboarding completion from real tables.
  let hasLocation = false, hasSchedule = false, hasRevenue = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (company) {
      const [{ count: locCount }, { count: shiftCount }, { data: locs }] = await Promise.all([
        supabase.from("locations").select("id", { count: "exact", head: true }).eq("company_id", company),
        supabase.from("shifts").select("id", { count: "exact", head: true }).eq("company_id", company),
        supabase.from("locations").select("id").eq("company_id", company),
      ]);
      hasLocation = (locCount ?? 0) > 0;
      hasSchedule = (shiftCount ?? 0) > 0;
      const locIds = (locs ?? []).map((l) => l.id as string);
      if (locIds.length) {
        const { count: revCount } = await supabase.from("revenue").select("id", { count: "exact", head: true }).in("location_id", locIds);
        hasRevenue = (revCount ?? 0) > 0;
      }
    }
  } catch { /* keep defaults */ }

  const hasStaff = employees.length > 0;
  const allDone = hasLocation && hasStaff && hasSchedule && hasRevenue;
  const onboarding: Onboarding = { show: !allDone, hasLocation, hasStaff, hasSchedule, hasRevenue };

  if (!hasStaff) {
    return { laborPct: metrics.live ? metrics.laborPct : 0, laborCostWeek: "0", hoursWeek: "0", live: true, onboarding };
  }

  const tot = sumTotals(employees.map((e) => computeLine(e)));
  return {
    laborPct: metrics.laborPct,
    laborCostWeek: dec1(Math.round((tot.cost / WEEKS_PER_MONTH) / 100000) / 10),
    hoursWeek: nf(Math.round(tot.hours / WEEKS_PER_MONTH)),
    live: true,
    onboarding,
  };
}
