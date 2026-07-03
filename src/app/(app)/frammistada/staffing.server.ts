import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type WeekdayStat = { wd: number; label: string; planned: number; actual: number; deviation: number; rec: "more" | "fewer" | "ok" };
export type StaffingPattern = { live: boolean; rows: WeekdayStat[]; weeks: number };

const WD_IS = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];

function shiftHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h < 0) h += 24;
  return h;
}

// Demo pattern: weekends over-staffed, midweek under (illustrative).
const DEMO: WeekdayStat[] = [
  { wd: 1, label: "Mánudagur", planned: 32, actual: 30, deviation: -2, rec: "ok" },
  { wd: 2, label: "Þriðjudagur", planned: 30, actual: 27, deviation: -3, rec: "fewer" },
  { wd: 3, label: "Miðvikudagur", planned: 34, actual: 33, deviation: -1, rec: "ok" },
  { wd: 4, label: "Fimmtudagur", planned: 40, actual: 44, deviation: 4, rec: "more" },
  { wd: 5, label: "Föstudagur", planned: 56, actual: 63, deviation: 7, rec: "more" },
  { wd: 6, label: "Laugardagur", planned: 60, actual: 68, deviation: 8, rec: "more" },
  { wd: 0, label: "Sunnudagur", planned: 44, actual: 38, deviation: -6, rec: "fewer" },
];

/** Average planned vs actual hours per weekday over a date range — reveals which
 * weekdays are consistently over/under-staffed. Demo fallback when unconfigured. */
export async function getStaffingPattern(fromISO: string, toISO: string): Promise<StaffingPattern> {
  if (!isSupabaseConfigured()) return { live: false, rows: DEMO, weeks: 4 };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (!company) return { live: false, rows: DEMO, weeks: 4 };

    const [{ data: shifts }, { data: punches }] = await Promise.all([
      supabase.from("shifts").select("date, start_time, end_time").eq("company_id", company).gte("date", fromISO).lte("date", toISO),
      supabase.from("punches").select("clock_in, clock_out").eq("company_id", company).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59"),
    ]);

    const planned = new Array(7).fill(0), actual = new Array(7).fill(0);
    for (const s of shifts ?? []) {
      const wd = new Date((s.date as string) + "T00:00:00").getDay();
      planned[wd] += shiftHours(s.start_time as string, s.end_time as string);
    }
    for (const p of punches ?? []) {
      if (!p.clock_out) continue;
      const ci = new Date(p.clock_in as string);
      const h = (new Date(p.clock_out as string).getTime() - ci.getTime()) / 3600000;
      if (h > 0) actual[ci.getDay()] += h;
    }
    // Weeks spanned (for averaging into a typical week).
    const days = Math.max(1, Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86400000) + 1);
    const weeks = Math.max(1, days / 7);

    const order = [1, 2, 3, 4, 5, 6, 0];
    const rows: WeekdayStat[] = order.map((wd) => {
      const pl = Math.round((planned[wd] / weeks) * 10) / 10;
      const ac = Math.round((actual[wd] / weeks) * 10) / 10;
      const dev = Math.round((ac - pl) * 10) / 10;
      // Recommendation: actual well above plan → understaffed (add people); well below → overstaffed.
      const rec = dev >= 3 ? "more" : dev <= -3 ? "fewer" : "ok";
      return { wd, label: WD_IS[wd], planned: pl, actual: ac, deviation: dev, rec };
    });
    const anyData = rows.some((r) => r.planned > 0 || r.actual > 0);
    return anyData ? { live: true, rows, weeks: Math.round(weeks) } : { live: false, rows: DEMO, weeks: 4 };
  } catch {
    return { live: false, rows: DEMO, weeks: 4 };
  }
}
