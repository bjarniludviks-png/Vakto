import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";

export type Attendance = { onShift: number; live: boolean };

export type OnNowRow = { punchId: string; employeeId: string; name: string; av: string; c: string; dept: string; in: string; source: string };
export type RosterRow = { id: string; name: string; av: string; c: string; dept: string };
// Scheduled today but not clocked in — late (past start) or still upcoming.
export type MissingRow = { employeeId: string; name: string; av: string; c: string; dept: string; start: string; late: boolean; mins: number };

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Who is clocked in right now (open punches today) + who is scheduled today but
 * NOT clocked in (late / forgot / upcoming) + the full active roster (for the
 * manual clock-in picker). Manager/owner view. */
export async function getWhoIsOn(): Promise<{ rows: OnNowRow[]; missing: MissingRow[]; roster: RosterRow[]; live: boolean }> {
  if (!isSupabaseConfigured()) return { rows: [], missing: [], roster: [], live: false };
  try {
    const { employees, live } = await getEmployees();
    if (!live) return { rows: [], missing: [], roster: [], live: false };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (!company) return { rows: [], missing: [], roster: [], live: false };

    const meta = new Map(employees.map((e) => [e.id, { name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—" }]));
    const now = new Date();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const todayISO = isoOf(now);
    const nowMins = now.getHours() * 60 + now.getMinutes();

    // Any punch today (to tell "already worked" from "forgot") + who's on right now.
    const { data: todayPunches } = await supabase
      .from("punches").select("id, employee_id, clock_in, clock_out, source")
      .eq("company_id", company).gte("clock_in", start.toISOString())
      .order("clock_in", { ascending: true });
    const punchedToday = new Set((todayPunches ?? []).map((p) => p.employee_id as string));

    const rows: OnNowRow[] = (todayPunches ?? []).filter((p) => p.clock_out == null).map((p) => {
      const m = meta.get(p.employee_id as string);
      const ci = new Date(p.clock_in as string);
      return {
        punchId: p.id as string, employeeId: p.employee_id as string,
        name: m?.name ?? "?", av: m?.av ?? "?", c: m?.c ?? "#888", dept: m?.dept ?? "—",
        in: hhmm(ci), source: (p.source as string) ?? "web",
      };
    });
    const onIds = new Set(rows.map((r) => r.employeeId));

    // Today's plan: earliest shift start per employee not currently on / punched.
    const earliest = new Map<string, string>();
    const { data: shifts } = await supabase
      .from("shifts").select("employee_id, start_time").eq("company_id", company).eq("date", todayISO);
    for (const s of shifts ?? []) {
      const eid = s.employee_id as string | null;
      const st = (s.start_time as string ?? "").slice(0, 5);
      if (!eid || !st) continue;
      if (!earliest.has(eid) || st < earliest.get(eid)!) earliest.set(eid, st);
    }
    const missing: MissingRow[] = [];
    for (const [eid, st] of earliest) {
      if (onIds.has(eid) || punchedToday.has(eid)) continue; // on shift or already clocked in
      const m = meta.get(eid);
      if (!m) continue;
      const [h, mm] = st.split(":").map(Number);
      const startMins = h * 60 + (mm || 0);
      missing.push({ employeeId: eid, name: m.name, av: m.av, c: m.c, dept: m.dept, start: st, late: nowMins >= startMins, mins: Math.max(0, nowMins - startMins) });
    }
    // Late first (most overdue on top), then upcoming by start time.
    missing.sort((a, b) => (a.late === b.late ? (a.late ? b.mins - a.mins : a.start.localeCompare(b.start)) : a.late ? -1 : 1));

    const roster: RosterRow[] = employees.filter((e) => !onIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—" }));
    return { rows, missing, roster, live: true };
  } catch {
    return { rows: [], missing: [], roster: [], live: false };
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
