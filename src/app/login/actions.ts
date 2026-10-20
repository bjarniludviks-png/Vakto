"use server";

// Password reset via Resend: a branded VAKTO email with a recovery link
// (Supabase generateLink sends nothing itself, so we control the email fully).

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendResetEmail } from "@/lib/email";

export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  const to = email.trim().toLowerCase();
  // Always report success — never reveal whether an account exists.
  if (!to || !isSupabaseConfigured()) return { ok: true };
  try {
    const admin = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
    const { data } = await admin.auth.admin.generateLink({ type: "recovery", email: to });
    // token_hash link → the set-password page verifies it itself (verifyOtp);
    // no Supabase redirect chain, so it works in every browser/mail client.
    const hash = data?.properties?.hashed_token;
    if (hash) await sendResetEmail(to, `${appUrl}/nytt-lykilord?token_hash=${hash}&type=recovery`);
  } catch { /* swallow — same response either way */ }
  return { ok: true };
}


/** "Prófa demo": signs the visitor into the ONE public demo company. Enabled only
 * when DEMO_COMPANY_ID + DEMO_LOGIN_EMAIL + DEMO_LOGIN_PASSWORD are set — without
 * DEMO_COMPANY_ID none of the demo guards apply, so no anonymous login then. */
export async function demoLogin(): Promise<{ ok: boolean; next?: string; error?: string }> {
  const { demoConfigured, demoCompanyId, demoVisitorId } = await import("@/lib/demo.server");
  const email = process.env.DEMO_LOGIN_EMAIL!, password = process.env.DEMO_LOGIN_PASSWORD!;
  if (!demoConfigured()) return { ok: false, error: "Demo er ekki í boði" };
  const fail = { ok: false, error: "Demo-innskráning tókst ekki" };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Gestur gæti hafa breytt lykilorði/netfangi demo-aðgangsins beint gegnum Supabase → laga og reyna aftur.
    // AÐEINS við rangt lykilorð: lykilorðsbreyting ógildir lotur allra gesta sem eru inni.
    if (error?.code === "invalid_credentials" && (await healDemoOwner(demoCompanyId()!, email, password))) {
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    }
    if (error || !data.user || !data.session) return fail;
    // Öryggisnet: aðgangurinn VERÐUR að vera í demo-fyrirtækinu (aldrei raunverulegt fyrirtæki).
    // Lesið með þjónustulykli: kökubundni biðlarinn les enn gömlu kökur beiðninnar (t.d. útrunna demo-lotu)
    // og fékk þá enga röð → nýja lotan var skráð út strax eftir innskráningu (tómt mælaborð).
    const { data: u } = await createAdminClient().from("users").select("company_id").eq("id", data.user.id).maybeSingle();
    if (u?.company_id !== demoCompanyId()) {
      await createAdminClient().auth.admin.signOut(data.session.access_token, "local");
      console.error("[demo] DEMO_LOGIN_EMAIL er ekki í DEMO_COMPANY_ID");
      return fail;
    }
    await demoVisitorId(); // gestakaka fyrir AI-þak per gest
    return { ok: true, next: "/maelabord" };
  } catch {
    return fail;
  }
}

/** Setur netfang + lykilorð demo-eigandans aftur á env-gildin (users.email = DEMO_LOGIN_EMAIL). */
async function healDemoOwner(companyId: string, email: string, password: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: owner } = await admin.from("users").select("id").eq("company_id", companyId).eq("role", "owner").ilike("email", email).limit(1).maybeSingle();
    if (!owner?.id) return false;
    const { error } = await admin.auth.admin.updateUserById(owner.id as string, { email, password, email_confirm: true });
    return !error;
  } catch {
    return false;
  }
}
