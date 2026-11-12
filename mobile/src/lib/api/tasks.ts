// Verkefni vaktarinnar (shift_tasks, migration 0030) — sama tafla og vefurinn:
// vaktstjóri setur þau í vaktaplaninu, starfsmaðurinn hakar við.
import { supabase } from "../supabase";
import { iso, type Me } from "./me";
import type { BoardRow, DayTasks } from "../tasks";
import { notifyServer } from "./notify";

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
    .select("id, title, done, employee_id, employees:coworkers(full_name, avatar_color, photo_url)")
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

/** Stjórnandi bætir verkefni á vakt starfsmanns (RLS: aðeins stjórnendur). */
export async function addTask(companyId: string, empId: string, date: string, title: string): Promise<Task | null> {
  const t = title.trim().slice(0, 200);
  if (!t) return null;
  const { data, error } = await supabase.from("shift_tasks").insert({ company_id: companyId, employee_id: empId, date, title: t }).select("id, title, done").single();
  return error || !data ? null : { id: data.id as string, title: data.title as string, done: !!data.done };
}
export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await supabase.from("shift_tasks").delete().eq("id", id);
  return !error;
}

/* ------------------------------------------------------------------ 0111 */
// Verkefni og ábyrgð: sama SQL-regla og vefurinn (tasks_day / tasks_board / tick_task).

/** Allt sem ég á að gera á degi (hlutverk, listar, stök verkefni). null = grunnurinn ekki kominn (eldri útgáfa). */
export async function getMyDay(date = iso(new Date()), employeeId?: string): Promise<DayTasks | null> {
  const { data, error } = await supabase.rpc("tasks_day", { p_date: date, p_employee: employeeId ?? null });
  if (error) return null;
  return data as DayTasks | null;
}

/** Eldri grunnur (án 0111): stök verkefni á gamla mátann svo Heim haldi áfram að virka. */
export async function getMyDayOrLegacy(me: Me, date = iso(new Date())): Promise<DayTasks> {
  const d = await getMyDay(date);
  if (d) return d;
  const legacy = await getTasksFor(me.empId, date);
  return {
    date, employee_id: me.empId, on_shift: false, roles: [], lists: [], boss: null,
    adhoc: legacy.map((x) => ({ id: x.id, title: x.title, due_time: null, done: x.done, done_at: null, done_by_name: null, needs_photo: false, photo_url: null, note: null, shared: false, role_name: null, from_name: null, created_by_name: null, legacy: true })),
  };
}

export async function tick(kind: "item" | "adhoc", id: string, date: string, done: boolean, opts: { photo?: string; note?: string; owner?: string; legacy?: boolean } = {}): Promise<boolean> {
  if (opts.legacy) return setTaskDone(id, done);
  const { error } = await supabase.rpc("tick_task", { p_kind: kind, p_id: id, p_date: date, p_done: done, p_photo: opts.photo ?? null, p_note: opts.note ?? null, p_owner: opts.owner ?? null });
  return !error;
}

export async function getBoard(date = iso(new Date())): Promise<BoardRow[] | null> {
  const { data, error } = await supabase.rpc("tasks_board", { p_date: date });
  return error ? null : (data as BoardRow[]);
}

/** Árangur liðsins frá mánudegi til dagsins í dag. */
export async function getTeamWeek(): Promise<{ done: number; total: number } | null> {
  const t = new Date(); const from = new Date(t); from.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const { data, error } = await supabase.rpc("tasks_team_progress", { p_from: iso(from), p_to: iso(t) });
  return error ? null : (data as { done: number; total: number });
}

export type IncidentCategory = "hitastig" | "vara" | "bilun" | "atvik" | "verkefni" | "annad";
export async function reportIncident(me: Me, input: { category: IncidentCategory; title: string; note?: string; taskRef?: string }): Promise<boolean> {
  const title = input.title.trim().slice(0, 200);
  if (!title) return false;
  const { data, error } = await supabase.from("incidents").insert({
    company_id: me.companyId, employee_id: me.empId, category: input.category, title,
    note: input.note?.trim().slice(0, 2000) || null, task_ref: input.taskRef?.slice(0, 200) || null, date: iso(new Date()),
  }).select("id").single();
  if (error || !data) return false;
  notifyServer("incident", data.id as string);
  return true;
}

