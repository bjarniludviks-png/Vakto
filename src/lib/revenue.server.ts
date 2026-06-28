import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { BURDEN } from "@/lib/payroll";

export type LaborMetrics = { laborPct: number; revenue: number; laborCost: number; live: boolean };

const DEMO: LaborMetrics = { laborPct: 32.1, revenue: 4_300_000, laborCost: 1_380_736, live: false };

/** Labor % of revenue (VAKTO signature metric) computed from the revenue table
 * (fed by Inventra/POS) and current labor cost. Falls back to demo numbers. */
export async function getLaborMetrics(): Promise<LaborMetrics> {
  if (!isSupabaseConfigured()) return DEMO;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEMO;
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return DEMO;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const from = monthStart.toISOString().slice(0, 10);

    const { data: locs } = await supabase.from("locations").select("id").eq("company_id", company);
    const locIds = (locs ?? []).map((l) => l.id as string);
    let revenue = 0;
    if (locIds.length) {
      const { data: rev } = await supabase
        .from("revenue").select("amount").in("location_id", locIds).gte("date", from);
      revenue = (rev ?? []).reduce((a, r) => a + Number(r.amount), 0);
    }

    // Labor cost from the latest payroll run (gross + burden).
    const { data: run } = await supabase
      .from("payroll_runs").select("id").eq("company_id", company)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    let laborCost = 0;
    if (run) {
      const { data: lines } = await supabase.from("payroll_lines").select("gross").eq("run_id", run.id);
      laborCost = (lines ?? []).reduce((a, l) => a + Number(l.gross), 0) * (1 + BURDEN);
    }

    if (revenue <= 0 || laborCost <= 0) return DEMO;
    return { laborPct: Math.round((laborCost / revenue) * 1000) / 10, revenue, laborCost, live: true };
  } catch {
    return DEMO;
  }
}
