"use server";

// Lokaðir dagar (closed_days, 0107): stjórnandi lokar fyrirtækinu eða einum stað á dögum (t.d. jól).
// Triggerinn shifts_closed_day_guard stöðvar nýjar vaktir á þeim dögum, sama hvaðan þær koma.

import { revalidatePath } from "next/cache";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import type { ClosedDay } from "@/lib/closed-days";

type Result = { ok: boolean; demo?: boolean; error?: string; existing?: number };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MISSING = "Uppfærslan er ekki komin í gagnagrunninn (0107).";

async function ctxOf() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: me } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!me?.company_id) return { error: "Fyrirtæki fannst ekki" as const };
  if (me.role !== "owner" && me.role !== "manager") return { error: "Aðeins stjórnendur geta lokað dögum" as const };
  return { supabase, company: me.company_id as string, userId: user.id };
}

/** Lokanir frá deginum í dag og fram í tímann (liðnar skipta ekki máli lengur). */
export async function listClosedDays(): Promise<{ ok: boolean; days: ClosedDay[]; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true, days: [] };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, days: [], error: ctx.error };
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await ctx.supabase.from("closed_days").select("id, location_id, from_date, to_date, label, locations(name)")
      .eq("company_id", ctx.company).gte("to_date", today).order("from_date").limit(200);
    if (error) return { ok: false, days: [], error: /closed_days|does not exist|schema cache/i.test(error.message) ? MISSING : userError(error) };
    return {
      ok: true,
      days: (data ?? []).map((c) => ({
        id: c.id as string, locationId: (c.location_id as string | null) ?? null, from: String(c.from_date).slice(0, 10), to: String(c.to_date).slice(0, 10),
        label: (c.label as string | null) ?? null, location: ((Array.isArray(c.locations) ? c.locations[0] : c.locations) as { name?: string } | null)?.name ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, days: [], error: userError(e, "Villa") };
  }
}

/** Loka dögum. Skilar fjölda vakta sem eru ÞEGAR á þessum dögum (þær haldast — stjórnandi ákveður). */
export async function addClosedDays(input: { from: string; to?: string; locationId?: string | null; label?: string }): Promise<Result> {
  if (await demoBlocked()) return demoResult();
  const from = input.from, to = input.to || input.from;
  if (!ISO.test(from) || !ISO.test(to)) return { ok: false, error: "Veldu dagsetningu" };
  if (to < from) return { ok: false, error: "Lokadagur getur ekki verið á undan upphafsdegi" };
  if ((Date.parse(to) - Date.parse(from)) / 86400e3 > 366) return { ok: false, error: "Mest eitt ár í einu" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    let loc: string | null = null;
    if (input.locationId) {
      const { data: l } = await ctx.supabase.from("locations").select("id").eq("id", input.locationId).eq("company_id", ctx.company).maybeSingle();
      if (!l) return { ok: false, error: "Staður fannst ekki" };
      loc = l.id as string;
    }
    const label = input.label?.trim().slice(0, 80) || null;
    const { error } = await ctx.supabase.from("closed_days").insert({ company_id: ctx.company, location_id: loc, from_date: from, to_date: to, label, created_by: ctx.userId });
    if (error) return { ok: false, error: /closed_days|does not exist|schema cache/i.test(error.message) ? MISSING : userError(error) };
    // Vaktir sem eru þegar á þessum dögum (staðar-lokun: vaktir á staðnum eða hjá starfsfólki staðarins).
    const { data: sh } = await ctx.supabase.from("shifts").select("id, location_id, employees(location_id)")
      .eq("company_id", ctx.company).eq("pending_delete", false).gte("date", from).lte("date", to).limit(1000);
    const existing = (sh ?? []).filter((s) => {
      if (!loc) return true;
      const empLoc = ((Array.isArray(s.employees) ? s.employees[0] : s.employees) as { location_id?: string | null } | null)?.location_id ?? null;
      return ((s.location_id as string | null) ?? empLoc) === loc;
    }).length;
    await logAudit(ctx.supabase, ctx.company, ctx.userId, { action: "closed_days.add", entity: "closed_days", detail: `Lokað ${from}${to !== from ? `–${to}` : ""}${label ? ` (${label})` : ""}` });
    revalidatePath("/stillingar"); revalidatePath("/vaktaplan");
    return { ok: true, existing };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function deleteClosedDays(id: string): Promise<Result> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await ctx.supabase.from("closed_days").delete().eq("id", id).eq("company_id", ctx.company);
    if (error) return { ok: false, error: userError(error) };
    await logAudit(ctx.supabase, ctx.company, ctx.userId, { action: "closed_days.delete", entity: "closed_days", detail: "Lokun opnuð aftur" });
    revalidatePath("/stillingar"); revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
