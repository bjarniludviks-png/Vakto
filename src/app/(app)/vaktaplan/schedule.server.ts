import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees, } from "@/lib/employees.server";
import { initials } from "@/lib/employees";
import { dec1 } from "@/lib/format";

export type Emp4 = [string, string, string, string]; // initials, first name, dept, color
export type ShiftTypeView = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
export type ScheduleInitial = { emp: Emp4[]; grid: string[][]; types: ShiftTypeView[]; pool: Emp4[]; fte: string };

const WEEK_DATES = [22, 23, 24, 25, 26, 27, 28].map((d) => `2026-06-${d}`);

// Map a shift start hour to the grid's shift code (keys must exist in SH).
function codeForStart(start: string | null): string {
  const h = parseInt((start ?? "").slice(0, 2), 10);
  if (h === 7) return "M";
  if (h === 11) return "Mi";
  if (h === 14) return "E";
  if (h === 16) return "L";
  return "D";
}

/** Live schedule: real employees as rows + published shifts mapped into the grid.
 * Returns null when not configured / no live data → screen uses its demo defaults. */
export async function getSchedule(): Promise<ScheduleInitial | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { employees, live } = await getEmployees();
    if (!live) return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;

    const emp: Emp4[] = employees.map((e) => [
      initials(e.fullName), e.fullName.split(/\s+/)[0], e.department ?? "Stjórnun", e.avatarColor,
    ]);

    // shift types
    let types: ShiftTypeView[] = [];
    if (company) {
      const { data: st } = await supabase
        .from("shift_types").select("name, start_time, end_time, premium_label, color, bg, border")
        .eq("company_id", company);
      types = (st ?? []).map((s) => ({
        nm: s.name as string,
        t: `${(s.start_time as string ?? "").slice(0, 5)}–${(s.end_time as string ?? "").slice(0, 5)}`,
        prem: (s.premium_label as string) ?? "Dagvinna",
        bg: (s.bg as string) ?? "#eef0ff",
        bd: (s.border as string) ?? "#e0e2fb",
        fg: (s.color as string) ?? "#4338ca",
      }));
    }

    // published shifts for the demo week → grid[empIndex][dayIndex]
    const idById = new Map(employees.map((e, i) => [e.id, i]));
    const grid: string[][] = employees.map(() => Array(7).fill("off"));
    if (company) {
      const { data: shifts } = await supabase
        .from("shifts").select("employee_id, date, start_time")
        .eq("company_id", company).in("date", WEEK_DATES);
      for (const s of shifts ?? []) {
        const r = idById.get(s.employee_id as string);
        const c = WEEK_DATES.indexOf(s.date as string);
        if (r !== undefined && c >= 0) grid[r][c] = codeForStart(s.start_time as string);
      }
    }

    const fte = dec1(employees.reduce((a, e) => a + e.employmentRatio, 0) / 100);
    return { emp, grid, types, pool: [], fte };
  } catch {
    return null;
  }
}
