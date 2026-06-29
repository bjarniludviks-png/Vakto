import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEFAULT_RULES, mergeRules, type PayRule } from "@/lib/payrules";

/** Company pay rules = code defaults with DB overrides merged in. Demo → defaults. */
export async function getPayRules(): Promise<{ rules: PayRule[]; live: boolean }> {
  if (!isSupabaseConfigured()) return { rules: DEFAULT_RULES, live: false };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { rules: DEFAULT_RULES, live: false };
    const { data: profile } = await supabase
      .from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return { rules: DEFAULT_RULES, live: false };

    const { data } = await supabase
      .from("pay_rules").select("code, label, kind, pct, confirmed, sort").eq("company_id", company);
    return { rules: mergeRules((data ?? []) as Partial<PayRule>[]), live: true };
  } catch {
    return { rules: DEFAULT_RULES, live: false };
  }
}
