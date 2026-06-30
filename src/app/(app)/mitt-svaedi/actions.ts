"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";

export type PunchResult = { ok: boolean; demo?: boolean; error?: string };
export type ActionResult = { ok: boolean; demo?: boolean; error?: string };

/** Resolve the signed-in user's employee id + company. */
async function currentEmployee(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: emp } = await supabase
    .from("employees")
    .select("id, company_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!emp) return { error: "Starfsmannaprófíll fannst ekki" as const };
  return { userId: user.id, empId: emp.id as string, company: emp.company_id as string };
}

export type MyPunchRow = { punchId: string; date: string; in: string; out: string | null; hours: number; source: string; open: boolean };

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** The signed-in employee's own punches in a date range. */
export async function getMyPunches(fromISO: string, toISO: string): Promise<{ ok: boolean; rows: MyPunchRow[] }> {
  if (!isSupabaseConfigured()) return { ok: false, rows: [] };
  try {
    const supabase = await createClient();
    const ctx = await currentEmployee(supabase);
    if ("error" in ctx) return { ok: false, rows: [] };
    const { data } = await supabase
      .from("punches").select("id, clock_in, clock_out, source")
      .eq("company_id", ctx.company).eq("employee_id", ctx.empId)
      .gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59")
      .order("clock_in", { ascending: false });
    const rows: MyPunchRow[] = (data ?? []).map((p) => {
      const ci = p.clock_in as string, co = p.clock_out as string | null;
      return {
        punchId: p.id as string, date: ci.slice(0, 10), in: hhmm(ci), out: co ? hhmm(co) : null,
        hours: co ? Math.round(((new Date(co).getTime() - new Date(ci).getTime()) / 3600000) * 100) / 100 : 0,
        source: (p.source as string) ?? "app", open: !co,
      };
    });
    return { ok: true, rows };
  } catch {
    return { ok: false, rows: [] };
  }
}

