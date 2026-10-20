import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_FREE_QUESTIONS, AI_ADDON_QUESTIONS } from "@/lib/pricing";
import { currentUserIsDemo, demoCompanyId, isDemoCompany, DEMO_AI_DAILY } from "@/lib/demo.server";

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
  // Opið demo: lítið sameiginlegt þak; næturkeyrslan núllstillir ai_usage → í reynd á sólarhring.
  if (isDemoCompany(companyId)) return { mode: "addon", used, limit: DEMO_AI_DAILY, month };
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

export const DEMO_AI_EXHAUSTED = `AI-spurningar dagsins í demo eru búnar (${DEMO_AI_DAILY}). Prófaðu aftur á morgun — eða stofnaðu eigið fyrirtæki.`;

/** Opið demo: AI-köll utan aðstoðarmannsins telja í sama dagsþak. Skilar villutexta þegar þakið er búið,
 *  annars null (og telur spurninguna nema bump=false). Utan demo: alltaf null. */
export async function demoAiGate(bump = true): Promise<string | null> {
  const co = demoCompanyId();
  if (!co || !(await currentUserIsDemo())) return null;
  const a = await aiAllowance(co);
  if (a.used >= a.limit) return DEMO_AI_EXHAUSTED;
  if (bump) await bumpAiUsage(co);
  return null;
}
