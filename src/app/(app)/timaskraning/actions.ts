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

/** Manager manually clocks an employee in (forgot to punch). */
export async function managerClockIn(employeeId: string, timeHHMM?: string): Promise<ApproveResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    // Skip if already clocked in today.
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase.from("punches").select("id")
      .eq("company_id", ctx.company).eq("employee_id", employeeId).is("clock_out", null)
      .gte("clock_in", start.toISOString()).maybeSingle();
    if (existing) return { ok: false, error: "Þegar skráð(ur) inn" };
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = timeHHMM || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const { error } = await supabase.from("punches").insert({
      company_id: ctx.company, employee_id: employeeId, clock_in: `${day}T${time}:00`, source: "web",
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "punch.clockin", entity: "punch", detail: `Handvirk innstimplun ${time}`,
    });
    revalidatePath("/timaskraning"); revalidatePath("/maelabord");
    return { ok: true, count: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Manager deletes a punch entirely. */
export async function deletePunch(punchId: string): Promise<ApproveResult> {
  if (!isSupabaseConfigured() || !punchId) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("punches").delete().eq("id", punchId).eq("company_id", ctx.company);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "punch.delete", entity: "punch", entityId: punchId, detail: "Stimplun eydd",
    });
    revalidatePath("/timaskraning"); revalidatePath("/maelabord");
    return { ok: true, count: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Manager adjusts a punch's clock-in and/or clock-out time (same day). */
export async function adjustPunch(punchId: string, clockInHHMM?: string, clockOutHHMM?: string): Promise<ApproveResult> {
  if (!isSupabaseConfigured() || !punchId) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: punch } = await supabase.from("punches")
      .select("id, clock_in").eq("id", punchId).eq("company_id", ctx.company).maybeSingle();
    if (!punch) return { ok: false, error: "Stimplun fannst ekki" };
    const day = (punch.clock_in as string).slice(0, 10);
    const patch: Record<string, string | null> = {};
    if (clockInHHMM) patch.clock_in = `${day}T${clockInHHMM}:00`;
    if (clockOutHHMM !== undefined) patch.clock_out = clockOutHHMM ? `${day}T${clockOutHHMM}:00` : null;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabase.from("punches").update(patch).eq("id", punchId).eq("company_id", ctx.company);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "punch.adjust", entity: "punch", entityId: punchId,
      detail: `Tími leiðréttur${clockInHHMM ? ` · inn ${clockInHHMM}` : ""}${clockOutHHMM ? ` · út ${clockOutHHMM}` : ""}`,
    });
    revalidatePath("/timaskraning"); revalidatePath("/maelabord");
    return { ok: true, count: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type PunchRow = { punchId: string; date: string; in: string; out: string | null; hours: number; source: string; approved: boolean; open: boolean };

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** All punches for one employee in a date range (per-employee detail view). */
export async function getEmployeePunches(employeeId: string, fromISO: string, toISO: string): Promise<{ ok: boolean; name: string; rows: PunchRow[]; needsMigration: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, name: "", rows: [], needsMigration: false };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, name: "", rows: [], needsMigration: false };
    const { data: emp } = await supabase.from("employees").select("full_name").eq("id", employeeId).maybeSingle();
    const name = (emp?.full_name as string)?.split(/\s+/)[0] ?? "";
    const from = fromISO, to = toISO + "T23:59:59";

    let needsMigration = false;
    let punches: Record<string, unknown>[] | null = null;
    const withApproved = await supabase.from("punches")
      .select("id, clock_in, clock_out, source, approved")
      .eq("company_id", ctx.company).eq("employee_id", employeeId)
      .gte("clock_in", from).lte("clock_in", to).order("clock_in", { ascending: false });
    if (withApproved.error) {
      needsMigration = true;
      const fallback = await supabase.from("punches")
        .select("id, clock_in, clock_out, source")
        .eq("company_id", ctx.company).eq("employee_id", employeeId)
        .gte("clock_in", from).lte("clock_in", to).order("clock_in", { ascending: false });
      punches = fallback.data;
    } else {
      punches = withApproved.data;
    }

    const rows: PunchRow[] = (punches ?? []).map((p) => {
      const ci = p.clock_in as string;
      const co = p.clock_out as string | null;
      const hours = co ? Math.round(((new Date(co).getTime() - new Date(ci).getTime()) / 3600000) * 100) / 100 : 0;
      return {
        punchId: p.id as string, date: ci.slice(0, 10), in: hhmm(ci), out: co ? hhmm(co) : null,
        hours, source: (p.source as string) ?? "web", approved: !!p.approved, open: !co,
      };
    });
    return { ok: true, name, rows, needsMigration };
  } catch {
    return { ok: false, name: "", rows: [], needsMigration: false };
  }
}

