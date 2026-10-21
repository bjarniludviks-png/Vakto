import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_PACK, getPlan, planCost } from "@/lib/plans";
import { planAllows, upgradeError, type Feature } from "@/lib/plan-features";
import { companyPlan, currentMember } from "@/lib/plan.server";
import { aiCostThisMonth } from "@/lib/ai/usage.server";
import { currentUserIsDemo, demoCompanyId, demoVisitorId, isDemoCompany, DEMO_AI_DAILY, DEMO_AI_PER_VISITOR } from "@/lib/demo.server";

// VAKTO AI-heimild fyrirtækis í almanaksmánuðinum (0089):
//   innifaldar spurningar per leið (plans.ts aiQuestions: Frítt 0 · Grunnur 25 · Vöxtur 100 · Rekstur 300)
//   + AI-pakkar (50 spurningar á 1.490 kr) ef stjórnandi kveikti á þeim, mest ai_pack_cap á mánuði.
//   Pakki er tekinn þegar spurning fer yfir heimildina (ai_usage.packs) og reikningsfærður eftir á.
// Kostnaðarþak: ef AI-kostnaður mánaðarins (ai_usage_calls) fer yfir 30 % af mánaðarverði áskriftarinnar
// (+ pakka mánaðarins) stöðvast AI út mánuðinn. Frítt = 0 kr → ekkert AI.
// Hver aðgerð notandans (spurning, AI-vaktaplan, AI-skýrsla, greining) telst ein spurning.

export const AI_COST_CAP_SHARE = 0.3;

export type AiAllowance = {
  mode: "plan" | "demo"; month: string; used: number; included: number; packs: number;
  packEnabled: boolean; packCap: number; limit: number; costIsk: number; costCapIsk: number;
};

/** Fyrsti dagur mánaðarins (UTC = Ísland) sem YYYY-MM-DD. */
export function aiMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Virkir starfsmenn mánaðarins (sama skilgreining og reikningar: billing_usage). */
async function activeThisMonth(companyId: string, now: Date): Promise<number> {
  const { activeEmployees } = await import("@/lib/billing.server");
  const from = aiMonth(now), to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  return activeEmployees(companyId, from, to).catch(() => 0);
}

export async function aiAllowance(companyId: string, now = new Date()): Promise<AiAllowance> {
  const month = aiMonth(now);
  const [co, { data: u }, costIsk] = await Promise.all([
    companyPlan(companyId),
    createAdminClient().from("ai_usage").select("questions, packs").eq("company_id", companyId).eq("month", month).maybeSingle(),
    aiCostThisMonth(companyId, now),
  ]);
  const used = (u?.questions as number | undefined) ?? 0, packs = (u?.packs as number | undefined) ?? 0;
  // Opið demo: sameiginlegt dagsþak (auk þaks per gest, sjá demoAiCheck); næturkeyrslan núllstillir ai_usage.
  if (isDemoCompany(companyId)) return { mode: "demo", month, used, included: DEMO_AI_DAILY, packs: 0, packEnabled: false, packCap: 0, limit: DEMO_AI_DAILY, costIsk, costCapIsk: Infinity };
  const plan = getPlan(co.features);
  const packCap = co.aiPackEnabled ? co.aiPackCap : 0;
  const limit = plan.aiQuestions + Math.max(packs, packCap) * AI_PACK.questions;
  // Þakið: lágmarksverð leiðarinnar fyrst (sparar talningu virkra starfsmanna þegar langt er í það).
  const floor = (plan.base + packs * AI_PACK.price) * AI_COST_CAP_SHARE;
  const costCapIsk = costIsk <= floor ? floor
    : ((planCost(plan, await activeThisMonth(companyId, now), 0, co.interval === "year")?.total ?? plan.base) + packs * AI_PACK.price) * AI_COST_CAP_SHARE;
  return { mode: "plan", month, used, included: plan.aiQuestions, packs, packEnabled: co.aiPackEnabled, packCap, limit, costIsk, costCapIsk };
}

