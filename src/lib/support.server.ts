import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Beiðni til þjónustuvers VAKTO úr kerfinu (VAKTO AI → contact_support). Notar sama innhólf og
// spjallið á heimasíðunni (support_threads/support_messages, migration 0049): þráðurinn birtist í
// VAKTO Admin → Spjall með stöðuna „human“, eigandinn fær póst og svar hans fer í tölvupósti á notandann.

const ADMIN_TO = () => (process.env.VAKTO_ADMIN_EMAILS || "bjarniludviks@icloud.com").split(",")[0].trim();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export type SupportRequest = {
  userId: string;
  name: string;
  email: string;
  company: string;
  role: string;
  subject: string;
  summary: string;
  /** Samtalið við VAKTO AI (valfrjálst), í tímaröð. */
  transcript?: { role: "user" | "assistant"; content: string }[];
  page?: string;
  lang?: string;
};

export async function createSupportRequest(r: SupportRequest): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const lang = r.lang === "en" ? "en" : "is";
  const page = `Kerfið · ${r.company}${r.page ? ` · ${r.page}` : ""}`.slice(0, 300);
  const { data: th, error } = await admin.from("support_threads")
    .insert({ token: randomBytes(24).toString("hex"), name: r.name.slice(0, 120), email: r.email.slice(0, 200), lang, status: "human", page })
    .select("id").single();
  if (error || !th) {
    console.error("[support] thread", error?.message);
    return { ok: false, error: "Tókst ekki að stofna beiðnina — sendu póst á hjalp@vakto.is." };
  }
  const head = `Beiðni úr VAKTO AI — ${r.subject}\n\n${r.summary}\n\n(${r.name}, ${r.role === "owner" ? "stjórnandi" : "vaktstjóri"} hjá ${r.company})`;
  const rows: { thread_id: string; role: "user" | "assistant"; body: string }[] = [{ thread_id: th.id as string, role: "user", body: head.slice(0, 4000) }];
  for (const m of (r.transcript ?? []).slice(-12)) rows.push({ thread_id: th.id as string, role: m.role, body: `[Samtal við VAKTO AI] ${m.content}`.slice(0, 2000) });
  await admin.from("support_messages").insert(rows);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
  const convo = (r.transcript ?? []).slice(-12)
    .map((m) => `<p style="margin:4px 0"><b>${m.role === "user" ? esc(r.name) : "VAKTO AI"}:</b> ${esc(m.content.slice(0, 1200))}</p>`).join("");
  await sendEmail({
    to: ADMIN_TO(),
    replyTo: r.email,
    internal: true,
    subject: `Þjónustubeiðni: ${r.subject} — ${r.company}`.slice(0, 160),
    html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.55">
<p><b>${esc(r.name)}</b> (${esc(r.email)}), ${r.role === "owner" ? "stjórnandi" : "vaktstjóri"} hjá <b>${esc(r.company)}</b>, sendi beiðni úr VAKTO AI${r.page ? ` á síðunni ${esc(r.page)}` : ""}.</p>
<p style="white-space:pre-wrap;background:#f5f5f7;border-radius:10px;padding:12px"><b>${esc(r.subject)}</b>\n${esc(r.summary)}</p>
${convo ? `<p style="color:#777;margin-top:16px">Samtalið:</p>${convo}` : ""}
<p><a href="${appUrl}/admin/spjall?t=${th.id}">Svara í VAKTO Admin →</a> (eða svaraðu þessum pósti beint)</p></div>`,
  }).catch((e) => console.error("[support] email", e instanceof Error ? e.message : e));
  return { ok: true };
}
