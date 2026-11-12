"use server";

// Verkefni og ábyrgð (0111): hlutverk, listar, stök verkefni, ábyrgðarfærslur, skipurit og frávik.
// Lestur „hver á að gera hvað“ fer um SQL-föllin tasks_board / tasks_day (sama regla og appið).
// Skrif stjórnenda fara beint í töflurnar (RLS: aðeins stjórnendur); hök aðeins um tick_task().

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { userError } from "@/lib/user-error";
import { logAudit } from "@/lib/audit";
import { notifyEmployee, notifyEmployees, notifyManagers } from "@/lib/push";
import type { BoardRow, DayTasks, ListCategory, ListTarget } from "@/lib/tasks";

type Sb = Awaited<ReturnType<typeof createClient>>;
type Res = { ok: boolean; error?: string; id?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATS: ListCategory[] = ["opnun", "lokun", "thrif", "vikulegt", "manadarlegt", "annad"];
const INC_CATS = ["hitastig", "vara", "bilun", "atvik", "verkefni", "annad"] as const;

async function ctxOf(supabase: Sb) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  const role = (profile?.role as string) ?? "employee";
  const { data: me } = await supabase.from("employees").select("id, full_name").eq("user_id", user.id).eq("company_id", company).maybeSingle();
  return { userId: user.id, company, manager: role === "owner" || role === "manager", empId: (me?.id as string) ?? null, myName: (me?.full_name as string) ?? "" };
}
type Ctx = Exclude<Awaited<ReturnType<typeof ctxOf>>, { error: string }>;

/** Algengur rammi fyrir skrif stjórnenda. */
async function managerWrite(fn: (sb: Sb, ctx: Ctx) => Promise<Res>, fallback = "Tókst ekki að vista"): Promise<Res> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (!ctx.manager) return { ok: false, error: "Aðeins stjórnendur geta gert þetta" };
    const r = await fn(supabase, ctx);
    if (r.ok) revalidatePath("/verkefni");
    return r;
  } catch (e) {
    return { ok: false, error: userError(e, fallback) };
  }
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const idOrNull = (s: unknown) => (typeof s === "string" && UUID_RE.test(s) ? s : null);

/* ------------------------------------------------------------------ lestur */

export type TaskPerson = { id: string; name: string; title: string | null; color: string | null; photo: string | null; reportsTo: string | null; status: string };
export type TaskRole = {
  id: string; name: string; description: string | null; responsibilities: string[]; color: string | null;
  shiftTypeId: string | null; holders: { employeeId: string; backup: boolean }[];
};
export type TaskListDef = {
  id: string; name: string; category: ListCategory; target: ListTarget; roleId: string | null; employeeId: string | null;
  locationId: string | null; shared: boolean; weekdays: number[] | null; monthDay: number | null; dueTime: string | null;
  remind: boolean; escalate: boolean; active: boolean; items: { id: string; title: string; needsPhoto: boolean }[];
};
export type Handover = {
  id: string; fromId: string; toId: string; roleId: string | null; start: string; end: string | null; note: string | null;
  returnedAt: string | null; createdAt: string;
};
export type Incident = {
  id: string; date: string; category: string; title: string; note: string | null; photo: string | null;
  status: "open" | "resolved"; employeeId: string | null; createdAt: string; taskRef: string | null;
};
export type TasksOverview = {
  ok: boolean; live: boolean; missing?: boolean; error?: string;
  date: string; meId: string | null; manager: boolean;
  board: BoardRow[]; people: TaskPerson[]; roles: TaskRole[]; lists: TaskListDef[];
  handovers: Handover[]; incidents: Incident[];
  shiftTypes: { id: string; name: string }[]; locations: { id: string; name: string }[];
};

const todayISO = () => new Date().toISOString().slice(0, 10); // Ísland = UTC

function emptyOverview(date: string, extra: Partial<TasksOverview> = {}): TasksOverview {
  return { ok: true, live: false, date, meId: null, manager: true, board: [], people: [], roles: [], lists: [], handovers: [], incidents: [], shiftTypes: [], locations: [], ...extra };
}