/** Employee requests a correction to a punch (forgot to clock in/out, wrong time). */
export async function requestCorrection(input: { punchId?: string; date: string; requestedIn?: string; requestedOut?: string; reason: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await currentEmployee(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("punch_corrections").insert({
      company_id: ctx.company, employee_id: ctx.empId, punch_id: input.punchId ?? null,
      date: input.date, requested_in: input.requestedIn || null, requested_out: input.requestedOut || null,
      reason: input.reason, status: "pending",
    });
    if (error) return { ok: false, error: "Keyrðu migration 0010 í Supabase til að virkja leiðréttingabeiðnir." };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "correction.request", entity: "punch_correction", detail: `Leiðréttingabeiðni — ${input.date}${input.reason ? ` (${input.reason})` : ""}`,
    });
    revalidatePath("/timaskraning");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Clock the currently signed-in employee in or out (source: app). */
export async function myPunch(into: boolean): Promise<PunchResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };

    const { data: emp } = await supabase
      .from("employees")
      .select("id, company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmannaprófíll fannst ekki" };

    const now = new Date().toISOString();
    if (into) {
      const { error } = await supabase.from("punches").insert({
        company_id: emp.company_id,
        employee_id: emp.id,
        clock_in: now,
        source: "app",
      });
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: open } = await supabase
        .from("punches")
        .select("id")
        .eq("employee_id", emp.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open) {
        const { error } = await supabase.from("punches").update({ clock_out: now }).eq("id", open.id);
        if (error) return { ok: false, error: error.message };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type LeaveType = "orlof" | "veikindi" | "olaunad";

/** Employee submits a leave request (orlof/veikindi/ólaunað). */
export async function submitLeaveRequest(
  input: { fromDate: string; toDate: string; type: LeaveType },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const me = await currentEmployee(supabase);
    if ("error" in me) return { ok: false, error: me.error };
    const { error } = await supabase.from("leave_requests").insert({
      company_id: me.company,
      employee_id: me.empId,
      type: input.type,
      from_date: input.fromDate,
      to_date: input.toDate,
      status: "pending",
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, me.company, me.userId, {
      action: "leave.request", entity: "leave_request",
      detail: `Frí-beiðni skráð — ${input.type} ${input.fromDate}–${input.toDate}`,
    });
    revalidatePath("/mitt-svaedi");
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Employee requests a shift swap with a colleague. */
export async function requestShiftSwap(
  input: { note: string; requesteeName?: string },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const me = await currentEmployee(supabase);
    if ("error" in me) return { ok: false, error: me.error };
    let requesteeId: string | null = null;
    if (input.requesteeName) {
      const { data: other } = await supabase
        .from("employees").select("id, full_name").eq("company_id", me.company);
      requesteeId = other?.find((o) =>
        (o.full_name as string).toLowerCase().startsWith(input.requesteeName!.toLowerCase()))?.id as string ?? null;
    }
    const { error } = await supabase.from("shift_swaps").insert({
      company_id: me.company,
      requester_id: me.empId,
      requestee_id: requesteeId,
      note: input.note,
      status: "pending",
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, me.company, me.userId, {
      action: "swap.request", entity: "shift_swap", detail: `Vaktaskipti óskað — ${input.note}`,
    });
    revalidatePath("/mitt-svaedi");
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Employee records weekly availability (weekdays: 0=Mán … 6=Sun). */
export async function setAvailability(
  input: { weekdays: number[]; available?: boolean; reason?: string },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const me = await currentEmployee(supabase);
    if ("error" in me) return { ok: false, error: me.error };
    const { error } = await supabase.from("availability").insert({
      company_id: me.company,
      employee_id: me.empId,
      available: input.available ?? true,
      weekdays: input.weekdays,
      reason: input.reason ?? null,
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, me.company, me.userId, {
      action: "availability.set", entity: "availability", detail: "Framboð uppfært",
    });
    revalidatePath("/mitt-svaedi");
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Employee updates their own contact details. */
export async function updateMyProfile(
  input: { phone?: string; email?: string; bankAccount?: string },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const me = await currentEmployee(supabase);
    if ("error" in me) return { ok: false, error: me.error };
    const patch: Record<string, unknown> = {};
    if (input.phone !== undefined) patch.phone = input.phone || null;
    if (input.email !== undefined) patch.email = input.email || null;
    if (input.bankAccount !== undefined) patch.bank_account = input.bankAccount || null;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("employees").update(patch).eq("id", me.empId);
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, me.company, me.userId, {
      action: "employee.profile", entity: "employee", detail: "Prófíll uppfærður (eigin)",
    });
    revalidatePath("/mitt-svaedi");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Employee applies for an open shift. Recorded as a pending pickup request. */
export async function applyForShift(input: { note: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const me = await currentEmployee(supabase);
    if ("error" in me) return { ok: false, error: me.error };
    const { error } = await supabase.from("shift_swaps").insert({
      company_id: me.company,
      requester_id: me.empId,
      note: `Umsókn um opna vakt: ${input.note}`,
      status: "pending",
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, me.company, me.userId, {
      action: "shift.apply", entity: "shift_swap", detail: `Sótt um opna vakt — ${input.note}`,
    });
    revalidatePath("/mitt-svaedi");
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Upload a profile photo (data URL) to the avatars bucket and save photo_url. */
export async function uploadPhoto(dataUrl: string): Promise<ActionResult & { url?: string }> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const me = await currentEmployee(supabase);
    if ("error" in me) return { ok: false, error: me.error };

    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return { ok: false, error: "Ógilt myndsnið" };
    const mime = m[1];
    const ext = mime.split("/")[1].replace("jpeg", "jpg").replace("+xml", "");
    const bytes = Buffer.from(m[2], "base64");
    const path = `${me.company}/${me.empId}/photo-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars").upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase
      .from("employees").update({ photo_url: url }).eq("id", me.empId);
    if (updErr) return { ok: false, error: updErr.message };

    await logAudit(supabase, me.company, me.userId, {
      action: "employee.photo", entity: "employee", detail: "Prófílmynd uppfærð",
    });
    revalidatePath("/mitt-svaedi");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
