import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MODEL_HAIKU, MODEL_OPUS, MODEL_SONNET } from "@/lib/ai/models";

// Kostnaður hvers Anthropic-kalls (0089, ai_usage_calls). Notað fyrir kostnaðarþakið (30 % af áskrift)
// og /admin. Verðin eru USD á milljón tóka, kostnaður reiknaður í kr.
// TODO(eigandi): staðfesta verð á anthropic.com/pricing (skráð okt. 2026) og gengi.
export const USD_ISK = 130;
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };
export const AI_PRICES_USD_PER_MTOK: Record<string, Price> = {
  [MODEL_OPUS]:   { input: 4,   output: 20,  cacheRead: 0.2,  cacheWrite: 5 },
  [MODEL_SONNET]: { input: 2,   output: 10,  cacheRead: 0.2,  cacheWrite: 2.5 },
  [MODEL_HAIKU]:  { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};
const FALLBACK = AI_PRICES_USD_PER_MTOK[MODEL_OPUS]; // óþekkt líkan → dýrasta verð (aldrei vanmetið)

/** `usage` úr svari Messages API (input_tokens telur ekki tóka úr skyndiminni). */
export type AiUsage = {
  input_tokens?: number | null; output_tokens?: number | null;
  cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
};

export function aiCostIsk(model: string, u: AiUsage): number {
  const p = AI_PRICES_USD_PER_MTOK[model] ?? FALLBACK;
  const usd = ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output
    + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6;
  return Math.round(usd * USD_ISK * 100) / 100;
}

/** Leggur saman notkun margra kalla (t.d. umferðir aðstoðarmannsins). */
export function addUsage(a: AiUsage, b: AiUsage | null | undefined): AiUsage {
  if (!b) return a;
  return {
    input_tokens: (a.input_tokens ?? 0) + (b.input_tokens ?? 0), output_tokens: (a.output_tokens ?? 0) + (b.output_tokens ?? 0),
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
  };
}

/** Skráir kall. companyId/userId sótt úr innskráningu ef ekki gefið (server action / route).
 *  Villur hindra aldrei svarið. */
export async function recordAiUsage(o: { model: string; usage: AiUsage | null | undefined; feature: string; companyId?: string | null; userId?: string | null }): Promise<void> {
  if (!o.usage) return;
  try {
    let { companyId, userId } = o;
    if (companyId === undefined) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = userId ?? user?.id ?? null;
      companyId = user ? ((await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()).data?.company_id as string | undefined) ?? null : null;
    }
    const u = o.usage;
    const { error } = await createAdminClient().from("ai_usage_calls").insert({
      company_id: companyId ?? null, user_id: userId ?? null, feature: o.feature, model: o.model,
      input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0,
      cache_read_tokens: u.cache_read_input_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0,
      cost_isk: aiCostIsk(o.model, u),
    });
    if (error) console.error("[ai-cost]", error.message);
  } catch (e) { console.error("[ai-cost]", e instanceof Error ? e.message : e); }
}

/** AI-kostnaður fyrirtækis frá upphafi almanaksmánaðar (kr). */
export async function aiCostThisMonth(companyId: string, now = new Date()): Promise<number> {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data, error } = await createAdminClient().rpc("ai_cost_since", { p_company: companyId, p_from: from });
  if (error) { console.error("[ai-cost]", error.message); return 0; }
  return Number(data ?? 0);
}