/** Allt sem Verkefna-síðan þarf fyrir einn dag. */
export async function getTasksOverview(date = todayISO()): Promise<TasksOverview> {
  if (!DATE_RE.test(date)) date = todayISO();
  if (!isSupabaseConfigured()) return emptyOverview(date);
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return emptyOverview(date, { ok: false, error: ctx.error });
    if (!ctx.manager) return emptyOverview(date, { ok: false, manager: false, error: "Aðeins stjórnendur" });
    const c = ctx.company;
    const [board, emps, roles, holders, lists, items, hos, incs, types, locs] = await Promise.all([
      supabase.rpc("tasks_board", { p_date: date }),
      supabase.from("employees").select("id, full_name, title, avatar_color, photo_url, reports_to, status").eq("company_id", c).neq("status", "inactive").order("full_name"),
      supabase.from("work_roles").select("id, name, description, responsibilities, color, shift_type_id, sort").eq("company_id", c).order("sort").order("name"),
      supabase.from("employee_work_roles").select("employee_id, role_id, backup").eq("company_id", c),
      supabase.from("task_lists").select("*").eq("company_id", c).order("sort").order("name"),
      supabase.from("task_list_items").select("id, list_id, title, needs_photo, sort, created_at").eq("company_id", c).order("sort").order("created_at"),
      supabase.from("role_handovers").select("*").eq("company_id", c).is("returned_at", null).order("created_at", { ascending: false }),
      supabase.from("incidents").select("*").eq("company_id", c).order("created_at", { ascending: false }).limit(100),
      supabase.from("shift_types").select("id, name").eq("company_id", c).order("name"),
      supabase.from("locations").select("id, name").eq("company_id", c).order("name"),
    ]);
    if (board.error && /tasks_board|work_roles|does not exist|schema cache/i.test(board.error.message)) {
      return emptyOverview(date, { missing: true });
    }
    const itemsBy = new Map<string, TaskListDef["items"]>();
    for (const i of items.data ?? []) {
      const k = i.list_id as string;
      if (!itemsBy.has(k)) itemsBy.set(k, []);
      itemsBy.get(k)!.push({ id: i.id as string, title: i.title as string, needsPhoto: !!i.needs_photo });
    }
    const holdersBy = new Map<string, TaskRole["holders"]>();
    for (const h of holders.data ?? []) {
      const k = h.role_id as string;
      if (!holdersBy.has(k)) holdersBy.set(k, []);
      holdersBy.get(k)!.push({ employeeId: h.employee_id as string, backup: !!h.backup });
    }
    // Færslur sem eru liðnar (end_date < í dag) teljast búnar.
    const today = todayISO();
    return {
      ok: true, live: true, date, meId: ctx.empId, manager: true,
      board: (board.data as BoardRow[] | null) ?? [],
      people: (emps.data ?? []).map((e) => ({ id: e.id as string, name: e.full_name as string, title: (e.title as string) ?? null, color: (e.avatar_color as string) ?? null, photo: (e.photo_url as string) ?? null, reportsTo: (e.reports_to as string) ?? null, status: e.status as string })),
      roles: (roles.data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, description: (r.description as string) ?? null, responsibilities: (r.responsibilities as string[]) ?? [], color: (r.color as string) ?? null, shiftTypeId: (r.shift_type_id as string) ?? null, holders: holdersBy.get(r.id as string) ?? [] })),
      lists: (lists.data ?? []).map((l) => ({
        id: l.id as string, name: l.name as string, category: l.category as ListCategory, target: l.target as ListTarget,
        roleId: (l.role_id as string) ?? null, employeeId: (l.employee_id as string) ?? null, locationId: (l.location_id as string) ?? null,
        shared: !!l.shared, weekdays: (l.weekdays as number[]) ?? null, monthDay: (l.month_day as number) ?? null,
        dueTime: l.due_time ? String(l.due_time).slice(0, 5) : null, remind: !!l.remind, escalate: !!l.escalate, active: !!l.active,
        items: itemsBy.get(l.id as string) ?? [],
      })),
      handovers: (hos.data ?? []).filter((h) => !h.end_date || (h.end_date as string) >= today).map((h) => ({
        id: h.id as string, fromId: h.from_employee_id as string, toId: h.to_employee_id as string, roleId: (h.role_id as string) ?? null,
        start: h.start_date as string, end: (h.end_date as string) ?? null, note: (h.note as string) ?? null, returnedAt: null, createdAt: h.created_at as string,
      })),
      incidents: (incs.data ?? []).map((i) => ({ id: i.id as string, date: i.date as string, category: i.category as string, title: i.title as string, note: (i.note as string) ?? null, photo: (i.photo_url as string) ?? null, status: i.status as "open" | "resolved", employeeId: (i.employee_id as string) ?? null, createdAt: i.created_at as string, taskRef: (i.task_ref as string) ?? null })),
      shiftTypes: (types.data ?? []).map((t) => ({ id: t.id as string, name: t.name as string })),
      locations: (locs.data ?? []).map((l) => ({ id: l.id as string, name: l.name as string })),
    };
  } catch (e) {
    return emptyOverview(date, { ok: false, error: userError(e, "Tókst ekki að sækja verkefnin") });
  }
}

