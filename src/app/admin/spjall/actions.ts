"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isVaktoAdmin } from "@/lib/vakto-admin.server";
import { sendEmail } from "@/lib/email";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Eigandi svarar gesti: vistað í þráðinn (widgetið pollar) og sent á netfang gestsins. */
export async function replySupport(threadId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Ekki heimilt" };
  const text = body.trim().slice(0, 4000);
  if (!text || !threadId) return { ok: false };
  const admin = createAdminClient();
  const { data: th } = await admin.from("support_threads").select("id, email, name, lang").eq("id", threadId).maybeSingle();
  if (!th) return { ok: false, error: "Þráður fannst ekki" };
  const { error } = await admin.from("support_messages").insert({ thread_id: th.id, role: "owner", body: text });
  if (error) return { ok: false, error: "Tókst ekki að vista" };
  await admin.from("support_threads").update({ status: "human", updated_at: new Date().toISOString(), owner_seen_at: new Date().toISOString() }).eq("id", th.id);
  if (th.email) {
    const en = th.lang === "en";
    void sendEmail({
      to: th.email as string,
      subject: en ? "Reply from VAKTO" : "Svar frá VAKTO",
      html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.55"><p>${en ? "Hi" : "Hæ"} ${esc((th.name as string) || "")},</p><p style="white-space:pre-wrap">${esc(text)}</p><p style="color:#777">${en ? "Reply to this email or continue the chat on" : "Svaraðu þessum pósti eða haltu spjallinu áfram á"} <a href="https://vakto.is">vakto.is</a>.</p></div>`,
    });
  }
  return { ok: true };
}

export async function setSupportStatus(threadId: string, status: "human" | "closed"): Promise<{ ok: boolean }> {
  if (!(await isVaktoAdmin())) return { ok: false };
  const admin = createAdminClient();
  await admin.from("support_threads").update({ status, updated_at: new Date().toISOString() }).eq("id", threadId);
  return { ok: true };
}

export async function markSupportSeen(threadId: string): Promise<{ ok: boolean }> {
  if (!(await isVaktoAdmin())) return { ok: false };
  const admin = createAdminClient();
  await admin.from("support_threads").update({ owner_seen_at: new Date().toISOString() }).eq("id", threadId);
  return { ok: true };
}
