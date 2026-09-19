import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCompanyId, getLaborPct, type RevenueSource } from "@/lib/labor";

export type LaborMetrics = {
  laborPct: number | null; // null = no revenue or no labor cost yet — never a placeholder
  revenue: number;
  laborCost: number;
  revenueSource: RevenueSource;
  live: boolean;
};

const EMPTY: LaborMetrics = { laborPct: null, revenue: 0, laborCost: 0, revenueSource: "none", live: false };

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Month-to-date laun % af veltu for the signed-in company. Thin wrapper over
 * the single shared calculation in src/lib/labor.ts. */
export async function getLaborMetrics(): Promise<LaborMetrics> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const supabase = await createClient();
    const company = await getCompanyId(supabase);
    if (!company) return EMPTY;
    const now = new Date();
    const from = isoOf(new Date(now.getFullYear(), now.getMonth(), 1));
    const m = await getLaborPct(supabase, company, from, isoOf(now));
    return { laborPct: m.pct, revenue: m.revenue, laborCost: m.cost, revenueSource: m.revenueSource, live: true };
  } catch {
    return EMPTY;
  }
}