/** Mín verkefni (Mitt svæði) — eða annars starfsmanns ef ég er stjórnandi. */
export async function getMyDay(date = todayISO(), employeeId?: string): Promise<{ ok: boolean; day: DayTasks | null; team?: { done: number; total: number } }> {
  if (!isSupabaseConfigured() || !DATE_RE.test(date)) return { ok: false, day: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("tasks_day", { p_date: date, p_employee: idOrNull(employeeId) });
    if (error) return { ok: false, day: null };
    return { ok: true, day: data as DayTasks | null };
  } catch {
    return { ok: false, day: null };
  }
}

/** Árangur liðsins í vikunni (mán–í dag) fyrir „Vel gert“. */
export async function getTeamWeek(): Promise<{ done: number; total: number } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const t = new Date(); const dow = (t.getUTCDay() + 6) % 7;
    const from = new Date(t); from.setUTCDate(t.getUTCDate() - dow);
    const { data, error } = await supabase.rpc("tasks_team_progress", { p_from: from.toISOString().slice(0, 10), p_to: todayISO() });
    return error ? null : (data as { done: number; total: number });
  } catch { return null; }
}

/* ------------------------------------------------------------------- hök */

export async function tickTask(kind: "item" | "adhoc", id: string, date: string, done: boolean, opts: { owner?: string; photo?: string; note?: string } = {}): Promise<Res> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true };
  if (!UUID_RE.test(id) || !DATE_RE.test(date)) return { ok: false, error: "Ógilt verkefni" };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("tick_task", {
      p_kind: kind, p_id: id, p_date: date, p_done: done,
      p_photo: opts.photo ?? null, p_note: opts.note ? clean(opts.note, 500) : null, p_owner: idOrNull(opts.owner),
    });
    if (error) return { ok: false, error: /FORBIDDEN/.test(error.message) ? "Þetta verkefni er ekki á þinni könnu í dag" : userError(error, "Tókst ekki að haka") };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að haka") };
  }
}

/* --------------------------------------------------------- stök verkefni */

export type AdhocInput = {
  title: string; target: "employee" | "role" | "everyone"; employeeId?: string | null; roleId?: string | null;
  date: string; dueTime?: string | null; needsPhoto?: boolean; note?: string | null;
};

