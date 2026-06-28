"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";

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
    const { error } = await supabase.from("shifts").insert({
      company_id: ctx.company,
      employee_id,
      shift_type_id: shift_type_id ?? null,
      date: input.date || new Date().toISOString().slice(0, 10),
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
    const { error } = await supabase
      .from("leave_requests").update({ status }).eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: error.message };
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
