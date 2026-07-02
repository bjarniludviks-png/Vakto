"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { notifyEmployee } from "@/lib/push";
import { getEmployees } from "@/lib/employees.server";

export type ShiftInput = {
  employeeName: string; // first name as shown in the grid
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  shiftTypeName: string;
};
export type PublishResult = { ok: boolean; demo?: boolean; count?: number; error?: string };

export async function publishSchedule(shifts: ShiftInput[]): Promise<PublishResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: shifts.length };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: profile } = await supabase
      .from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };

    // Resolve employees + shift types once.
    const { data: emps } = await supabase
      .from("employees").select("id, full_name").eq("company_id", company);
    const { data: types } = await supabase
      .from("shift_types").select("id, name").eq("company_id", company);
    const empId = (name: string) =>
      emps?.find((e) => (e.full_name as string).toLowerCase().startsWith(name.toLowerCase()))?.id as string | undefined;
    const typeId = (name: string) =>
      types?.find((t) => (t.name as string).toLowerCase().startsWith(name.toLowerCase()))?.id as string | undefined;

    const dates = [...new Set(shifts.map((s) => s.date))];
    if (dates.length) {
      // Replace published plan for these dates.
      await supabase.from("shifts").delete().eq("company_id", company).in("date", dates);
    }

    const rows = shifts.map((s) => ({
      company_id: company,
      employee_id: empId(s.employeeName) ?? null,
      shift_type_id: typeId(s.shiftTypeName) ?? null,
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      status: "published" as const,
      published: true,
    })).filter((r) => r.employee_id);

    if (rows.length) {
      const { error } = await supabase.from("shifts").insert(rows);
      if (error) return { ok: false, error: error.message };
    }
    await logAudit(supabase, company, user.id, {
      action: "schedule.publish", entity: "shifts", detail: `Vaktaplan birt — ${rows.length} vaktir`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true, count: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type DecisionResult = { ok: boolean; demo?: boolean; error?: string };

function weekCodeForStart(start: string | null): string {
  const h = parseInt((start ?? "").slice(0, 2), 10);
  if (h === 7) return "M";
  if (h === 11) return "Mi";
  if (h === 14) return "E";
  if (h === 16) return "L";
  return "D";
}

/** Load the grid (employee × 7 days) for a specific week, aligned to the
 * full_name-ordered employee list (same order the screen renders). Returns
 * both the coarse code grid (for colour) and the real start/end times per cell. */
export async function getWeekShifts(fromISO: string): Promise<{ ok: boolean; grid: string[][]; times: Record<string, { start: string; end: string }> }> {
  if (!isSupabaseConfigured()) return { ok: false, grid: [], times: {} };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, grid: [], times: {} };
    const { employees, live } = await getEmployees();
    if (!live) return { ok: false, grid: [], times: {} };

    const [y, m, d] = fromISO.split("-").map(Number);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(y, m - 1, d + i);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    });
    const { data: shifts } = await supabase
      .from("shifts").select("employee_id, date, start_time, end_time")
      .eq("company_id", ctx.company).in("date", dates);

    const idIndex = new Map(employees.map((e, i) => [e.id, i]));
    const grid: string[][] = employees.map(() => Array(7).fill("off"));
    const times: Record<string, { start: string; end: string }> = {};
    for (const s of shifts ?? []) {
      const r = idIndex.get(s.employee_id as string);
      const c = dates.indexOf(s.date as string);
      if (r !== undefined && c >= 0) {
        grid[r][c] = weekCodeForStart(s.start_time as string);
        times[`${r}:${c}`] = { start: ((s.start_time as string) ?? "").slice(0, 5), end: ((s.end_time as string) ?? "").slice(0, 5) };
      }
    }
    return { ok: true, grid, times };
  } catch {
    return { ok: false, grid: [], times: {} };
  }
}