export async function addAdhocTask(input: AdhocInput): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "Skrifaðu verkefnið" };
    if (!DATE_RE.test(input.date)) return { ok: false, error: "Veldu dag" };
    const due = input.dueTime && TIME_RE.test(input.dueTime) ? input.dueTime : null;
    const emp = input.target === "employee" ? idOrNull(input.employeeId) : null;
    const role = input.target === "role" ? idOrNull(input.roleId) : null;
    if (input.target === "employee" && !emp) return { ok: false, error: "Veldu manneskju" };
    if (input.target === "role" && !role) return { ok: false, error: "Veldu hlutverk" };
    const { data, error } = await supabase.from("shift_tasks").insert({
      company_id: ctx.company, employee_id: emp, role_id: role, date: input.date, title, due_time: due,
      needs_photo: !!input.needsPhoto, note: input.note ? clean(input.note, 500) : null, created_by: ctx.userId,
    }).select("id").single();
    if (error) return { ok: false, error: userError(error, "Tókst ekki að bæta verkefninu við") };
    const body = `${title}${due ? ` · fyrir kl. ${due}` : ""}`;
    const push = { title: "Nýtt verkefni", body, url: "/mitt-svaedi#verkefni", appUrl: "/verkefni" };
    if (input.date === todayISO()) {
      if (emp) await notifyEmployee(emp, push);
      else if (role) {
        const { data: h } = await supabase.rpc("tasks_board", { p_date: input.date });
        for (const r of (h as BoardRow[] | null) ?? []) if (r.adhoc.some((a) => a.id === data.id)) await notifyEmployee(r.employee_id, push);
      } else await notifyEmployees(ctx.company, { ...push, title: "Nýtt verkefni á vaktinni" });
    }
    return { ok: true, id: data.id as string };
  }, "Tókst ekki að bæta verkefninu við");
}

export async function deleteAdhocTask(id: string): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const { error, count } = await supabase.from("shift_tasks").delete({ count: "exact" }).eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: userError(error) };
    return count ? { ok: true } : { ok: false, error: "Verkefnið fannst ekki" };
  });
}

/* --------------------------------------------------------------- hlutverk */

export type RoleInput = {
  id?: string | null; name: string; description?: string | null; responsibilities: string[]; color?: string | null;
  shiftTypeId?: string | null; holders: { employeeId: string; backup: boolean }[];
};

export async function saveRole(input: RoleInput): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const name = clean(input.name, 60);
    if (!name) return { ok: false, error: "Hlutverkið þarf heiti" };
    const row = {
      company_id: ctx.company, name, description: input.description ? clean(input.description, 400) : null,
      responsibilities: (input.responsibilities ?? []).map((r) => clean(r, 120)).filter(Boolean).slice(0, 30),
      color: input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : null,
      shift_type_id: idOrNull(input.shiftTypeId),
    };
    let id = idOrNull(input.id);
    if (id) {
      const { error, data } = await supabase.from("work_roles").update(row).eq("id", id).eq("company_id", ctx.company).select("id");
      if (error) return { ok: false, error: userError(error) };
      if (!data?.length) return { ok: false, error: "Hlutverkið fannst ekki" };
    } else {
      const { data, error } = await supabase.from("work_roles").insert(row).select("id").single();
      if (error) return { ok: false, error: userError(error) };
      id = data.id as string;
    }
    // Handhafar: skipta öllu út (einn á mann; ef sami er bæði fastur og vara gildir fastur).
    const seen = new Map<string, boolean>();
    for (const h of input.holders ?? []) {
      if (!UUID_RE.test(h.employeeId)) continue;
      seen.set(h.employeeId, seen.has(h.employeeId) ? seen.get(h.employeeId)! && h.backup : h.backup);
    }
    const { error: delErr } = await supabase.from("employee_work_roles").delete().eq("role_id", id).eq("company_id", ctx.company);
    if (delErr) return { ok: false, error: userError(delErr) };
    if (seen.size) {
      const { error } = await supabase.from("employee_work_roles").insert([...seen].map(([employee_id, backup]) => ({ company_id: ctx.company, role_id: id, employee_id, backup })));
      if (error) return { ok: false, error: userError(error) };
    }
    await logAudit(supabase, ctx.company, ctx.userId, { action: "Vistaði hlutverk", entity: "work_role", entityId: id!, detail: name });
    return { ok: true, id: id! };
  });
}