/** Approve / unapprove a single punch. */
export async function setPunchApproved(punchId: string, approved: boolean): Promise<ApproveResult> {
  if (!isSupabaseConfigured() || !punchId) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("punches")
      .update({ approved, approved_by: approved ? ctx.userId : null, approved_at: approved ? new Date().toISOString() : null })
      .eq("id", punchId).eq("company_id", ctx.company);
    if (error) return { ok: false, error: "Keyrðu migration 0008 í Supabase til að virkja samþykki." };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: approved ? "punch.approve" : "punch.unapprove", entity: "punch", entityId: punchId,
      detail: approved ? "Vakt samþykkt" : "Samþykki afturkallað",
    });
    revalidatePath("/timaskraning");
    return { ok: true, count: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Approve all closed punches for an employee in a range. */
export async function approveEmployeePunches(employeeId: string, fromISO: string, toISO: string): Promise<ApproveResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("punches")
      .update({ approved: true, approved_by: ctx.userId, approved_at: new Date().toISOString() })
      .eq("company_id", ctx.company).eq("employee_id", employeeId)
      .gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59")
      .not("clock_out", "is", null).select("id");
    if (error) return { ok: false, error: "Keyrðu migration 0008 í Supabase til að virkja samþykki." };
    const count = data?.length ?? 0;
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "punch.approve_range", entity: "punch", detail: `Vaktir samþykktar — ${count}`,
    });
    revalidatePath("/timaskraning");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type CorrectionRow = { id: string; name: string; date: string; requestedIn: string | null; requestedOut: string | null; reason: string; punchId: string | null };

/** Pending employee correction requests for managers. */
export async function getCorrections(): Promise<{ ok: boolean; rows: CorrectionRow[] }> {
  if (!isSupabaseConfigured()) return { ok: false, rows: [] };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, rows: [] };
    const res = await supabase
      .from("punch_corrections")
      .select("id, date, requested_in, requested_out, reason, punch_id, employees(full_name)")
      .eq("company_id", ctx.company).eq("status", "pending").order("created_at", { ascending: false });
    if (res.error) return { ok: false, rows: [] };
    const rows: CorrectionRow[] = (res.data ?? []).map((c) => {
      const emp = (Array.isArray(c.employees) ? c.employees[0] : c.employees) as { full_name?: string } | null;
      return {
        id: c.id as string, name: (emp?.full_name ?? "?").split(/\s+/)[0],
        date: c.date as string,
        requestedIn: (c.requested_in as string)?.slice(0, 5) ?? null,
        requestedOut: (c.requested_out as string)?.slice(0, 5) ?? null,
        reason: (c.reason as string) ?? "", punchId: (c.punch_id as string) ?? null,
      };
    });
    return { ok: true, rows };
  } catch {
    return { ok: false, rows: [] };
  }
}

/** Manager approves (applies) or rejects an employee correction request. */
export async function decideCorrection(id: string, approve: boolean): Promise<ApproveResult> {
  if (!isSupabaseConfigured() || !id) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: c } = await supabase
      .from("punch_corrections").select("id, employee_id, punch_id, date, requested_in, requested_out")
      .eq("id", id).eq("company_id", ctx.company).maybeSingle();
    if (!c) return { ok: false, error: "Beiðni fannst ekki" };

    if (approve) {
      const day = c.date as string;
      const ri = c.requested_in as string | null, ro = c.requested_out as string | null;
      if (c.punch_id) {
        const patch: Record<string, string | null> = {};
        if (ri) patch.clock_in = `${day}T${ri.slice(0, 5)}:00`;
        if (ro) patch.clock_out = `${day}T${ro.slice(0, 5)}:00`;
        if (Object.keys(patch).length) await supabase.from("punches").update(patch).eq("id", c.punch_id).eq("company_id", ctx.company);
      } else if (ri) {
        await supabase.from("punches").insert({
          company_id: ctx.company, employee_id: c.employee_id,
          clock_in: `${day}T${ri.slice(0, 5)}:00`, clock_out: ro ? `${day}T${ro.slice(0, 5)}:00` : null, source: "web",
        });
      }
    }
    const { error } = await supabase.from("punch_corrections")
      .update({ status: approve ? "approved" : "rejected" }).eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: approve ? "correction.approve" : "correction.reject", entity: "punch_correction", entityId: id,
      detail: approve ? "Leiðrétting samþykkt" : "Leiðréttingu hafnað",
    });
    revalidatePath("/timaskraning"); revalidatePath("/maelabord");
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
