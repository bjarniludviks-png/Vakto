// Verkefni vaktarinnar (shift_tasks, migration 0030) — sama tafla og vefurinn:
// vaktstjóri setur þau í vaktaplaninu, starfsmaðurinn hakar við.
import { supabase } from "../supabase";
import { iso, type Me } from "./me";

export type Task = { id: string; title: string; done: boolean };

export async function getTodayTasks(me: Me): Promise<Task[]> {
  const { data, error } = await supabase.from("shift_tasks")
    .select("id, title, done").eq("employee_id", me.empId).eq("date", iso(new Date())).order("created_at");
  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id as string, title: r.title as string, done: !!r.done }));
}

export async function setTaskDone(id: string, done: boolean): Promise<boolean> {
  const { error } = await supabase.from("shift_tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
  return !error;
}

/** Verkefni eins starfsmanns á tilteknum degi (vaktarskjárinn). */
export async function getTasksFor(empId: string, date: string): Promise<Task[]> {
  const { data, error } = await supabase.from("shift_tasks")
    .select("id, title, done").eq("employee_id", empId).eq("date", date).order("created_at");
  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id as string, title: r.title as string, done: !!r.done }));
}

export type StaffTasks = { empId: string; name: string; color: string | null; photo: string | null; tasks: Task[] };

/** Verkefni dagsins hjá öllum í fyrirtækinu, flokkuð per starfsmann (mælaborð stjórnanda). */
export async function getCompanyTasks(companyId: string, date = iso(new Date())): Promise<StaffTasks[]> {
  const { data, error } = await supabase.from("shift_tasks")
    .select("id, title, done, employee_id, employees(full_name, avatar_color, photo_url)")
    .eq("company_id", companyId).eq("date", date).order("created_at");
  if (error) return [];
  const by = new Map<string, StaffTasks>();
  for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as { full_name?: string; avatar_color?: string | null; photo_url?: string | null } | null;
    const id = r.employee_id as string;
    if (!by.has(id)) by.set(id, { empId: id, name: e?.full_name ?? "Starfsmaður", color: e?.avatar_color ?? null, photo: e?.photo_url ?? null, tasks: [] });
    by.get(id)!.tasks.push({ id: r.id as string, title: r.title as string, done: !!r.done });
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name, "is"));
}
