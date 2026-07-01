"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { provisionCompanyForUser } from "@/lib/provision";
import { sendWelcomeEmail } from "@/lib/email";

export type SignupResult = { ok: boolean; demo?: boolean; error?: string };

/** Self-service owner signup: create the auth user, a company, and link the
 * public.users row as owner. Uses the service-role client (RLS would block a
 * brand-new user from creating a company). Demo fallback when unconfigured. */
export async function createOwnerAccount(input: { fullName: string; companyName: string; email: string; password: string }): Promise<SignupResult> {
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
    const prov = await provisionCompanyForUser(userId, email, fullName, companyName);
    if (!prov.ok) return { ok: false, error: prov.error };
    await sendWelcomeEmail(email, fullName, companyName); // no-op until Resend is configured
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