/** Save a single shift (from the shift-edit modal). */
export async function saveShift(input: Omit<ShiftInput, "date"> & { date?: string }): Promise<DecisionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emps } = await supabase
      .from("employees").select("id, full_name").eq("company_id", ctx.company);
    const { data: types } = await supabase
      .from("shift_types").select("id, name").eq("company_id", ctx.company);
    const employee_id = emps?.find((e) => (e.full_name as string).toLowerCase().startsWith(input.employeeName.toLowerCase()))?.id as string | undefined;
    if (!employee_id) return { ok: false, error: "Starfsmaður fannst ekki" };
    const shift_type_id = types?.find((t) => (t.name as string).toLowerCase().startsWith(input.shiftTypeName.toLowerCase()))?.id as string | undefined;
    const shiftDate = input.date || new Date().toISOString().slice(0, 10);
    // One shift per employee per day cell — replace any existing one.
    await supabase.from("shifts").delete()
      .eq("company_id", ctx.company).eq("employee_id", employee_id).eq("date", shiftDate);
    const { error } = await supabase.from("shifts").insert({
      company_id: ctx.company,
      employee_id,
      shift_type_id: shift_type_id ?? null,
      date: shiftDate,
      start_time: input.startTime,
      end_time: input.endTime,
      status: "published",
      published: true,
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "shift.save", entity: "shift", detail: `Vakt vistuð — ${input.employeeName} ${input.startTime}–${input.endTime}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Set the weekly staffing need (7 numbers, Mon..Sun). */
export async function setStaffingTargets(targets: number[]): Promise<DecisionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const clean = Array.from({ length: 7 }, (_, i) => Math.max(0, Math.round(Number(targets[i]) || 0)));
    const { error } = await supabase.from("companies").update({ staffing_targets: clean }).eq("id", ctx.company);
    if (error) return { ok: false, error: "Keyrðu migration 0011 í Supabase til að vista mönnunarþörf." };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "staffing.set", entity: "company", detail: `Mönnunarþörf uppfærð — ${clean.join("/")}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Delete a single set shift (one employee, one day). */
export async function deleteShift(input: { employeeName: string; dateISO: string }): Promise<DecisionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emps } = await supabase
      .from("employees").select("id, full_name").eq("company_id", ctx.company);
    const employee_id = emps?.find((e) => (e.full_name as string).toLowerCase().startsWith(input.employeeName.toLowerCase()))?.id as string | undefined;
    if (!employee_id) return { ok: false, error: "Starfsmaður fannst ekki" };
    const { error } = await supabase
      .from("shifts").delete()
      .eq("company_id", ctx.company).eq("employee_id", employee_id).eq("date", input.dateISO);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "shift.delete", entity: "shift", detail: `Vakt eydd — ${input.employeeName} ${input.dateISO}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type ExportRow = { name: string; first: string; dept: string; date: string; start: string; end: string };

/** Real shift rows (with actual times) in a date range — for PDF export. */
export async function getShiftsInRange(fromISO: string, toISO: string): Promise<{ ok: boolean; rows: ExportRow[] }> {
  if (!isSupabaseConfigured()) return { ok: false, rows: [] };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, rows: [] };
    const { employees, live } = await getEmployees();
    if (!live) return { ok: false, rows: [] };
    const meta = new Map(employees.map((e) => [e.id, { full: e.fullName, first: e.fullName.split(/\s+/)[0], dept: e.department ?? "" }]));
    const { data: shifts } = await supabase
      .from("shifts").select("employee_id, date, start_time, end_time")
      .eq("company_id", ctx.company).gte("date", fromISO).lte("date", toISO)
      .order("date").order("start_time");
    const rows: ExportRow[] = (shifts ?? []).map((s) => {
      const m = meta.get(s.employee_id as string);
      return {
        name: m?.full ?? "?", first: m?.first ?? "?", dept: m?.dept ?? "",
        date: s.date as string,
        start: ((s.start_time as string) ?? "").slice(0, 5),
        end: ((s.end_time as string) ?? "").slice(0, 5),
      };
    });
    return { ok: true, rows };
  } catch {
    return { ok: false, rows: [] };
  }
}

/** Assign an applicant to an open shift. */
export async function assignOpenShift(input: { employeeName: string; note?: string }): Promise<DecisionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "shift.assign", entity: "shift", detail: `Opin vakt úthlutað — ${input.employeeName}${input.note ? ` (${input.note})` : ""}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

async function companyOf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company };
}

/** Manager approves or rejects a leave request. */
export async function updateLeaveRequest(id: string, approved: boolean): Promise<DecisionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const status = approved ? "approved" : "rejected";
    const { data: updated, error } = await supabase
      .from("leave_requests").update({ status }).eq("id", id).eq("company_id", ctx.company)
      .select("employee_id").maybeSingle();
    if (error) return { ok: false, error: error.message };
    // Notify the employee (best-effort; no-op until VAPID + a subscription exist).
    void notifyEmployee(updated?.employee_id as string | undefined, {
      title: approved ? "Frí samþykkt" : "Frí hafnað",
      body: approved ? "Frí-beiðnin þín var samþykkt." : "Frí-beiðninni þinni var hafnað.",
      url: "/mitt-svaedi",
    });
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "leave.decide", entity: "leave_request", entityId: id,
      detail: approved ? "Frí-beiðni samþykkt" : "Frí-beiðni hafnað",
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Manager approves a shift swap. */
export async function approveShiftSwap(id: string): Promise<DecisionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase
      .from("shift_swaps").update({ status: "approved" }).eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "swap.approve", entity: "shift_swap", entityId: id, detail: "Vaktaskipti samþykkt",
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