export async function deleteRole(id: string): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const { error, count } = await supabase.from("work_roles").delete({ count: "exact" }).eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: userError(error) };
    return count ? { ok: true } : { ok: false, error: "Hlutverkið fannst ekki" };
  });
}

/** Föst hlutverk eins starfsmanns (Starfsfólk → Hlutverk og ábyrgð). */
export async function setEmployeeRoles(employeeId: string, roles: { roleId: string; backup: boolean }[]): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    if (!UUID_RE.test(employeeId)) return { ok: false, error: "Starfsmaður fannst ekki" };
    const { error: delErr } = await supabase.from("employee_work_roles").delete().eq("employee_id", employeeId).eq("company_id", ctx.company);
    if (delErr) return { ok: false, error: userError(delErr) };
    const rows = roles.filter((r) => UUID_RE.test(r.roleId)).map((r) => ({ company_id: ctx.company, employee_id: employeeId, role_id: r.roleId, backup: !!r.backup }));
    if (rows.length) {
      const { error } = await supabase.from("employee_work_roles").insert(rows);
      if (error) return { ok: false, error: userError(error) };
    }
    revalidatePath("/starfsfolk");
    return { ok: true };
  });
}

/* ----------------------------------------------------------------- listar */

export type ListInput = Omit<TaskListDef, "id" | "items" | "active"> & {
  id?: string | null; active?: boolean; items: { id?: string | null; title: string; needsPhoto: boolean }[];
};

export async function saveList(input: ListInput): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const name = clean(input.name, 80);
    if (!name) return { ok: false, error: "Listinn þarf heiti" };
    const target: ListTarget = input.target === "role" || input.target === "employee" ? input.target : "everyone";
    const roleId = target === "role" ? idOrNull(input.roleId) : null;
    const employeeId = target === "employee" ? idOrNull(input.employeeId) : null;
    if (target === "role" && !roleId) return { ok: false, error: "Veldu hlutverk" };
    if (target === "employee" && !employeeId) return { ok: false, error: "Veldu manneskju" };
    const items = (input.items ?? []).map((i) => ({ id: idOrNull(i.id), title: clean(i.title, 200), needsPhoto: !!i.needsPhoto })).filter((i) => i.title).slice(0, 60);
    if (!items.length) return { ok: false, error: "Bættu að minnsta kosti einu atriði á listann" };
    const wd = [...new Set((input.weekdays ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort();
    const md = input.monthDay === -1 || (Number.isInteger(input.monthDay) && input.monthDay! >= 1 && input.monthDay! <= 31) ? input.monthDay : null;
    const row = {
      company_id: ctx.company, name, category: CATS.includes(input.category) ? input.category : "annad", target,
      role_id: roleId, employee_id: employeeId, location_id: idOrNull(input.locationId), shared: target === "employee" ? false : !!input.shared,
      weekdays: md ? null : wd.length && wd.length < 7 ? wd : null, month_day: md,
      due_time: input.dueTime && TIME_RE.test(input.dueTime) ? input.dueTime : null,
      remind: !!input.remind, escalate: !!input.escalate, active: input.active ?? true,
    };
    let id = idOrNull(input.id);
    if (id) {
      const { data, error } = await supabase.from("task_lists").update(row).eq("id", id).eq("company_id", ctx.company).select("id");
      if (error) return { ok: false, error: userError(error) };
      if (!data?.length) return { ok: false, error: "Listinn fannst ekki" };
    } else {
      const { data, error } = await supabase.from("task_lists").insert({ ...row, created_by: ctx.userId }).select("id").single();
      if (error) return { ok: false, error: userError(error) };
      id = data.id as string;
    }
    // Atriði: uppfæra þau sem halda id (hök haldast), eyða fjarlægðum, bæta við nýjum.
    const { data: existing } = await supabase.from("task_list_items").select("id").eq("list_id", id);
    const keep = new Set(items.map((i) => i.id).filter(Boolean) as string[]);
    const drop = (existing ?? []).map((e) => e.id as string).filter((x) => !keep.has(x));
    if (drop.length) await supabase.from("task_list_items").delete().in("id", drop);
    for (const [n, it] of items.entries()) {
      if (it.id && (existing ?? []).some((e) => e.id === it.id)) {
        await supabase.from("task_list_items").update({ title: it.title, needs_photo: it.needsPhoto, sort: n }).eq("id", it.id);
      } else {
        const { error } = await supabase.from("task_list_items").insert({ company_id: ctx.company, list_id: id, title: it.title, needs_photo: it.needsPhoto, sort: n });
        if (error) return { ok: false, error: userError(error) };
      }
    }
    await logAudit(supabase, ctx.company, ctx.userId, { action: "Vistaði verkefnalista", entity: "task_list", entityId: id!, detail: name });
    return { ok: true, id: id! };
  });
}

