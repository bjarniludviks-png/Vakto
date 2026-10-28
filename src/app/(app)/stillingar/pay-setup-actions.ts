"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { companyPaySetup, type CompanyPaySetup } from "@/lib/pay-period.server";
import { normalizePayPeriod, payPeriodName, type PayPeriodCfg } from "@/lib/periods";
import type { OtMode } from "@/lib/payrules";

// Launatímabil (mánaðarlegt frá hvaða degi sem er, hálfsmánaðarlegt, tveggja vikna, vikulegt) og hvernig
// yfirvinna er talin (per viku eða meðaltal yfir tímabilið). Aðeins eigandi eða stjórnandi með Launakeyrslur.

type Result = { ok: boolean; demo?: boolean; error?: string; needsMigration?: boolean };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: me } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!me?.company_id) return { error: "Fyrirtæki fannst ekki" as const };
  if (me.role !== "owner") {
    const { data: ok } = await supabase.rpc("has_perm", { p_area: "launakeyrslur" });
    if (ok !== true) return { error: "Aðeins eigandi eða stjórnandi með aðgang að launakeyrslum getur breytt þessu" as const };
  }
  return { supabase, company: me.company_id as string, userId: user.id };
}

export async function getPaySetup(): Promise<CompanyPaySetup | null> {
  if (!isSupabaseConfigured()) return { period: { kind: "month", startDay: 1 }, otMode: "week" };
  try {
    const c = await ctx();
    if ("error" in c) return null;
    return await companyPaySetup(c.supabase, c.company);
  } catch {
    return null;
  }
}

export async function savePaySetup(input: { period: PayPeriodCfg; otMode: OtMode }): Promise<Result> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  const period = normalizePayPeriod(input.period);
  if ((input.period.kind === "weekly" || input.period.kind === "biweekly") && period.kind !== input.period.kind) return { ok: false, error: "Veldu fyrsta dag tímabils" };
  const otMode: OtMode = input.otMode === "period" ? "period" : "week";
  try {
    const c = await ctx();
    if ("error" in c) return { ok: false, error: c.error };
    const legacy = period.kind === "month" ? period.startDay ?? 1 : 1;
    const { error } = await c.supabase.from("companies").update({ pay_period: period, ot_mode: otMode, pay_period_start: legacy }).eq("id", c.company);
    if (error) {
      if (/pay_period|ot_mode/.test(error.message) && !/pay_period_start/.test(error.message)) {
        // Fyrir 0097: aðeins mánaðarlegt með upphafsdegi er hægt að vista.
        if (period.kind !== "month" || otMode !== "week") return { ok: false, needsMigration: true, error: "Þessi stilling verður virk eftir næstu uppfærslu — reyndu aftur síðar." };
        const r2 = await c.supabase.from("companies").update({ pay_period_start: legacy }).eq("id", c.company);
        if (r2.error) return { ok: false, error: userError(r2.error) };
      } else return { ok: false, error: userError(error) };
    }
    await logAudit(c.supabase, c.company, c.userId, {
      action: "company.pay_period", entity: "companies",
      detail: `Launatímabil: ${payPeriodName(period)}${period.kind === "weekly" || period.kind === "biweekly" ? ` frá ${period.anchor}` : ""} · yfirvinna ${otMode === "period" ? "að meðaltali yfir tímabilið" : "per viku"}`,
    });
    revalidatePath("/stillingar");
    revalidatePath("/launakeyrslur");
    revalidatePath("/timaskraning/vinnuyfirlit");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
