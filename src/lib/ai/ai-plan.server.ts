import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_FREE_QUESTIONS, AI_ADDON_QUESTIONS } from "@/lib/pricing";

// VAKTO AI-heimild fyrirtækis í almanaksmánuðinum (0075):
//   viðbót á (ai_addon) eða frí áskrift (billing_status = free) → allt að 500 spurningar
//   í prufu (trial_ends_at í framtíð og ekki enn greitt)        → allt að 500 spurningar
//   annars                                                        → 25 spurningar frítt
// Notkun er talin í ai_usage eftir hvert svar (ai_usage_bump, service-role).

export type AiMode = "addon" | "trial" | "free";
export type AiAllowance = { mode: AiMode; used: number; limit: number; month: string };

/** Fyrsti dagur mánaðarins (UTC = Ísland) sem YYYY-MM-DD. */
export function aiMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function aiAllowance(companyId: string, now = new Date()): Promise<AiAllowance> {
  const admin = createAdminClient();
  const month = aiMonth(now);
  const [{ data: co }, { data: u }] = await Promise.all([
    admin.from("companies").select("ai_addon, billing_status, trial_ends_at").eq("id", companyId).maybeSingle(),
    admin.from("ai_usage").select("questions").eq("company_id", companyId).eq("month", month).maybeSingle(),
  ]);
  const used = (u?.questions as number | undefined) ?? 0;
  const trialEnds = co?.trial_ends_at ? new Date(co.trial_ends_at as string).getTime() : 0;
  const mode: AiMode = co?.ai_addon || co?.billing_status === "free" ? "addon"
    : trialEnds > now.getTime() && co?.billing_status !== "paying" ? "trial" : "free";
  return { mode, used, limit: mode === "free" ? AI_FREE_QUESTIONS : AI_ADDON_QUESTIONS, month };
}

/** Telur eina spurningu. Villur hindra aldrei svarið (þá er hún einfaldlega ekki talin). */
export async function bumpAiUsage(companyId: string, now = new Date()): Promise<void> {
  const { error } = await createAdminClient().rpc("ai_usage_bump", { p_company: companyId, p_month: aiMonth(now) });
  if (error) console.error("[ai-usage]", error.message);
}