export async function setListActive(id: string, active: boolean): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const { data, error } = await supabase.from("task_lists").update({ active }).eq("id", id).eq("company_id", ctx.company).select("id");
    if (error) return { ok: false, error: userError(error) };
    return data?.length ? { ok: true } : { ok: false, error: "Listinn fannst ekki" };
  });
}

export async function deleteList(id: string): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const { error, count } = await supabase.from("task_lists").delete({ count: "exact" }).eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: userError(error) };
    return count ? { ok: true } : { ok: false, error: "Listinn fannst ekki" };
  });
}

/* ------------------------------------------------------ ábyrgðarfærslur */

export type HandoverInput = { fromId: string; toId: string; roleIds: string[] | "all"; start: string; end: string | null; note?: string | null };

/** Færa ábyrgð — stjórnandi fyrir hvern sem er, starfsmaður aðeins sínar eigin. Ein færsla per hlutverk (eða ein fyrir allt). */
export async function createHandover(input: HandoverInput): Promise<Res> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (!UUID_RE.test(input.fromId) || !UUID_RE.test(input.toId)) return { ok: false, error: "Veldu til hvers" };
    if (input.fromId === input.toId) return { ok: false, error: "Veldu aðra manneskju" };
    if (!ctx.manager && input.fromId !== ctx.empId) return { ok: false, error: "Þú getur aðeins fært þínar eigin ábyrgðir" };
    if (!DATE_RE.test(input.start) || (input.end && (!DATE_RE.test(input.end) || input.end < input.start))) return { ok: false, error: "Athugaðu dagsetningarnar" };
    const roles = input.roleIds === "all" ? [null] : input.roleIds.filter((r) => UUID_RE.test(r));
    if (!roles.length) return { ok: false, error: "Veldu hvaða ábyrgð á að færa" };
    const note = input.note ? clean(input.note, 500) : null;
    const { error } = await supabase.from("role_handovers").insert(roles.map((role_id) => ({
      company_id: ctx.company, from_employee_id: input.fromId, to_employee_id: input.toId, role_id,
      start_date: input.start, end_date: input.end, note, created_by: ctx.userId,
    })));
    if (error) return { ok: false, error: userError(error, "Tókst ekki að færa ábyrgðina") };
    const { data: names } = await supabase.from("coworkers").select("id, full_name").in("id", [input.fromId, input.toId]);
    const nm = (id: string) => ((names ?? []).find((n) => n.id === id)?.full_name as string | undefined)?.split(" ")[0] ?? "";
    let what = "allar ábyrgðir";
    if (input.roleIds !== "all") {
      const { data: rs } = await supabase.from("work_roles").select("name").in("id", roles as string[]);
      what = (rs ?? []).map((r) => r.name as string).join(", ");
    }
    const until = input.end ? (input.end === input.start ? "í dag" : `til ${input.end.slice(8, 10)}.${input.end.slice(5, 7)}.`) : "þar til þeim er skilað";
    await notifyEmployee(input.toId, { title: `${nm(input.fromId)} færði ábyrgð til þín`, body: `${what} · ${until}${note ? ` — „${note}“` : ""}`, url: "/mitt-svaedi#verkefni", appUrl: "/verkefni" });
    if (!ctx.manager) await notifyManagers(ctx.company, { title: "Ábyrgð færð", body: `${nm(input.fromId)} → ${nm(input.toId)}: ${what} · ${until}`, url: "/verkefni" });
    await logAudit(supabase, ctx.company, ctx.userId, { action: "Færði ábyrgð", entity: "role_handover", detail: `${nm(input.fromId)} → ${nm(input.toId)}: ${what} (${until})` });
    revalidatePath("/verkefni");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að færa ábyrgðina") };
  }
}

