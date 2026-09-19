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

/** Manager adjusts a punch's clock-in and/or clock-out. Times are HH:MM; the
 * optional dates let a shift cross midnight (or fix a punch left open for days).
 * Omitted dates keep the punch's existing day; an omitted out-date follows the
 * in-date. */
export async function adjustPunch(
  punchId: string, clockInHHMM?: string, clockOutHHMM?: string,
  dates?: { inDate?: string; outDate?: string },
): Promise<ApproveResult> {
  if (!isSupabaseConfigured() || !punchId) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: punch } = await supabase.from("punches")
      .select("id, clock_in, clock_out").eq("id", punchId).eq("company_id", ctx.company).maybeSingle();
    if (!punch) return { ok: false, error: "Stimplun fannst ekki" };
    const ci = punch.clock_in as string;
    const co = punch.clock_out as string | null;
    const curInDay = ci.slice(0, 10);
    const inDay = dates?.inDate && ISO_DAY.test(dates.inDate) ? dates.inDate : curInDay;
    const inTime = clockInHHMM || hhmm(ci);
    const newIn = `${inDay}T${inTime}:00`;

    const patch: Record<string, string | null> = {};
    if (clockInHHMM || dates?.inDate) patch.clock_in = newIn;
    let newOut: string | null | undefined; // undefined = untouched
    if (clockOutHHMM !== undefined) {
      if (!clockOutHHMM) newOut = null;
      else {
        const outDay = dates?.outDate && ISO_DAY.test(dates.outDate) ? dates.outDate : (co?.slice(0, 10) ?? inDay);
        newOut = `${outDay}T${clockOutHHMM}:00`;
      }
      patch.clock_out = newOut;
    } else if (co && dates?.outDate && ISO_DAY.test(dates.outDate)) {
      newOut = `${dates.outDate}T${hhmm(co)}:00`;
      patch.clock_out = newOut;
    }
    if (!Object.keys(patch).length) return { ok: true };

    // Sanity: out must follow in, and a single punch never spans more than a day.
    const effOut = newOut === undefined ? co : newOut;
    if (effOut) {
      const span = (Date.parse(effOut.length > 19 ? effOut : effOut + "Z") - Date.parse(newIn + "Z")) / 3600e3;
      if (span <= 0) return { ok: false, error: "Útstimplun verður að vera á eftir innstimplun" };
      if (span > 24) return { ok: false, error: "Stimplun getur ekki verið lengri en 24 klst" };
    }

    const { error } = await supabase.from("punches").update(patch).eq("id", punchId).eq("company_id", ctx.company);
    if (error) return { ok: false, error: error.message };
    const dayNote = inDay !== curInDay ? ` · dags. ${inDay}` : "";
    const outNote = newOut ? ` · út ${newOut.slice(0, 10) !== inDay ? newOut.slice(0, 10) + " " : ""}${newOut.slice(11, 16)}` : "";
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "punch.adjust", entity: "punch", entityId: punchId,
      detail: `Tími leiðréttur${patch.clock_in ? ` · inn ${inTime}` : ""}${dayNote}${outNote}`,
    });
    revalidatePath("/timaskraning"); revalidatePath("/maelabord");
    return { ok: true, count: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Something off about a punch vs. the plan — shown as a tag on the row. */
export type PunchFlag =
  | { kind: "bad"; code: "open_long"; n: number }     // open for n hours (forgot to clock out)
  | { kind: "bad"; code: "long"; n: number }          // n hours, unusually long
  | { kind: "warn"; code: "short"; n: number }        // n minutes, unusually short
  | { kind: "warn"; code: "late"; n: number }         // clocked in n min after the shift start
  | { kind: "warn"; code: "early"; n: number }        // clocked out n min before the shift end
  | { kind: "warn"; code: "over"; n: number }         // n hours over the planned length
  | { kind: "warn"; code: "unscheduled" };            // no shift planned that day

export type PunchRow = {
  punchId: string; date: string; in: string; out: string | null; hours: number; source: string; approved: boolean; open: boolean;
  /** Calendar day of the clock-out when it differs from `date` (shift crossed midnight). */
  outDate: string | null;
  /** The planned shift that day, if any. */
  sched: { start: string; end: string; hours: number } | null;
  flags: PunchFlag[];
};
/** A planned shift on a past day with no punch at all. */
export type MissedShift = { date: string; start: string; end: string; hours: number };

const minsOf = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + (m || 0); };
const LATE_TOL = 15, EARLY_TOL = 15; // minutes of grace before we flag
function flagsFor(p: { open: boolean; in: string; hours: number; clockInMs: number }, sched: { start: string; end: string; hours: number } | null, nowMs: number): PunchFlag[] {
  const f: PunchFlag[] = [];
  if (p.open) {
    const openH = (nowMs - p.clockInMs) / 3600e3;
    if (openH > 14) f.push({ kind: "bad", code: "open_long", n: Math.round(openH) });
    return f;
  }
  if (p.hours > 14) f.push({ kind: "bad", code: "long", n: Math.round(p.hours * 10) / 10 });
  else if (p.hours < 0.5) f.push({ kind: "warn", code: "short", n: Math.round(p.hours * 60) });
  if (!sched) { f.push({ kind: "warn", code: "unscheduled" }); return f; }
  const inM = minsOf(p.in), outM = inM + p.hours * 60;
  const sS = minsOf(sched.start); let sE = minsOf(sched.end); if (sE <= sS) sE += 1440;
  const late = inM - sS, early = sE - outM, over = p.hours - sched.hours;
  if (late > LATE_TOL) f.push({ kind: "warn", code: "late", n: Math.round(late) });
  if (early > EARLY_TOL) f.push({ kind: "warn", code: "early", n: Math.round(early) });
  if (over > 1) f.push({ kind: "warn", code: "over", n: Math.round(over * 10) / 10 });
  return f;
}

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** All punches for one employee in a date range (per-employee detail view). */
export async function getEmployeePunches(employeeId: string, fromISO: string, toISO: string): Promise<{ ok: boolean; name: string; rows: PunchRow[]; missed: MissedShift[]; needsMigration: boolean }> {
  const empty = { ok: false, name: "", rows: [], missed: [], needsMigration: false };
  if (!isSupabaseConfigured()) return empty;
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return empty;
    const [{ data: emp }, { data: shiftRows }] = await Promise.all([
      supabase.from("employees").select("full_name").eq("id", employeeId).maybeSingle(),
      supabase.from("shifts").select("date, start_time, end_time")
        .eq("company_id", ctx.company).eq("employee_id", employeeId).gte("date", fromISO).lte("date", toISO),
    ]);
    const name = (emp?.full_name as string) ?? "";
    const from = fromISO, to = toISO + "T23:59:59";
    // Planned shifts per day, for comparing against what was actually punched.
    const byDay = new Map<string, { start: string; end: string; hours: number }[]>();
    for (const sh of shiftRows ?? []) {
      const st = (sh.start_time as string | null)?.slice(0, 5), en = (sh.end_time as string | null)?.slice(0, 5);
      if (!st || !en) continue;
      let h = (minsOf(en) - minsOf(st)) / 60; if (h < 0) h += 24;
      const d = sh.date as string;
      byDay.set(d, [...(byDay.get(d) ?? []), { start: st, end: en, hours: Math.round(h * 100) / 100 }]);
    }

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

    const nowMs = Date.now();
    const punchedDays = new Set<string>();
    const rows: PunchRow[] = (punches ?? []).map((p) => {
      const ci = p.clock_in as string;
      const co = p.clock_out as string | null;
      const hours = co ? Math.round(((new Date(co).getTime() - new Date(ci).getTime()) / 3600000) * 100) / 100 : 0;
      const date = ci.slice(0, 10), inHM = hhmm(ci), open = !co;
      punchedDays.add(date);
      // Closest planned shift that day (by start time) is the one to compare with.
      const cands = byDay.get(date) ?? [];
      const sched = cands.length ? cands.reduce((a, b) => Math.abs(minsOf(b.start) - minsOf(inHM)) < Math.abs(minsOf(a.start) - minsOf(inHM)) ? b : a) : null;
      const outDate = co ? co.slice(0, 10) : null;
      return {
        punchId: p.id as string, date, in: inHM, out: co ? hhmm(co) : null,
        hours, source: (p.source as string) ?? "web", approved: !!p.approved, open,
        outDate: outDate && outDate !== date ? outDate : null,
        sched, flags: flagsFor({ open, in: inHM, hours, clockInMs: new Date(ci).getTime() }, sched, nowMs),
      };
    });
    // Past days with a planned shift but no punch at all — a deviation too.
    const today = new Date(); const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const missed: MissedShift[] = [];
    for (const [d, list] of byDay) {
      if (d >= todayISO || punchedDays.has(d)) continue;
      for (const sh of list) missed.push({ date: d, ...sh });
    }
    missed.sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));
    return { ok: true, name, rows, missed, needsMigration };
  } catch {
    return empty;
  }
}

