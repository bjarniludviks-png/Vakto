"use server";

// Vaktarar og skýrslur (0086) — Stillingar og VAKTO AI nota sömu aðgerðir. Aðeins eigendur og vaktstjórar;
// RLS á alert_rules tryggir það líka. Þolir að taflan vanti (missing: true → viðmótið segir frá því).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { describeAlert, normalizeAlert, REPORTS, type AlertRule, type AlertReport } from "@/lib/alerts";
import { ruleFromRow, emailReport, reportRange } from "@/lib/alerts.server";
import { getManagerReport } from "@/app/(app)/skyrslur/actions";

type Ctx = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; companyId: string; email: string | null };
type Res = { ok: boolean; error?: string; missing?: boolean };

async function ctx(): Promise<Ctx | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Gagnagrunnur er ekki tengdur" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" };
  const { data: u } = await supabase.from("users").select("company_id, role, email").eq("id", user.id).maybeSingle();
  if (!u?.company_id) return { error: "Fyrirtæki fannst ekki" };
  if (u.role !== "owner" && u.role !== "manager") return { error: "Aðeins stjórnendur og vaktstjórar" };
  return { supabase, userId: user.id, companyId: u.company_id as string, email: (u.email as string | null) ?? user.email ?? null };
}

const isMissing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /alert_rules/.test(e.message ?? ""));

export type AlertsData = { ok: boolean; missing?: boolean; error?: string; rules: AlertRule[]; people: { id: string; name: string; role: string }[]; me: string | null };

export async function listAlerts(): Promise<AlertsData> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error, rules: [], people: [], me: null };
  const [{ data, error }, { data: ppl }] = await Promise.all([
    c.supabase.from("alert_rules").select("*").eq("company_id", c.companyId).order("created_at"),
    c.supabase.from("users").select("id, full_name, role").eq("company_id", c.companyId).in("role", ["owner", "manager"]),
  ]);
  const people = (ppl ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string) || "?", role: p.role as string }));
  if (error) return { ok: false, missing: isMissing(error), error: isMissing(error) ? undefined : "Tókst ekki að sækja vaktarana", rules: [], people, me: c.userId };
  return { ok: true, rules: (data ?? []).map(ruleFromRow).filter((r): r is AlertRule => !!r), people, me: c.userId };
}

/** Nýr vaktari eða skýrsla á tímaáætlun. `via` merkir reglur sem VAKTO AI bjó til. */
export async function createAlert(input: unknown, via: "ui" | "ai" = "ui"): Promise<Res & { id?: string }> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  const n = normalizeAlert(input);
  if (!n.ok) return n;
  const r = n.rule;
  // Viðtakendur verða að vera eigendur/vaktstjórar sama fyrirtækis.
  let recipients = r.recipients;
  if (recipients.length) {
    const { data } = await c.supabase.from("users").select("id").eq("company_id", c.companyId).in("role", ["owner", "manager"]).in("id", recipients);
    recipients = (data ?? []).map((x) => x.id as string);
  }
  if (!recipients.length) recipients = [c.userId];
  const description = r.description || describeAlert(r, "is");
  const { data, error } = await c.supabase.from("alert_rules").insert({
    company_id: c.companyId, created_by: c.userId, kind: r.kind, params: r.params, channel: r.channel,
    recipients, schedule: r.schedule, active: true, created_via: via === "ai" ? "ai" : "ui", description,
  }).select("id").single();
  if (error) {
    console.error("[alerts] create", error.message);
    return { ok: false, missing: isMissing(error), error: isMissing(error) ? "Vaktarar eru ekki komnir í gagnagrunninn enn — hafðu samband við VAKTO." : "Tókst ekki að vista vaktarann" };
  }
  await logAudit(c.supabase, c.companyId, c.userId, { action: "Vaktari stofnaður", entity: "alert_rule", entityId: data.id as string, detail: description });
  revalidatePath("/stillingar");
  return { ok: true, id: data.id as string };
}

export async function setAlertActive(id: string, active: boolean): Promise<Res> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  const { data, error } = await c.supabase.from("alert_rules").update({ active: !!active, updated_at: new Date().toISOString() })
    .eq("id", id).eq("company_id", c.companyId).select("id");
  if (error || !data?.length) return { ok: false, missing: isMissing(error), error: "Vaktari fannst ekki" };
  revalidatePath("/stillingar");
  return { ok: true };
}

export async function deleteAlert(id: string): Promise<Res> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  const { data, error } = await c.supabase.from("alert_rules").delete().eq("id", id).eq("company_id", c.companyId).select("id, description");
  if (error || !data?.length) return { ok: false, missing: isMissing(error), error: "Vaktari fannst ekki" };
  await logAudit(c.supabase, c.companyId, c.userId, { action: "Vaktara eytt", entity: "alert_rule", entityId: id, detail: (data[0].description as string) ?? "" });
  revalidatePath("/stillingar");
  return { ok: true };
}

/** Sendir skýrslu úr Skýrslusafninu strax á netfang notandans sem biður um hana. */
export async function sendReportNow(input: { report: string; from: string; to: string }): Promise<Res> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  const report = REPORTS.find((r) => r === input.report) as AlertReport | undefined;
  if (!report) return { ok: false, error: "Óþekkt skýrsla" };
  const okD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!okD(input.from) || !okD(input.to) || input.to < input.from) return { ok: false, error: "Ógilt tímabil" };
  if ((Date.parse(input.to) - Date.parse(input.from)) / 86400e3 > 370) return { ok: false, error: "Mest eitt ár í einu" };
  if (!c.email) return { ok: false, error: "Ekkert netfang á notandanum" };
  const rep = await getManagerReport(report, input.from, input.to);
  return emailReport(rep, input.from, input.to, c.email);
}

/** „Senda núna“ á sjálfvirkri skýrslu: sama skýrsla og tímabil og næsta sending, á netfang notandans. */
export async function sendAlertReportNow(id: string): Promise<Res> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  const { data, error } = await c.supabase.from("alert_rules").select("*").eq("id", id).eq("company_id", c.companyId).maybeSingle();
  if (error || !data) return { ok: false, missing: isMissing(error), error: "Skýrsla fannst ekki" };
  const rule = ruleFromRow(data);
  if (!rule || rule.kind !== "report" || !rule.params.report) return { ok: false, error: "Þetta er ekki skýrsla" };
  const { from, to } = reportRange(rule.params.range ?? "last_week", new Date());
  return sendReportNow({ report: rule.params.report, from, to });
}
