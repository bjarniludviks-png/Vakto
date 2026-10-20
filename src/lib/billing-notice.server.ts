import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isValidKennitala } from "@/lib/kennitala";
import { isDemoCompany } from "@/lib/demo.server";

// Borði/gluggi eigandans efst í appinu (aðeins eigandi):
//  - "kennitala": íslenskt fyrirtæki án gildrar kennitölu → gluggi sem þarf að fylla (reikningar/kröfur fara á hana).
//    Undanþegin: frí áskrift og opna demo-fyrirtækið.
//  - "choose": prufan rennur út innan 4 daga, ekkert kort og engin greiðsluleið valin.
export type BillingNotice = { kind: "kennitala" } | { kind: "choose"; endsOn: string } | null;

const REMIND_DAYS = 4; // = TRIAL_REMINDER_DAYS í billing.server

export async function getBillingNotice(): Promise<BillingNotice> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from("users").select("role, company_id").eq("id", user.id).maybeSingle();
    if (profile?.role !== "owner" || !profile.company_id) return null;
    const companyId = profile.company_id as string;
    const { data: co } = await supabase.from("companies").select("kennitala, country, billing_status, trial_ends_at").eq("id", companyId).maybeSingle();
    if (!co) return null;
    const status = (co.billing_status as string | null) ?? null;
    const demo = isDemoCompany(companyId);
    if (demo || status === "free") return null;
    const iceland = !co.country || co.country === "IS";
    if (iceland && !isValidKennitala((co.kennitala as string) ?? "")) return { kind: "kennitala" };

    const te = co.trial_ends_at ? new Date(co.trial_ends_at as string) : null;
    if (!te || status === "paying" || status === "canceled") return null;
    const left = (te.getTime() - Date.now()) / 86400000;
    if (left < 0 || left > REMIND_DAYS) return null;
    const pm = await supabase.from("companies").select("payment_method").eq("id", companyId).maybeSingle();
    if (pm.error || pm.data?.payment_method) return null; // 0083 ekki keyrð eða leið þegar valin
    const { data: hasCard, error: cardErr } = await supabase.rpc("company_has_card");
    if (cardErr || hasCard) return null;
    return { kind: "choose", endsOn: te.toISOString() };
  } catch {
    return null;
  }
}
