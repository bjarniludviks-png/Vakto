import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_FREE_QUESTIONS, AI_ADDON_QUESTIONS } from "@/lib/pricing";
import { currentUserIsDemo, demoCompanyId, demoVisitorId, isDemoCompany, DEMO_AI_DAILY, DEMO_AI_PER_VISITOR } from "@/lib/demo.server";

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
  // Opið demo: sameiginlegt dagsþak (auk þaks per gest, sjá demoAiCheck); næturkeyrslan núllstillir ai_usage → í reynd á sólarhring.
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
export const DEMO_AI_VISITOR_EXHAUSTED = `Þú hefur notað ${DEMO_AI_PER_VISITOR} AI-spurningar í demo í dag. Stofnaðu eigið fyrirtæki til að halda áfram — 14 daga frí prufa.`;

// Per gest: ein röð í audit_log (action demo.ai, entity_id = sha256 af gestakökunni) per spurningu.
// Engin migration; næturkeyrslan hreinsar audit_log demo-fyrirtækisins. Dagur = UTC (= Ísland).
const DEMO_AI_ACTION = "demo.ai";
const visitorKey = async (vid: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(vid))), (b) => b.toString(16).padStart(2, "0")).join("");

async function demoVisitorUsed(companyId: string, key: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await createAdminClient().from("audit_log").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).eq("action", DEMO_AI_ACTION).eq("entity_id", key).gte("at", `${today}T00:00:00Z`);
  if (error) console.error("[demo-ai]", error.message);
  return count ?? 0;
}

/** Skráir eina demo-spurningu á gestinn (ai_usage er talið sér með bumpAiUsage). */
export async function recordDemoVisitorAi(companyId: string, key: string): Promise<void> {
  const { error } = await createAdminClient().from("audit_log").insert({ company_id: companyId, action: DEMO_AI_ACTION, entity: "demo_visitor", entity_id: key });
  if (error) console.error("[demo-ai]", error.message);
}

export type DemoAiCheck = { companyId: string; key: string; stop: string | null; signup: boolean; remaining: number; perVisitor: number };

/** Opið demo: staða dagsþaka (alls + per gest). null utan demo. Telur ekkert. */
export async function demoAiCheck(): Promise<DemoAiCheck | null> {
  const co = demoCompanyId();
  if (!co || !(await currentUserIsDemo())) return null;
  const key = await visitorKey(await demoVisitorId());
  const [a, used] = await Promise.all([aiAllowance(co), demoVisitorUsed(co, key)]);
  const remaining = Math.max(0, DEMO_AI_PER_VISITOR - used);
  const base = { companyId: co, key, remaining, perVisitor: DEMO_AI_PER_VISITOR };
  if (remaining <= 0) return { ...base, stop: DEMO_AI_VISITOR_EXHAUSTED, signup: true };
  if (a.used >= a.limit) return { ...base, stop: DEMO_AI_EXHAUSTED, signup: false };
  return { ...base, stop: null, signup: false };
}

/** Opið demo: AI-köll utan aðstoðarmannsins telja í sömu dagsþök. Skilar villutexta þegar þak er búið,
 *  annars null (og telur spurninguna nema bump=false). Utan demo: alltaf null. */
export async function demoAiGate(bump = true): Promise<string | null> {
  const c = await demoAiCheck();
  if (!c) return null;
  if (c.stop) return c.stop;
  if (bump) await Promise.all([bumpAiUsage(c.companyId), recordDemoVisitorAi(c.companyId, c.key)]);
  return null;
}
