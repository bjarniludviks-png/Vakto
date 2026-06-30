import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";

export type Attendance = { onShift: number; live: boolean };

export type OnNowRow = { punchId: string; employeeId: string; name: string; av: string; c: string; dept: string; in: string; source: string };
export type RosterRow = { id: string; name: string; av: string; c: string; dept: string };

/** Who is clocked in right now (open punches today) + the full active roster
 * (for the manual clock-in picker). Manager/owner view. */
export async function getWhoIsOn(): Promise<{ rows: OnNowRow[]; roster: RosterRow[]; live: boolean }> {
  if (!isSupabaseConfigured()) return { rows: [], roster: [], live: false };
  try {
    const { employees, live } = await getEmployees();
    if (!live) return { rows: [], roster: [], live: false };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (!company) return { rows: [], roster: [], live: false };

    const meta = new Map(employees.map((e) => [e.id, { name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—" }]));
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data: open } = await supabase
      .from("punches").select("id, employee_id, clock_in, source")
      .eq("company_id", company).is("clock_out", null).gte("clock_in", start.toISOString())
      .order("clock_in", { ascending: true });

    const rows: OnNowRow[] = (open ?? []).map((p) => {
      const m = meta.get(p.employee_id as string);
      const ci = new Date(p.clock_in as string);
      return {
        punchId: p.id as string, employeeId: p.employee_id as string,
        name: m?.name ?? "?", av: m?.av ?? "?", c: m?.c ?? "#888", dept: m?.dept ?? "—",
        in: `${String(ci.getHours()).padStart(2, "0")}:${String(ci.getMinutes()).padStart(2, "0")}`,
        source: (p.source as string) ?? "web",
      };
    });
    const onIds = new Set(rows.map((r) => r.employeeId));
    const roster: RosterRow[] = employees.filter((e) => !onIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—" }));
    return { rows, roster, live: true };
  } catch {
    return { rows: [], roster: [], live: false };
  }
}

/** Count employees currently clocked in (open punches today) — fed by kiosk + app. */
export async function getTodayAttendance(): Promise<Attendance> {
  if (!isSupabaseConfigured()) return { onShift: 5, live: false };
  try {
    const supabase = await createClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from("punches")
      .select("id", { count: "exact", head: true })
      .is("clock_out", null)
      .gte("clock_in", start.toISOString());
    if (error) return { onShift: 5, live: false };
    return { onShift: count ?? 0, live: true };
  } catch {
    return { onShift: 5, live: false };
  }
}