export type MyRole = { id: string; name: string; color: string | null; responsibilities: string[]; backup: boolean; others: { name: string; backup: boolean }[] };
/** Föstu hlutverkin mín + hverjir aðrir eru með þau (varamenn). */
export async function getMyRoles(me: Me): Promise<MyRole[]> {
  const { data: mine } = await supabase.from("employee_work_roles").select("role_id, backup").eq("employee_id", me.empId);
  const ids = (mine ?? []).map((r) => r.role_id as string);
  if (!ids.length) return [];
  const [{ data: roles }, { data: all }] = await Promise.all([
    supabase.from("work_roles").select("id, name, color, responsibilities").in("id", ids),
    supabase.from("employee_work_roles").select("role_id, backup, employee_id, emp:coworkers!employee_work_roles_employee_id_fkey(full_name)").in("role_id", ids),
  ]);
  return (roles ?? []).map((r) => ({
    id: r.id as string, name: r.name as string, color: (r.color as string) ?? null, responsibilities: (r.responsibilities as string[]) ?? [],
    backup: !!(mine ?? []).find((m) => m.role_id === r.id)?.backup,
    others: (all ?? []).filter((a) => a.role_id === r.id && a.employee_id !== me.empId).map((a) => {
      const e = (Array.isArray(a.emp) ? a.emp[0] : a.emp) as { full_name?: string } | null;
      return { name: e?.full_name ?? "", backup: !!a.backup };
    }),
  }));
}

export type Person = { id: string; name: string; color: string | null; photo: string | null };
export async function getPeople(me: Me): Promise<Person[]> {
  const { data } = await supabase.from("coworkers").select("id, full_name, avatar_color, photo_url").eq("company_id", me.companyId).neq("status", "inactive").order("full_name");
  return (data ?? []).map((e) => ({ id: e.id as string, name: e.full_name as string, color: (e.avatar_color as string) ?? null, photo: (e.photo_url as string) ?? null }));
}

/** Færa ábyrgð: allt (roleIds null) eða valin hlutverk, frá mér (eða hverjum sem er ef ég er stjórnandi). */
export async function handOver(me: Me, input: { fromId: string; toId: string; roleIds: string[] | null; start: string; end: string | null; note?: string }): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const rows = (input.roleIds ?? [null]).map((role_id) => ({
    company_id: me.companyId, from_employee_id: input.fromId, to_employee_id: input.toId, role_id,
    start_date: input.start, end_date: input.end, note: input.note?.trim().slice(0, 500) || null, created_by: auth.user?.id ?? null,
  }));
  const { data, error } = await supabase.from("role_handovers").insert(rows).select("id");
  if (error) return error.message;
  if (data?.[0]) notifyServer("handover", data[0].id as string);
  return null;
}

export type ActiveHandover = { id: string; fromId: string; toId: string; roleId: string | null; end: string | null };
export async function getActiveHandovers(me: Me, date = iso(new Date())): Promise<ActiveHandover[]> {
  const { data } = await supabase.from("role_handovers").select("id, from_employee_id, to_employee_id, role_id, start_date, end_date")
    .eq("company_id", me.companyId).is("returned_at", null).lte("start_date", date);
  return (data ?? []).filter((h) => !h.end_date || (h.end_date as string) >= date)
    .map((h) => ({ id: h.id as string, fromId: h.from_employee_id as string, toId: h.to_employee_id as string, roleId: (h.role_id as string) ?? null, end: (h.end_date as string) ?? null }));
}
export async function returnHandover(id: string): Promise<boolean> {
  const { data, error } = await supabase.from("role_handovers").update({ returned_at: new Date().toISOString() }).eq("id", id).select("id");
  return !error && !!data?.length;
}

/** Stjórnandi bætir stöku verkefni við (með tíma) og viðkomandi fær push. */
export async function addTaskFull(me: Me, input: { employeeId: string | null; title: string; date: string; dueTime?: string | null }): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const title = input.title.trim().slice(0, 200);
  if (!title) return false;
  const { data, error } = await supabase.from("shift_tasks").insert({
    company_id: me.companyId, employee_id: input.employeeId, date: input.date, title,
    due_time: input.dueTime && /^\d{2}:\d{2}$/.test(input.dueTime) ? input.dueTime : null, created_by: auth.user?.id ?? null,
  }).select("id").single();
  if (error || !data) return false;
  if (input.employeeId) notifyServer("task_added", data.id as string);
  return true;
}
