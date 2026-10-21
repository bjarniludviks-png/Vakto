import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { asPlan, planAllows, upgradeError, PLAN_LIMITS, type Feature } from "@/lib/plan-features";
import type { PlanId } from "@/lib/plans";

// Áskriftarleið fyrirtækis á þjóninum (0089). Grunnurinn framfylgir líka (plan_gate_insert-reglur,
// plan_limits_guard), en server actions sem nota þjónustulykil (kiosk, AI, launakeyrsla o.fl.) athuga hér.

export type CompanyPlan = {
  /** plan = leiðin sem er rukkað fyrir; features = leiðin sem gildir fyrir eiginleika (Grunnur í prufu → Vöxtur). */
  id: string; plan: PlanId; features: PlanId; billingStatus: string | null; trialEndsAt: string | null; legacyUntil: string | null;
  interval: "month" | "year"; aiPackEnabled: boolean; aiPackCap: number;
};

/** Leið fyrirtækis (ein fyrirspurn per beiðni). Fyrir 0089: plan='vakto' → Vöxtur (allt nema Rekstrar-þjónusta). */
export const companyPlan = cache(async (companyId: string): Promise<CompanyPlan> => {
  const admin = createAdminClient();
  let r = await admin.from("companies").select("id, plan, billing_status, trial_ends_at, legacy_price_until, billing_interval, ai_pack_enabled, ai_pack_cap").eq("id", companyId).maybeSingle();
  if (r.error) r = await admin.from("companies").select("id, plan, billing_status, trial_ends_at, billing_interval").eq("id", companyId).maybeSingle() as typeof r;
  const c = (r.data ?? {}) as Record<string, unknown>;
  const plan = asPlan(c.plan);
  const inTrial = !!c.trial_ends_at && new Date(c.trial_ends_at as string).getTime() > Date.now() && c.billing_status !== "paying";
  // Eldri viðskiptavinir (legacy_price_until) halda öllu sem þeir höfðu (Vöxtur) á meðan eldra verð gildir.
  const legacy = !!c.legacy_price_until && (c.legacy_price_until as string) >= new Date().toISOString().slice(0, 10);
  return {
    id: companyId, plan, features: plan === "grunnur" && (inTrial || legacy) ? "voxtur" : plan, billingStatus: (c.billing_status as string | null) ?? null,
    trialEndsAt: (c.trial_ends_at as string | null) ?? null, legacyUntil: (c.legacy_price_until as string | null) ?? null,
    interval: c.billing_interval === "year" ? "year" : "month",
    aiPackEnabled: !!c.ai_pack_enabled, aiPackCap: typeof c.ai_pack_cap === "number" ? c.ai_pack_cap : 10,
  };
});

/** Innskráður notandi + fyrirtæki (null utan innskráningar). */
export const currentMember = cache(async (): Promise<{ userId: string; companyId: string; role: string } | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
    return data?.company_id ? { userId: user.id, companyId: data.company_id as string, role: (data.role as string) ?? "employee" } : null;
  } catch { return null; }
});

/** Leið innskráðs notanda (null utan innskráningar). */
export async function currentPlan(): Promise<PlanId | null> {
  const m = await currentMember();
  return m ? (await companyPlan(m.companyId)).features : null;
}

/** Villuboð ef eiginleikinn er utan leiðar fyrirtækisins, annars null. Án fyrirtækis: null (aðrar varnir gilda). */
export async function planBlock(f: Feature, companyId?: string | null): Promise<string | null> {
  const id = companyId ?? (await currentMember())?.companyId;
  if (!id) return null;
  return planAllows((await companyPlan(id)).features, f) ? null : upgradeError(f);
}

/** Má fyrirtækið stofna nýjan stað? (Frítt/Grunnur: 1 staður.) */
export async function locationBlock(companyId: string): Promise<string | null> {
  const max = PLAN_LIMITS[(await companyPlan(companyId)).features].locations;
  if (max === null) return null;
  const { count } = await createAdminClient().from("locations").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  return (count ?? 0) >= max ? upgradeError("multi_location") : null;
}

/** Má fyrirtækið bæta við starfsmanni? (Frítt: 5.) */
export async function employeeBlock(companyId: string): Promise<string | null> {
  const max = PLAN_LIMITS[(await companyPlan(companyId)).features].employees;
  if (max === null) return null;
  const { count } = await createAdminClient().from("employees").select("id", { count: "exact", head: true }).eq("company_id", companyId).neq("status", "inactive");
  return (count ?? 0) >= max ? `Fría leiðin er fyrir allt að ${max} starfsmenn. Í boði í Grunni og ofar — sjá verð á vakto.is/verd.` : null;
}

/** Villa frá grunninum vegna leiðar (plan_gate_insert / plan_limits_guard) → skýr texti, annars null. */
export function planDbError(msg: string | null | undefined): string | null {
  if (!msg) return null;
  const m = /PLAN_LIMIT_\w+: (.*)$/.exec(msg);
  return m ? m[1] : null;
}
