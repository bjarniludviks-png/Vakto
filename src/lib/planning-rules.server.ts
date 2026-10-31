import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeRules, type PlanningRule } from "@/lib/planning-rules";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Planreglur fyrirtækis notandans. Tómt ef 0101 vantar eða ekkert er vistað. */
export async function getPlanningRules(supabase?: Db, companyId?: string): Promise<PlanningRule[]> {
  try {
    const db = supabase ?? (await createClient());
    let q = db.from("companies").select("planning_rules");
    if (companyId) q = q.eq("id", companyId);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) return [];
    return normalizeRules((data as { planning_rules?: unknown } | null)?.planning_rules);
  } catch {
    return [];
  }
}
