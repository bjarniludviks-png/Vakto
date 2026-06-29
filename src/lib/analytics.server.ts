import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees, getCompanyData } from "@/lib/employees.server";
import { getLaborMetrics } from "@/lib/revenue.server";
import { computeLine, totals as sumTotals } from "@/lib/payroll";
import { initials } from "@/lib/employees";

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function currentWeek(): { from: string; to: string } {
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: isoOf(mon), to: isoOf(sun) };
}

export type AttRow = {
  id: string; name: string; av: string; c: string; dept: string;
  planned: number; actual: number; deviation: number;
  required: number; // monthly contracted hours (vinnuskylda)
};
export type WeekAttendance = { rows: AttRow[]; live: boolean };

function hoursBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h < 0) h += 24; // overnight
  return h;
}

/** Per-employee planned (shifts) vs actual (punches) hours for a date range
 * (defaults to the current week). */
export async function getWeekAttendance(fromISO?: string, toISO?: string): Promise<WeekAttendance> {
  if (!isSupabaseConfigured()) return { rows: [], live: false };
  try {
    const { employees, live } = await getEmployees();
    if (!live) return { rows: [], live: false };

    const wk = currentWeek();
    const from = fromISO || wk.from, to = toISO || wk.to;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (!company) return { rows: [], live: false };

    const [{ data: shifts }, { data: punches }] = await Promise.all([
      supabase.from("shifts").select("employee_id, start_time, end_time")
        .eq("company_id", company).gte("date", from).lte("date", to),
      supabase.from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).gte("clock_in", from).lte("clock_in", to + "T23:59:59"),
    ]);

    const planned = new Map<string, number>();
    for (const s of shifts ?? []) {
      const h = hoursBetween(s.start_time as string, s.end_time as string);
      planned.set(s.employee_id as string, (planned.get(s.employee_id as string) ?? 0) + h);
    }
    const actual = new Map<string, number>();
    for (const p of punches ?? []) {
      if (!p.clock_out) continue;
      const h = (new Date(p.clock_out as string).getTime() - new Date(p.clock_in as string).getTime()) / 3600000;
      if (h > 0) actual.set(p.employee_id as string, (actual.get(p.employee_id as string) ?? 0) + h);
    }

    const rows: AttRow[] = employees.map((e) => {
      const pl = Math.round((planned.get(e.id) ?? 0) * 10) / 10;
      const ac = Math.round((actual.get(e.id) ?? 0) * 10) / 10;
      return {
        id: e.id, name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor,
        dept: e.department ?? "—", planned: pl, actual: ac, deviation: Math.round((ac - pl) * 10) / 10,
        required: Math.round((e.employmentRatio / 100) * 173.33),
      };
    });
    return { rows, live: true };
  } catch {
    return { rows: [], live: false };
  }
}

export type PerfView = {
  revenueM: string; laborCostM: string; laborPct: number; marginM: string; live: boolean;
};

/** Performance headline (this month) from real revenue + computed labor cost. */
export async function getPerformance(): Promise<PerfView> {
  const demo: PerfView = { revenueM: "0", laborCostM: "0", laborPct: 0, marginM: "0", live: false };
  if (!isSupabaseConfigured()) return demo;
  try {
    const { empty } = await getCompanyData();
    const metrics = await getLaborMetrics();
    const { employees } = await getEmployees();
    const cost = sumTotals(employees.map((e) => computeLine(e))).cost;
    const revenue = metrics.live ? metrics.revenue : 0;
    const m = (n: number) => (Math.round(n / 100000) / 10).toFixed(1).replace(".", ",");
    return {
      revenueM: m(revenue),
      laborCostM: m(cost),
      laborPct: revenue > 0 ? Math.round((cost / revenue) * 1000) / 10 : 0,
      marginM: m(Math.max(0, revenue - cost)),
      live: !empty,
    };
  } catch {
    return demo;
  }
}
