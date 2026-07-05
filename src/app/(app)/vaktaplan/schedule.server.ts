import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees, } from "@/lib/employees.server";
import { initials } from "@/lib/employees";
import { dec1 } from "@/lib/format";

export type Emp4 = [string, string, string, string]; // initials, first name, dept, color
export type ShiftTypeView = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
export type ScheduleInitial = { emp: Emp4[]; grid: string[][]; times: Record<string, { start: string; end: string }>; types: ShiftTypeView[]; pool: Emp4[]; fte: string; company: string; todayISO: string; targets: number[] };

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// 7 ISO dates for the (Mon-start) week containing `ref`.
function weekDatesOf(ref: Date): string[] {
  const mon = new Date(ref); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return isoOf(d); });
}

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

    const today = new Date();
    const todayISO = isoOf(today);
    const WEEK_DATES = weekDatesOf(today);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;

    const rowOf = (e: (typeof employees)[number]): Emp4 => [
      initials(e.fullName), e.fullName.split(/\s+/)[0], e.department ?? "Stjórnun", e.avatarColor,
    ];

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
    const times: Record<string, { start: string; end: string }> = {};
    if (company) {
      const { data: shifts } = await supabase
        .from("shifts").select("employee_id, date, start_time, end_time")
        .eq("company_id", company).in("date", WEEK_DATES);
      for (const s of shifts ?? []) {
        const r = idById.get(s.employee_id as string);
        const c = WEEK_DATES.indexOf(s.date as string);
        if (r !== undefined && c >= 0) {
          grid[r][c] = codeForStart(s.start_time as string);
          times[`${r}:${c}`] = { start: ((s.start_time as string) ?? "").slice(0, 5), end: ((s.end_time as string) ?? "").slice(0, 5) };
        }
      }
    }

    let companyName = "Vaktaplan";
    let targets: number[] = [];
    if (company) {
      const { data: co } = await supabase.from("companies").select("name").eq("id", company).maybeSingle();
      if (co?.name) companyName = co.name as string;
      const { data: st } = await supabase.from("companies").select("staffing_targets").eq("id", company).maybeSingle();
      if (Array.isArray(st?.staffing_targets)) targets = (st!.staffing_targets as number[]).slice(0, 7);
    }

    // Partition: employees WITH a shift this week are "on the plan" (grid rows);
    // the rest go to the pool. This way, removing someone from the plan (which
    // deletes their shifts) keeps them off the grid on refresh instead of
    // reappearing as an empty row — and they stay reachable via "Bæta á plan".
    const emp: Emp4[] = [];
    const gridOut: string[][] = [];
    const timesOut: Record<string, { start: string; end: string }> = {};
    const pool: Emp4[] = [];
    // Empty week (no shifts yet) → show the whole roster so scheduling can begin.
    const anyShift = grid.some((row) => row.some((s) => s !== "off"));
    employees.forEach((e, i) => {
      if (!anyShift || grid[i].some((s) => s !== "off")) {
        const nr = emp.length;
        emp.push(rowOf(e));
        gridOut.push(grid[i]);
        grid[i].forEach((_, c) => { const k = `${i}:${c}`; if (times[k]) timesOut[`${nr}:${c}`] = times[k]; });
      } else {
        pool.push(rowOf(e));
      }
    });

    const fte = dec1(employees.reduce((a, e) => a + e.employmentRatio, 0) / 100);
    return { emp, grid: gridOut, times: timesOut, types, pool, fte, company: companyName, todayISO, targets };
  } catch {
    return null;
  }
}
