"use server";

// Starfsmannaspjald: athugasemdir stjórnenda og taxtahækkanir (migration 0107).
// Aðeins eigandi/stjórnandi — RLS á employee_notes framfylgir því líka í grunninum.

import { revalidatePath } from "next/cache";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import { normalizeSteps, type RateStep } from "@/lib/rate-steps";

type Result = { ok: boolean; demo?: boolean; error?: string };
export type EmployeeNote = { id: string; body: string; author: string | null; created: string; mine: boolean };

const MISSING = "Uppfærslan er ekki komin í gagnagrunninn (0107).";
const missing = (m?: string) => !!m && /employee_notes|rate_steps|does not exist|schema cache/i.test(m);

async function ctxOf() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: me } = await supabase.from("users").select("company_id, role, full_name").eq("id", user.id).maybeSingle();
  if (!me?.company_id) return { error: "Fyrirtæki fannst ekki" as const };
  if (me.role !== "owner" && me.role !== "manager") return { error: "Aðeins stjórnendur hafa aðgang að þessu" as const };
  return { supabase, company: me.company_id as string, userId: user.id, name: (me.full_name as string | null) ?? null };
}

/* ---------------------------------------------------------------- athugasemdir */

export async function listEmployeeNotes(employeeId: string): Promise<{ ok: boolean; live: boolean; notes: EmployeeNote[]; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true, live: false, notes: [] };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, live: false, notes: [], error: ctx.error };
    const { data, error } = await ctx.supabase.from("employee_notes").select("id, body, author_id, author_name, created_at")
      .eq("company_id", ctx.company).eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(200);
    if (error) return { ok: false, live: false, notes: [], error: missing(error.message) ? MISSING : userError(error) };
    return {
      ok: true, live: true,
      notes: (data ?? []).map((n) => ({ id: n.id as string, body: n.body as string, author: (n.author_name as string | null) ?? null, created: n.created_at as string, mine: n.author_id === ctx.userId })),
    };
  } catch (e) {
    return { ok: false, live: false, notes: [], error: userError(e, "Villa") };
  }
}

export async function addEmployeeNote(employeeId: string, body: string): Promise<Result> {
  if (await demoBlocked()) return demoResult();
  const text = (body ?? "").trim();
  if (!text) return { ok: false, error: "Skrifaðu athugasemd" };
  if (text.length > 4000) return { ok: false, error: "Athugasemdin er of löng (mest 4.000 stafir)" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emp } = await ctx.supabase.from("employees").select("id").eq("id", employeeId).eq("company_id", ctx.company).maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const { error } = await ctx.supabase.from("employee_notes").insert({
      company_id: ctx.company, employee_id: employeeId, body: text, author_id: ctx.userId, author_name: ctx.name,
    });
    if (error) return { ok: false, error: missing(error.message) ? MISSING : userError(error) };
    await logAudit(ctx.supabase, ctx.company, ctx.userId, { action: "employee.note", entity: "employee", entityId: employeeId, detail: "Athugasemd skráð" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function deleteEmployeeNote(id: string): Promise<Result> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await ctx.supabase.from("employee_notes").delete().eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: userError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/* ---------------------------------------------------------------- taxtahækkanir */

export async function getRateSteps(employeeId: string): Promise<{ ok: boolean; live: boolean; steps: RateStep[]; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true, live: false, steps: [] };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, live: false, steps: [], error: ctx.error };
    const { data, error } = await ctx.supabase.from("employees").select("rate_steps").eq("id", employeeId).eq("company_id", ctx.company).maybeSingle();
    if (error) return { ok: false, live: false, steps: [], error: missing(error.message) ? MISSING : userError(error) };
    return { ok: true, live: true, steps: normalizeSteps(data?.rate_steps) };
  } catch (e) {
    return { ok: false, live: false, steps: [], error: userError(e, "Villa") };
  }
}

export async function saveRateSteps(employeeId: string, steps: RateStep[]): Promise<Result & { steps?: RateStep[] }> {
  if (await demoBlocked()) return demoResult();
  const clean = normalizeSteps(steps);
  if (!isSupabaseConfigured()) return { ok: true, demo: true, steps: clean };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await ctx.supabase.from("employees").update({ rate_steps: clean })
      .eq("id", employeeId).eq("company_id", ctx.company).select("full_name").maybeSingle();
    if (error) return { ok: false, error: missing(error.message) ? MISSING : userError(error) };
    if (!data) return { ok: false, error: "Starfsmaður fannst ekki" };
    await logAudit(ctx.supabase, ctx.company, ctx.userId, {
      action: "employee.rate_steps", entity: "employee", entityId: employeeId,
      detail: `Taxtahækkanir ${data.full_name}: ${clean.filter((s) => !s.doneAt).length} framundan`,
    });
    revalidatePath(`/starfsfolk/${employeeId}`);
    return { ok: true, steps: clean };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