export type TimeReportRow = { name: string; date: string; in: string; out: string | null; hours: number; approved: boolean };

/** Company-wide punch report for a date range — one row per punch, with the
 * approval status, for Excel/PDF export. */
export async function getTimeReport(fromISO: string, toISO: string): Promise<{ ok: boolean; rows: TimeReportRow[]; company: string; demo?: boolean; needsMigration?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, rows: [], company: "" };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, rows: [], company: "" };
    const from = fromISO, to = toISO + "T23:59:59";
    const { data: comp } = await supabase.from("companies").select("name").eq("id", ctx.company).maybeSingle();

    let needsMigration = false;
    let punches: Record<string, unknown>[] | null = null;
    const withApproved = await supabase.from("punches")
      .select("clock_in, clock_out, approved, employees(full_name)")
      .eq("company_id", ctx.company).gte("clock_in", from).lte("clock_in", to)
      .order("clock_in", { ascending: true });
    if (withApproved.error) {
      needsMigration = true;
      const fb = await supabase.from("punches")
        .select("clock_in, clock_out, employees(full_name)")
        .eq("company_id", ctx.company).gte("clock_in", from).lte("clock_in", to)
        .order("clock_in", { ascending: true });
      punches = fb.data;
    } else punches = withApproved.data;

    const rows: TimeReportRow[] = (punches ?? []).map((p) => {
      const ci = p.clock_in as string;
      const co = p.clock_out as string | null;
      const emp = (Array.isArray(p.employees) ? p.employees[0] : p.employees) as { full_name?: string } | null;
      const hours = co ? Math.round(((new Date(co).getTime() - new Date(ci).getTime()) / 3600000) * 100) / 100 : 0;
      return { name: emp?.full_name ?? "—", date: ci.slice(0, 10), in: hhmm(ci), out: co ? hhmm(co) : null, hours, approved: !!p.approved };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date));
    return { ok: true, rows, company: (comp?.name as string) ?? "", needsMigration };
  } catch {
    return { ok: false, rows: [], company: "" };
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
    if (error) return { ok: false, error: "Samþykki tókst ekki — reyndu aftur" };
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
    if (error) return { ok: false, error: "Samþykki tókst ekki — reyndu aftur" };
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

/** Approve a specific set of punches in one update (checkbox selection). */
export async function approvePunchList(ids: string[]): Promise<ApproveResult> {
  if (!ids.length) return { ok: true, count: 0 };
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: ids.length };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("punches")
      .update({ approved: true, approved_by: ctx.userId, approved_at: new Date().toISOString() })
      .in("id", ids).eq("company_id", ctx.company)
      .not("clock_out", "is", null).select("id");
    if (error) return { ok: false, error: "Samþykki tókst ekki — reyndu aftur" };
    const count = data?.length ?? 0;
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "punch.approve_selected", entity: "punch", detail: `Valdar stimplanir samþykktar — ${count}`,
    });
    revalidatePath("/timaskraning");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