/** Telur eina spurningu (og tekur AI-pakka ef farið er yfir innifaldar). Villur hindra aldrei svarið. */
export async function bumpAiUsage(companyId: string, now = new Date()): Promise<void> {
  const admin = createAdminClient();
  const included = isDemoCompany(companyId) ? 1_000_000 : getPlan((await companyPlan(companyId)).features).aiQuestions;
  const { error } = await admin.rpc("ai_usage_count", { p_company: companyId, p_month: aiMonth(now), p_included: included });
  if (!error) return;
  // Fyrir 0089: gamla talningin.
  const old = await admin.rpc("ai_usage_bump", { p_company: companyId, p_month: aiMonth(now) });
  if (old.error) console.error("[ai-usage]", error.message);
}

export type AiStop = { error: string; limit?: { mode: string; used: number; limit: number; canUpgrade: boolean } };

/** Má fyrirtækið nota AI núna? null = já. Telur ekkert. `role` stýrir orðalagi (eigandi getur breytt). */
export async function aiStop(companyId: string, role: string | null, feature: Feature = "ai"): Promise<AiStop | null> {
  const co = await companyPlan(companyId);
  if (!isDemoCompany(companyId) && !planAllows(co.features, feature)) return { error: upgradeError(feature) };
  const a = await aiAllowance(companyId);
  if (a.mode === "demo") return null; // demo hefur eigin þök (demoAiCheck)
  const owner = role === "owner";
  if (a.costIsk > a.costCapIsk) {
    console.warn("[ai-cost-cap]", companyId, `kostnaður ${a.costIsk} kr > þak ${Math.round(a.costCapIsk)} kr`);
    return { error: "VAKTO AI er í hléi út mánuðinn vegna óvenju mikillar notkunar. Heimildin endurnýjast 1. næsta mánaðar — hafðu samband á hallo@vakto.is ef þig vantar meira." };
  }
  if (a.used >= a.limit) {
    const canUpgrade = owner && (!a.packEnabled || a.packCap < 100);
    const error = !a.packEnabled
      ? (owner
        ? `Spurningarnar ${a.included} sem fylgja leiðinni í þessum mánuði eru búnar. Kveiktu á AI-pökkum (${AI_PACK.questions} spurningar á 1.490 kr) í Stillingum → Áskrift, eða veldu stærri leið.`
        : `Spurningarnar ${a.included} sem fylgja leiðinni í þessum mánuði eru búnar. Stjórnandi fyrirtækisins getur kveikt á AI-pökkum í Stillingum → Áskrift.`)
      : (owner
        ? `Hámark AI-pakka í þessum mánuði (${a.packCap}) er náð. Þú getur hækkað hámarkið í Stillingum → Áskrift; annars endurnýjast heimildin 1. næsta mánaðar.`
        : `Hámark AI-pakka í þessum mánuði er náð. Heimildin endurnýjast 1. næsta mánaðar.`);
    return { error, limit: { mode: a.packEnabled ? "packs" : "plan", used: a.used, limit: a.limit, canUpgrade } };
  }
  return null;
}

/** Almennt hlið fyrir AI-aðgerðir innskráðs notanda (server actions / routes): demo-þök, leið, kvóti,
 *  kostnaðarþak. Skilar villutexta eða null — og telur spurninguna nema bump=false. */
export async function aiGate(opts: { feature?: Feature; bump?: boolean } = {}): Promise<string | null> {
  const bump = opts.bump ?? true;
  const demo = await demoAiCheck();
  if (demo) {
    if (demo.stop) return demo.stop;
    if (bump) await Promise.all([bumpAiUsage(demo.companyId), recordDemoVisitorAi(demo.companyId, demo.key)]);
    return null;
  }
  const m = await currentMember();
  if (!m) return null; // óinnskráð: aðrar varnir (auth) gilda
  const stop = await aiStop(m.companyId, m.role, opts.feature ?? "ai");
  if (stop) return stop.error;
  if (bump) await bumpAiUsage(m.companyId);
  return null;
}

/** Eldra nafn (kallað víða). */
export const demoAiGate = (bump = true) => aiGate({ bump });

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
