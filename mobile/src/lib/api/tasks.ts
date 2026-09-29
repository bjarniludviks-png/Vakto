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