/** Skila ábyrgð (endar færslu strax). */
export async function returnHandover(id: string): Promise<Res> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("role_handovers").update({ returned_at: new Date().toISOString() }).eq("id", id).eq("company_id", ctx.company).select("from_employee_id, to_employee_id");
    if (error) return { ok: false, error: userError(error) };
    if (!data?.length) return { ok: false, error: "Færslan fannst ekki" };
    await notifyEmployee(data[0].to_employee_id as string, { title: "Ábyrgð skilað", body: "Ábyrgðin sem var færð til þín er komin aftur til baka.", url: "/mitt-svaedi#verkefni", appUrl: "/verkefni" });
    revalidatePath("/verkefni");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

/* --------------------------------------------------------------- skipurit */

export async function setReportsTo(employeeId: string, bossId: string | null): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    if (!UUID_RE.test(employeeId)) return { ok: false, error: "Starfsmaður fannst ekki" };
    const boss = idOrNull(bossId);
    if (boss === employeeId) return { ok: false, error: "Manneskja getur ekki verið yfir sjálfri sér" };
    if (boss) {
      // Engar hringrásir: yfirmaðurinn má ekki heyra (beint eða óbeint) undir starfsmanninn.
      const { data: all } = await supabase.from("employees").select("id, reports_to").eq("company_id", ctx.company);
      const up = new Map((all ?? []).map((e) => [e.id as string, (e.reports_to as string) ?? null]));
      for (let cur: string | null = boss, n = 0; cur && n < 100; cur = up.get(cur) ?? null, n++) {
        if (cur === employeeId) return { ok: false, error: "Það myndi búa til hring í skipuritinu" };
      }
    }
    const { data, error } = await supabase.from("employees").update({ reports_to: boss }).eq("id", employeeId).eq("company_id", ctx.company).select("id");
    if (error) return { ok: false, error: userError(error) };
    if (!data?.length) return { ok: false, error: "Starfsmaður fannst ekki" };
    revalidatePath("/starfsfolk");
    return { ok: true };
  });
}

/* ----------------------------------------------------------------- frávik */

export async function reportIncident(input: { category: string; title: string; note?: string | null; photo?: string | null; taskRef?: string | null; date?: string }): Promise<Res> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "Lýstu frávikinu í stuttu máli" };
    const category = (INC_CATS as readonly string[]).includes(input.category) ? input.category : "annad";
    const { data, error } = await supabase.from("incidents").insert({
      company_id: ctx.company, employee_id: ctx.empId, category, title,
      note: input.note ? String(input.note).trim().slice(0, 2000) : null,
      photo_url: input.photo && /^https:\/\//.test(input.photo) ? input.photo : null,
      task_ref: input.taskRef ? clean(input.taskRef, 200) : null,
      date: input.date && DATE_RE.test(input.date) ? input.date : todayISO(),
    }).select("id").single();
    if (error) return { ok: false, error: userError(error, "Tókst ekki að skrá frávikið") };
    await notifyManagers(ctx.company, { title: `Frávik: ${title}`, body: `${ctx.myName || "Starfsmaður"} skráði frávik${input.note ? ` — ${clean(input.note, 80)}` : ""}`, url: "/verkefni?tab=fravik", appUrl: "/verkefni?fravik=1" });
    revalidatePath("/verkefni");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að skrá frávikið") };
  }
}

