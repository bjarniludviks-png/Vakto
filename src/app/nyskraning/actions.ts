"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { provisionCompanyForUser } from "@/lib/provision";
import { sendWelcomeEmail } from "@/lib/email";

export type SignupResult = { ok: boolean; demo?: boolean; error?: string };

/** Record the chosen plan + start a 14-day trial on the signed-in user's company.
 * Tolerant of migration 0020 not being run yet (best-effort). */
export async function setCompanyPlan(plan: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    if (!profile?.company_id) return { ok: false };
    // Free has no trial clock; Pro gets 14 days.
    const trialEnds = plan === "free" ? null : new Date(Date.now() + 14 * 86400000).toISOString();
    await supabase.from("companies").update({ plan, trial_ends_at: trialEnds }).eq("id", profile.company_id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Self-service owner signup: create the auth user, a company, and link the
 * public.users row as owner. Uses the service-role client (RLS would block a
 * brand-new user from creating a company). Demo fallback when unconfigured. */
export async function createOwnerAccount(input: { fullName: string; companyName: string; email: string; password: string; country?: string }): Promise<SignupResult> {
  const fullName = input.fullName?.trim();
  const companyName = input.companyName?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!fullName || !companyName || !email || !input.password) return { ok: false, error: "Fylltu út alla reiti" };
  if (input.password.length < 8) return { ok: false, error: "Lykilorð þarf að vera a.m.k. 8 stafir" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const admin = createAdminClient();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: input.password, email_confirm: true,
      user_metadata: { full_name: fullName, role: "owner" },
    });
    if (cErr || !created.user) {
      const m = cErr?.message ?? "Tókst ekki að stofna aðgang";
      return { ok: false, error: /already|registered|exists/i.test(m) ? "Netfang er þegar skráð — skráðu þig inn" : m };
    }
    const userId = created.user.id;
    const prov = await provisionCompanyForUser(userId, email, fullName, companyName, input.country);
    if (!prov.ok) return { ok: false, error: prov.error };
    await sendWelcomeEmail(email, fullName, companyName); // no-op until Resend is configured
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}


/** Skref 2 í nýskráningu: prufan hefst og kúnninn fer á greiðslusíðu Straums til að skrá kort (0 kr).
 * Skilar slóð á greiðslusíðuna, eða `skip: true` ef Straumur er ekki stilltur (þá beint inn). */
export async function startCardSetup(origin: string): Promise<{ ok: boolean; url?: string; skip?: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true, skip: true };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const { straumurConfigured, createCardSetupCheckout } = await import("@/lib/straumur");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const companyId = profile?.company_id as string | undefined;
    if (!companyId) return { ok: false, error: "Fyrirtæki fannst ekki" };
    await setCompanyPlan("vakto");
    if (!straumurConfigured()) return { ok: true, skip: true };
    const base = /^https?:\/\/[^/]+$/.test(origin) ? origin : (process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is");
    const { url } = await createCardSetupCheckout(companyId, { returnUrl: `${base}/nyskraning/kort?ok=1`, email: user.email ?? undefined });
    return { ok: true, url };
  } catch (e) {
    console.error("startCardSetup:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Tókst ekki að opna greiðslusíðuna — reyndu aftur." };
  }
}

/** Er kort komið á skrá? (síðan eftir Straum pollar þetta þar til webhook-ið hefur skilað tokeninu) */
export async function hasCardOnFile(): Promise<{ ok: boolean; card: { last4: string | null; brand: string | null } | null }> {
  if (!isSupabaseConfigured()) return { ok: true, card: null };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, card: null };
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    if (!profile?.company_id) return { ok: false, card: null };
    const { data } = await supabase.from("payment_methods").select("card_summary, card_brand").eq("company_id", profile.company_id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { ok: true, card: data ? { last4: (data.card_summary as string) ?? null, brand: (data.card_brand as string) ?? null } : null };
  } catch { return { ok: false, card: null }; }
}
