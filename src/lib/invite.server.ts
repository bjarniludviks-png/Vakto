import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendInviteEmail } from "@/lib/email";

/** Íslensk hlutverkaheiti (eins og í formunum) → users.role. */
export const INVITE_ROLE: Record<string, string> = {
  Starfsmaður: "employee", Vaktstjóri: "manager", Stjórnandi: "owner", Verktaki: "contractor",
};
export function roleFromLabel(label: string | undefined): string {
  const key = Object.keys(INVITE_ROLE).find((k) => (label ?? "").startsWith(k)) ?? "Starfsmaður";
  return INVITE_ROLE[key] ?? "employee";
}

export type InviteResult = {
  ok: boolean;
  userId?: string;
  /** Boðspóstur sendur (nýr aðgangur). false = netfangið átti þegar aðgang og var bara tengt. */
  sent: boolean;
  error?: string;
};

/** Býður netfangi í fyrirtækið (eða tengir aðgang sem er þegar til) og tengir
 * starfsmannaprófílinn með sama netfangi við aðganginn. Notað bæði úr
 * Stillingar → Notendur og þegar starfsmaður er stofnaður með netfangi. */
export async function inviteToCompany(companyId: string, emailRaw: string, roleLabel: string): Promise<InviteResult> {
  const emailAddr = emailRaw.trim();
  if (!emailAddr) return { ok: false, sent: false, error: "Netfang vantar" };
  try {
    const admin = createAdminClient();
    const role = roleFromLabel(roleLabel);
    const { data: comp } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
    const companyName = (comp?.name as string) ?? "VAKTO";

    // Rétt nafn úr starfsmannaprófílnum (fréttaveita/spjall sýna það).
    const { data: empByMail } = await admin.from("employees")
      .select("full_name").eq("company_id", companyId).ilike("email", emailAddr).limit(1).maybeSingle();
    const fullName = (empByMail?.full_name as string) ?? null;

    let userId: string | undefined;
    let sent = false;
    const { data: existing } = await admin.from("users").select("id, company_id").ilike("email", emailAddr).limit(1).maybeSingle();
    if (existing?.id) {
      // Aðgangur er þegar til (t.d. eigandinn sjálfur) — tengjum bara, sendum ekki boð.
      userId = existing.id as string;
      if (!existing.company_id) await admin.from("users").update({ company_id: companyId, role, ...(fullName ? { full_name: fullName } : {}) }).eq("id", userId);
    } else if (emailConfigured()) {
      // VAKTO-boð gegnum Resend (generateLink sendir ekki póst sjálft).
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
      const { data: gen, error } = await admin.auth.admin.generateLink({ type: "invite", email: emailAddr, options: { data: { role, company_id: companyId, full_name: fullName } } });
      if (error) return { ok: false, sent: false, error: error.message };
      userId = gen?.user?.id;
      // token_hash-slóð → /nytt-lykilord staðfestir og notandinn velur lykilorð.
      const hash = gen?.properties?.hashed_token;
      if (hash) { await sendInviteEmail(emailAddr, companyName, roleLabel, `${appUrl}/nytt-lykilord?token_hash=${hash}&type=invite`); sent = true; }
      if (userId) await admin.from("users").update({ company_id: companyId, role, ...(fullName ? { full_name: fullName } : {}) }).eq("id", userId);
    } else {
      // Sjálfgefinn boðspóstur Supabase.
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(emailAddr, { data: { role, company_id: companyId } });
      if (error) return { ok: false, sent: false, error: error.message };
      userId = invited?.user?.id; sent = true;
      if (userId) await admin.from("users").update({ company_id: companyId, role, ...(fullName ? { full_name: fullName } : {}) }).eq("id", userId);
    }
    if (userId) {
      // Aðild (0023) svo notandinn geti skipt yfir á þetta fyrirtæki.
      await admin.from("company_members").upsert({ user_id: userId, company_id: companyId, role });
      // Tengja aðganginn við starfsmannaprófílinn (sama netfang) → Mitt svæði, stimplanir, app.
      const { data: emp } = await admin.from("employees")
        .select("id").eq("company_id", companyId).is("user_id", null)
        .ilike("email", emailAddr).limit(1).maybeSingle();
      if (emp) await admin.from("employees").update({ user_id: userId }).eq("id", emp.id);
    }
    return { ok: true, userId, sent };
  } catch (e) {
    return { ok: false, sent: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
