import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Company pay-period start day (1 = calendar month). Tolerant of 0036 unrun. */
export async function getPayPeriodStart(): Promise<number> {
  if (!isSupabaseConfigured()) return 1;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 1;
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    if (!profile?.company_id) return 1;
    const res = await supabase.from("companies").select("pay_period_start").eq("id", profile.company_id).maybeSingle();
    if (res.error) return 1;
    const d = Number(res.data?.pay_period_start);
    return Number.isFinite(d) && d >= 1 && d <= 28 ? d : 1;
  } catch {
    return 1;
  }
}
