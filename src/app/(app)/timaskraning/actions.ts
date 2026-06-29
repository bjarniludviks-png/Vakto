"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { getWeekAttendance, type AttRow } from "@/lib/analytics.server";

export type ApproveResult = { ok: boolean; demo?: boolean; count?: number; error?: string };

/** Re-fetch attendance rows for a custom date range (client filter bar). */
export async function fetchAttendance(fromISO: string, toISO: string): Promise<{ ok: boolean; rows: AttRow[] }> {
  const res = await getWeekAttendance(fromISO, toISO);
  return { ok: res.live, rows: res.rows };
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

/** Manager approves a single timesheet. */
export async function approveTimesheet(id: string): Promise<ApproveResult> {
  if (!isSupabaseConfigured() || !id) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase
      .from("timesheets").update({ status: "approved" }).eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "timesheet.approve", entity: "timesheet", entityId: id, detail: "Tímaskráning samþykkt",
    });
    revalidatePath("/timaskraning");
    return { ok: true, count: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Fill a missing clock-out for an employee's latest open punch (today). */
export async function setClockOut(input: { employeeName: string; time: string }): Promise<ApproveResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emp } = await supabase
      .from("employees").select("id, full_name").eq("company_id", ctx.company);
    const id = emp?.find((e) => (e.full_name as string).toLowerCase().startsWith(input.employeeName.toLowerCase()))?.id as string | undefined;
    if (!id) return { ok: false, error: "Starfsmaður fannst ekki" };
    const { data: open } = await supabase
      .from("punches").select("id, clock_in").eq("employee_id", id)
      .is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle();
    if (!open) return { ok: true, demo: true };
    const day = (open.clock_in as string).slice(0, 10);
    const { error } = await supabase
      .from("punches").update({ clock_out: `${day}T${input.time}:00` }).eq("id", open.id);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "punch.clockout", entity: "punch", detail: `Útstimplun sett — ${input.employeeName} ${input.time}`,
    });
    revalidatePath("/timaskraning");
    return { ok: true, count: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Manager approves all pending timesheets for the company. */
export async function approveAllTimesheets(): Promise<ApproveResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase
      .from("timesheets").update({ status: "approved" })
      .eq("company_id", ctx.company).eq("status", "pending").select("id");
    if (error) return { ok: false, error: error.message };
    const count = data?.length ?? 0;
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "timesheet.approve_all", entity: "timesheet", detail: `Allar tímaskráningar samþykktar — ${count}`,
    });
    revalidatePath("/timaskraning");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
