"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Viðskiptavinur samþykkir eða gerir athugasemd við verkskýrslu (0102). Enginn aðgangur — leynitengillinn
// (token, uuid) er heimildin, og aðeins skýrsla sem bíður („sent“) getur breyst.
export async function decideReport(token: string, approve: boolean, name: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: "Ógildur hlekkur" };
  const signed = name.trim().slice(0, 120);
  if (!signed) return { ok: false, error: "Skrifaðu nafnið þitt" };
  const note = comment.trim().slice(0, 2000);
  if (!approve && !note) return { ok: false, error: "Segðu hvað þarf að laga" };
  const admin = createAdminClient();
  const { data, error } = await admin.from("job_reports")
    .update({ status: approve ? "approved" : "rejected", signed_name: signed, client_comment: note || null, decided_at: new Date().toISOString() })
    .eq("token", token).eq("status", "sent").select("id").maybeSingle();
  if (error) return { ok: false, error: "Tókst ekki að vista — reyndu aftur" };
  if (!data) return { ok: false, error: "Skýrslunni hefur þegar verið svarað" };
  return { ok: true };
}
