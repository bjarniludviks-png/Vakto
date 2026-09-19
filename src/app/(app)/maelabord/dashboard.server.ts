import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";
import { getCompanyId, getLaborPct, getLaborTarget, laborColor, DEFAULT_LABOR_TARGET, type LaborPct, type LaborColor } from "@/lib/labor";

export type Onboarding = { show: boolean; hasLocation: boolean; hasStaff: boolean; hasSchedule: boolean; hasRevenue: boolean };
export type HeroFigure = LaborPct & { from: string; to: string; color: LaborColor | null };
/** A punch still open after 12+ hours — almost always a forgotten clock-out. */
export type OpenPunchRow = { punchId: string; employeeId: string; name: string; av: string; c: string; dept: string; since: string; hours: number };
export type DashboardView = {
  configured: boolean; // Supabase keys present (dev-only card when false)
  live: boolean;       // signed in with a company
  target: number;      // laun% target (companies.labor_target, default 30)
  yesterday: HeroFigure | null;
  week: HeroFigure | null; // Monday → today
  openPunches: OpenPunchRow[];
  onboarding: Onboarding;
};

const NO_ONBOARD: Onboarding = { show: false, hasLocation: true, hasStaff: true, hasSchedule: true, hasRevenue: true };
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dashboard hero (laun% yesterday + this week), attention items and the
 * new-company onboarding status. No demo numbers: when there is nothing to
 * compute the figures are null and the UI says why. */
export async function getDashboard(): Promise<DashboardView> {
  const configured = isSupabaseConfigured();
  const base: DashboardView = { configured, live: false, target: DEFAULT_LABOR_TARGET, yesterday: null, week: null, openPunches: [], onboarding: NO_ONBOARD };
  if (!configured) return base;
  try {
    const supabase = await createClient();
    const company = await getCompanyId(supabase);
    if (!company) return base;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yday = new Date(today); yday.setDate(yday.getDate() - 1);
    const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const yISO = isoOf(yday), tISO = isoOf(today), mISO = isoOf(mon);
    const cutoff12h = new Date(Date.now() - 12 * 3600e3).toISOString();

    const [{ employees }, target, yesterday, week, locRes, shiftRes, openRes] = await Promise.all([
      getEmployees(),
      getLaborTarget(supabase, company),
      getLaborPct(supabase, company, yISO, yISO),
      getLaborPct(supabase, company, mISO, tISO),
      supabase.from("locations").select("id").eq("company_id", company),
      supabase.from("shifts").select("id", { count: "exact", head: true }).eq("company_id", company),
      supabase.from("punches").select("id, employee_id, clock_in")
        .eq("company_id", company).is("clock_out", null).lt("clock_in", cutoff12h)
        .order("clock_in", { ascending: true }).limit(20),
    ]);

    const locIds = (locRes.data ?? []).map((l) => l.id as string);
    let hasRevenue = false;
    if (locIds.length) {
      const { count } = await supabase.from("revenue").select("id", { count: "exact", head: true }).in("location_id", locIds);
      hasRevenue = (count ?? 0) > 0;
    }
    const hasLocation = locIds.length > 0;
    const hasSchedule = (shiftRes.count ?? 0) > 0;
    const hasStaff = employees.length > 0;
    const onboarding: Onboarding = { show: !(hasLocation && hasStaff && hasSchedule && hasRevenue), hasLocation, hasStaff, hasSchedule, hasRevenue };

    const meta = new Map(employees.map((e) => [e.id, { name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—" }]));
    const nowMs = Date.now();
    const openPunches: OpenPunchRow[] = (openRes.data ?? []).map((p) => {
      const m = meta.get(p.employee_id as string);
      return {
        punchId: p.id as string, employeeId: p.employee_id as string,
        name: m?.name ?? "?", av: m?.av ?? "?", c: m?.c ?? "#888", dept: m?.dept ?? "—",
        since: p.clock_in as string,
        hours: Math.round(((nowMs - new Date(p.clock_in as string).getTime()) / 3600000) * 10) / 10,
      };
    });

    return {
      configured, live: true, target,
      yesterday: { ...yesterday, from: yISO, to: yISO, color: laborColor(yesterday.pct, target) },
      week: { ...week, from: mISO, to: tISO, color: laborColor(week.pct, target) },
      openPunches, onboarding,
    };
  } catch {
    return base;
  }
}
