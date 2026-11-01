"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Viðskiptavinur samþykkir eða hafnar tilboði (0104). Leynitengillinn (token) er heimildin og aðeins
// sent tilboð getur breyst. Samþykkt tilboð verður að verki hjá verktakanum (tengt tilboðinu).
export async function decideQuote(token: string, accept: boolean, name: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: "Ógildur hlekkur" };
  const signed = name.trim().slice(0, 120);
  if (!signed) return { ok: false, error: "Skrifaðu nafnið þitt" };
  const admin = createAdminClient();
  const { data: q } = await admin.from("quotes").select("id, company_id, client_id, title, address, description, items, status, valid_until, created_by").eq("token", token).maybeSingle();
  if (!q) return { ok: false, error: "Tilboð fannst ekki" };
  if (q.status !== "sent") return { ok: false, error: "Tilboðinu hefur þegar verið svarað" };
  if (accept && q.valid_until && String(q.valid_until) < new Date().toISOString().slice(0, 10)) return { ok: false, error: "Tilboðið er útrunnið — hafðu samband við verktakann" };
  const { data: upd, error } = await admin.from("quotes")
    .update({ status: accept ? "accepted" : "declined", signed_name: signed, client_comment: comment.trim().slice(0, 2000) || null, decided_at: new Date().toISOString() })
    .eq("id", q.id).eq("status", "sent").select("id").maybeSingle();
  if (error || !upd) return { ok: false, error: "Tókst ekki að vista — reyndu aftur" };
  if (accept) {
    const labor = (Array.isArray(q.items) ? q.items : []).find((i: { kind?: string }) => i?.kind === "labor") as { unitPrice?: number } | undefined;
    const { data: job, error: jErr } = await admin.from("jobs").insert({
      company_id: q.company_id, client_id: q.client_id, title: q.title, address: q.address, notes: q.description,
      hourly_rate: labor?.unitPrice ?? null, status: "open", quote_id: q.id, created_by: q.created_by,
    }).select("id").single();
    if (jErr) console.error("[tilbod] job", jErr.message);
    else await admin.from("quotes").update({ job_id: job.id }).eq("id", q.id);
  }
  return { ok: true };
}