export async function setIncidentStatus(id: string, status: "open" | "resolved"): Promise<Res> {
  return managerWrite(async (supabase, ctx) => {
    const { data, error } = await supabase.from("incidents").update({
      status, resolved_by: status === "resolved" ? ctx.userId : null, resolved_at: status === "resolved" ? new Date().toISOString() : null,
    }).eq("id", id).eq("company_id", ctx.company).select("id");
    if (error) return { ok: false, error: userError(error) };
    return data?.length ? { ok: true } : { ok: false, error: "Frávikið fannst ekki" };
  });
}

/* ------------------------------------------- starfsmannaspjald: Hlutverk */

export type EmployeeResp = {
  ok: boolean; missing?: boolean; error?: string;
  people: TaskPerson[]; roles: TaskRole[]; handovers: Handover[]; day: DayTasks | null; today: string;
};

/** Hlutverk, yfirmaður, undirmenn, færslur og verkefni dagsins fyrir einn starfsmann. */
export async function getEmployeeResp(employeeId: string): Promise<EmployeeResp> {
  const today = todayISO();
  const empty: EmployeeResp = { ok: false, people: [], roles: [], handovers: [], day: null, today };
  if (!isSupabaseConfigured() || !UUID_RE.test(employeeId)) return empty;
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ...empty, error: ctx.error };
    if (!ctx.manager) return { ...empty, error: "Aðeins stjórnendur" };
    const c = ctx.company;
    const [emps, roles, holders, hos, day] = await Promise.all([
      supabase.from("employees").select("id, full_name, title, avatar_color, photo_url, reports_to, status").eq("company_id", c).neq("status", "inactive").order("full_name"),
      supabase.from("work_roles").select("id, name, description, responsibilities, color, shift_type_id").eq("company_id", c).order("sort").order("name"),
      supabase.from("employee_work_roles").select("employee_id, role_id, backup").eq("company_id", c),
      supabase.from("role_handovers").select("*").eq("company_id", c).is("returned_at", null).or(`from_employee_id.eq.${employeeId},to_employee_id.eq.${employeeId}`),
      supabase.rpc("tasks_day", { p_date: today, p_employee: employeeId }),
    ]);
    if (roles.error && /work_roles|does not exist|schema cache/i.test(roles.error.message)) return { ...empty, missing: true };
    const holdersBy = new Map<string, TaskRole["holders"]>();
    for (const h of holders.data ?? []) {
      const k = h.role_id as string;
      if (!holdersBy.has(k)) holdersBy.set(k, []);
      holdersBy.get(k)!.push({ employeeId: h.employee_id as string, backup: !!h.backup });
    }
    return {
      ok: true, today,
      people: (emps.data ?? []).map((e) => ({ id: e.id as string, name: e.full_name as string, title: (e.title as string) ?? null, color: (e.avatar_color as string) ?? null, photo: (e.photo_url as string) ?? null, reportsTo: (e.reports_to as string) ?? null, status: e.status as string })),
      roles: (roles.data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, description: (r.description as string) ?? null, responsibilities: (r.responsibilities as string[]) ?? [], color: (r.color as string) ?? null, shiftTypeId: (r.shift_type_id as string) ?? null, holders: holdersBy.get(r.id as string) ?? [] })),
      handovers: (hos.data ?? []).filter((h) => !h.end_date || (h.end_date as string) >= today).map((h) => ({
        id: h.id as string, fromId: h.from_employee_id as string, toId: h.to_employee_id as string, roleId: (h.role_id as string) ?? null,
        start: h.start_date as string, end: (h.end_date as string) ?? null, note: (h.note as string) ?? null, returnedAt: null, createdAt: h.created_at as string,
      })),
      day: (day.data as DayTasks | null) ?? null,
    };
  } catch (e) {
    return { ...empty, error: userError(e) };
  }
}
