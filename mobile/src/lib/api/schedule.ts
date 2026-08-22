// Week schedule for the Vaktir tab — mine / everyone / open, Sling-style.
// Employees can read all company shifts + employee names (RLS company-wide).
import { supabase } from "../supabase";
import { iso, mondayOf, type Me } from "./me";

export type SchedShift = {
  id: string;
  date: string;
  start: string | null; // "HH:MM"
  end: string | null;
  dur: string; // "7,5 klst"
  typeName: string | null;
  color: string; // shift-type color → dept color → fallback
  empId: string | null;
  empName: string | null;
  dept: string | null;
  mine: boolean;
  open: boolean;
};

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

function durOf(start: string | null, end: string | null): { h: number; label: string } {
  if (!start || !end) return { h: 0, label: "" };
  let h =
    parseInt(end.slice(0, 2), 10) + parseInt(end.slice(3, 5), 10) / 60 -
    parseInt(start.slice(0, 2), 10) - parseInt(start.slice(3, 5), 10) / 60;
  if (h < 0) h += 24;
  const r = Math.round(h * 10) / 10;
  return { h: r, label: `${String(r).replace(".", ",")} klst` };
}

export async function getWeekShifts(me: Me, weekStart: Date): Promise<SchedShift[]> {
  const from = iso(weekStart);
  const endD = new Date(weekStart);
  endD.setDate(endD.getDate() + 6);
  const to = iso(endD);

  const { data } = await supabase
    .from("shifts")
    .select(
      "id, date, start_time, end_time, employee_id, employees(full_name, avatar_color, departments(name, color)), shift_types(name, color)"
    )
    .eq("company_id", me.companyId)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("start_time");

  return (data ?? []).map((s) => {
    const emp = (Array.isArray(s.employees) ? s.employees[0] : s.employees) as
      | { full_name?: string; avatar_color?: string; departments?: { name?: string; color?: string } | { name?: string; color?: string }[] }
      | null;
    const dep = emp?.departments ? (Array.isArray(emp.departments) ? emp.departments[0] : emp.departments) : null;
    const st = (Array.isArray(s.shift_types) ? s.shift_types[0] : s.shift_types) as { name?: string; color?: string } | null;
    const start = hm(s.start_time);
    const end = hm(s.end_time);
    return {
      id: s.id as string,
      date: s.date as string,
      start,
      end,
      dur: durOf(start, end).label,
      typeName: st?.name ?? null,
      color: st?.color ?? dep?.color ?? emp?.avatar_color ?? "#e9700f",
      empId: (s.employee_id as string) ?? null,
      empName: emp?.full_name ?? null,
      dept: dep?.name ?? null,
      mine: s.employee_id === me.empId,
      open: !s.employee_id,
    };
  });
}

export function weekHoursOf(shifts: SchedShift[], empId: string): number {
  let h = 0;
  for (const s of shifts) {
    if (s.empId !== empId) continue;
    h += durOf(s.start, s.end).h;
  }
  return Math.round(h * 10) / 10;
}

/** Coworkers on the same day whose times overlap the given shift. */
export function coworkersOf(all: SchedShift[], shift: SchedShift): SchedShift[] {
  const s1 = shift.start ?? "00:00";
  const e1raw = shift.end ?? "24:00";
  const e1 = e1raw <= s1 ? "24:00" : e1raw; // midnight wrap → treat as till end of day
  return all.filter((s) => {
    if (s.id === shift.id || s.date !== shift.date || !s.empId || s.empId === shift.empId) return false;
    const s2 = s.start ?? "00:00";
    const e2raw = s.end ?? "24:00";
    const e2 = e2raw <= s2 ? "24:00" : e2raw;
    return s2 < e1 && s1 < e2;
  });
}

export { iso, mondayOf };
