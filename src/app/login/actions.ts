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
