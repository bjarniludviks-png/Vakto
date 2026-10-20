"use server";

// Mánaðarskýrsla í pósti (0085): stilling + „Senda prufu á mig“. Aðeins eigandi.
// Les/skrifar með service-role eftir að hlutverk er staðfest (users er varið gegn beinum skrifum).

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { userError } from "@/lib/user-error";
import { sendMonthlyReportTest } from "@/lib/monthly-report.server";

export type MonthlyReportMode = "off" | "owners" | "managers";
export type MonthlyReportSetting = { ok: boolean; owner: boolean; mode: MonthlyReportMode; error?: string };

async function ownerCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("users").select("company_id, role, email").eq("id", user.id).maybeSingle();
  if (!u?.company_id || u.role !== "owner") return null;
  return { supabase, userId: user.id, company: u.company_id as string, email: ((u.email as string | null) || user.email || "").trim() };
}

export async function getMonthlyReportSetting(): Promise<MonthlyReportSetting> {
  if (!isSupabaseConfigured()) return { ok: true, owner: false, mode: "owners" };
  try {
    const ctx = await ownerCtx();
    if (!ctx) return { ok: true, owner: false, mode: "owners" };
    const { data, error } = await createAdminClient().from("companies")
      .select("monthly_report, monthly_report_managers").eq("id", ctx.company).maybeSingle();
    if (error) return { ok: false, owner: true, mode: "owners", error: "Stillingin er ekki tilbúin enn." }; // 0085 vantar
    const mode: MonthlyReportMode = data?.monthly_report === false ? "off" : data?.monthly_report_managers ? "managers" : "owners";
    return { ok: true, owner: true, mode };
  } catch (e) {
    return { ok: false, owner: false, mode: "owners", error: userError(e, "Villa") };
  }
}

export async function saveMonthlyReportSetting(mode: MonthlyReportMode): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!["off", "owners", "managers"].includes(mode)) return { ok: false, error: "Ógilt val" };
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const ctx = await ownerCtx();
    if (!ctx) return { ok: false, error: "Aðeins eigandi getur breytt þessu." };
    if (await demoBlocked(ctx.company)) return demoResult();
    const { error } = await createAdminClient().from("companies")
      .update({ monthly_report: mode !== "off", monthly_report_managers: mode === "managers" }).eq("id", ctx.company);
    if (error) { console.error("[monthly-report] save:", error.message); return { ok: false, error: "Tókst ekki að vista — reyndu aftur síðar." }; }
    await logAudit(ctx.supabase, ctx.company, ctx.userId, {
      action: "company.monthly_report", entity: "company",
      detail: `Mánaðarskýrsla: ${mode === "off" ? "slökkt" : mode === "managers" ? "eigendur og vaktstjórar" : "eigendur"}`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Sendir skýrslu síðasta mánaðar á innskráðan eiganda strax. */
export async function sendMonthlyReportTestToMe(): Promise<{ ok: boolean; to?: string; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "Ekki tengt" };
  try {
    const ctx = await ownerCtx();
    if (!ctx) return { ok: false, error: "Aðeins eigandi getur sent prufu." };
    if (await demoBlocked(ctx.company)) return demoResult();
    if (!ctx.email) return { ok: false, error: "Netfang vantar á aðganginn þinn." };
    const r = await sendMonthlyReportTest(ctx.company, ctx.email);
    if (!r.ok) return { ok: false, error: "Tókst ekki að senda póstinn — reyndu aftur síðar." };
    if (r.skipped) return { ok: false, error: "Póstþjónn er ekki tengdur í þessu umhverfi." };
    return { ok: true, to: ctx.email };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
