"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { formatKennitala, isValidKennitala, normalizeKennitala } from "@/lib/kennitala";
import { userError } from "@/lib/user-error";
import { demoBlocked, demoResult } from "@/lib/demo.server";

// Greiðsluleið áskriftar (0083) og kennitala fyrirtækis. payment_method er varið (0066/0083) og
// skrifað hér með service role eftir að eigandi hefur verið staðfestur.

type Result = { ok: boolean; demo?: boolean; error?: string; kennitala?: string };

async function ownerCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!profile?.company_id || profile.role !== "owner") return { error: "Aðeins stjórnandi getur breytt þessu" as const };
  return { supabase, userId: user.id, company: profile.company_id as string };
}

/** „Greiða með kröfu í heimabanka“: krafan fer á kennitölu fyrirtækisins, sem verður að vera gild. Aðeins eigandi. */
export async function choosePaymentKrafa(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ownerCtx();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    const admin = createAdminClient();
    const { data: co } = await admin.from("companies").select("kennitala, country").eq("id", ctx.company).maybeSingle();
    if (co?.country && co.country !== "IS") return { ok: false, error: "Krafa í heimabanka er aðeins í boði fyrir íslensk fyrirtæki" };
    if (!isValidKennitala((co?.kennitala as string) ?? "")) return { ok: false, error: "Skráðu gilda kennitölu fyrirtækisins fyrst (Stillingar → Fyrirtæki)" };
    const { error } = await admin.from("companies").update({ payment_method: "krafa" }).eq("id", ctx.company);
    if (error) { console.error("[stillingar] choosePaymentKrafa:", error.message); return { ok: false, error: "Tókst ekki að vista — reyndu aftur síðar." }; }
    await logAudit(ctx.supabase, ctx.company, ctx.userId, { action: "company.payment_method", entity: "companies", detail: `Greiðsluleið: krafa í heimabanka (kt. ${formatKennitala(co!.kennitala as string)})` });
    revalidatePath("/stillingar");
    return { ok: true, kennitala: formatKennitala(co!.kennitala as string) };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** „Greiða með korti“ þegar kort er þegar skráð (annars opnar viðmótið greiðslusíðu Straums). Aðeins eigandi. */
export async function choosePaymentCard(): Promise<Result & { needCard?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ownerCtx();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    const admin = createAdminClient();
    const { count } = await admin.from("payment_methods").select("id", { count: "exact", head: true }).eq("company_id", ctx.company).eq("status", "active");
    if (!count) return { ok: false, needCard: true };
    const { error } = await admin.from("companies").update({ payment_method: "card" }).eq("id", ctx.company);
    if (error) { console.error("[stillingar] choosePaymentCard:", error.message); return { ok: false, error: "Tókst ekki að vista — reyndu aftur síðar." }; }
    await logAudit(ctx.supabase, ctx.company, ctx.userId, { action: "company.payment_method", entity: "companies", detail: "Greiðsluleið: kort" });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Kennitala fyrirtækis (borði í appinu fyrir eldri fyrirtæki sem vantar hana). Vistuð á forminu 000000-0000. */
export async function saveCompanyKennitala(input: string): Promise<Result> {
  if (!isValidKennitala(input ?? "")) return { ok: false, error: "Sláðu inn gilda kennitölu fyrirtækisins (10 tölustafir)." };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ownerCtx();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    const kt = formatKennitala(input);
    const admin = createAdminClient();
    const { data: co } = await admin.from("companies").select("kennitala").eq("id", ctx.company).maybeSingle();
    const changed = normalizeKennitala((co?.kennitala as string) ?? "") !== normalizeKennitala(kt);
    // Ný kennitala → nýr viðskiptamaður í Payday BGL (reikningar og kröfur fara á kennitöluna).
    const { error } = await admin.from("companies").update({ kennitala: kt, ...(changed ? { payday_customer_id: null } : {}) }).eq("id", ctx.company);
    if (error) { console.error("[stillingar] saveCompanyKennitala:", error.message); return { ok: false, error: "Tókst ekki að vista — reyndu aftur síðar." }; }
    await logAudit(ctx.supabase, ctx.company, ctx.userId, { action: "company.update", entity: "company", detail: `Kennitala fyrirtækis skráð: ${kt}` });
    revalidatePath("/", "layout");
    return { ok: true, kennitala: kt };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
