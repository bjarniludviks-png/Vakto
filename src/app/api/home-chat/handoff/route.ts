import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendEmail } from "@/lib/email";

// „Tala við manneskju": gesturinn skilur eftir nafn + netfang, þráðurinn
// færist til eigandans (admin → Spjall) og eigandinn fær póst.
export const runtime = "nodejs";
const ADMIN_TO = (process.env.VAKTO_ADMIN_EMAILS || "bjarniludviks@icloud.com").split(",")[0].trim();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  let p: { threadId?: string; token?: string; name?: string; email?: string; message?: string; lang?: string };
  try { p = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const name = (p.name ?? "").toString().trim().slice(0, 120);
  const email = (p.email ?? "").toString().trim().slice(0, 200);
  const message = (p.message ?? "").toString().trim().slice(0, 2000);
  if (!p.threadId || !p.token || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: "Netfang vantar." }, { status: 400 });
  const admin = createAdminClient();
  const { data: th } = await admin.from("support_threads").select("id").eq("id", p.threadId).eq("token", p.token).maybeSingle();
  if (!th) return NextResponse.json({ ok: false }, { status: 404 });
  await admin.from("support_threads").update({ name, email, status: "human", updated_at: new Date().toISOString() }).eq("id", th.id);
  if (message) await admin.from("support_messages").insert({ thread_id: th.id, role: "user", body: message });
  const { data: msgs } = await admin.from("support_messages").select("role, body").eq("thread_id", th.id).order("created_at").limit(30);
  const transcript = (msgs ?? []).map((m) => `<p><b>${m.role === "user" ? esc(name || "Gestur") : m.role === "assistant" ? "VAKTO-aðstoð" : "Þú"}:</b> ${esc(m.body as string)}</p>`).join("");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
  void sendEmail({
    to: ADMIN_TO,
    subject: `Spjall á vakto.is: ${name || email} vill tala við þig`,
    html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5"><p><b>${esc(name || "Gestur")}</b> (${esc(email)}) bað um manneskju í spjallinu á heimasíðunni.</p>${transcript}<p><a href="${appUrl}/admin/spjall?t=${th.id}">Svara í VAKTO Admin →</a></p></div>`,
  });
  return NextResponse.json({ ok: true });
}
