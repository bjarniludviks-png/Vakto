import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assistantUser } from "@/lib/ai/assistant-auth";

// Vistuð samtöl VAKTO AI. RLS tryggir að hver notandi sjái aðeins sín eigin.
//   GET            → listi (nýjustu fyrst)
//   GET ?id=       → skilaboð eins samtals
//   PATCH          → uppfæra stöðu tillagna í skilaboðum (staðfest / hætt við)
//   DELETE ?id=    → eyða samtali
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    if (!UUID.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
    const { data, error } = await supabase.from("ai_messages").select("id, role, content, actions").eq("conversation_id", id).order("created_at").limit(200);
    if (error) return NextResponse.json({ ok: true, messages: [] });
    return NextResponse.json({ ok: true, messages: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const { data, error } = await supabase.from("ai_conversations").select("id, title, updated_at").eq("user_id", me.userId).order("updated_at", { ascending: false }).limit(40);
  if (error) return NextResponse.json({ ok: true, conversations: [], unavailable: true });
  return NextResponse.json({ ok: true, conversations: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  let body: { messageId?: string; index?: number; state?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const { messageId, index, state } = body;
  if (!messageId || !UUID.test(messageId) || typeof index !== "number" || !["done", "cancelled", "error"].includes(state ?? "")) return NextResponse.json({ ok: false }, { status: 400 });
  const { data } = await supabase.from("ai_messages").select("actions").eq("id", messageId).maybeSingle();
  const acts = (data?.actions as { state?: string }[] | null) ?? null;
  if (!acts?.[index]) return NextResponse.json({ ok: false }, { status: 404 });
  acts[index] = { ...acts[index], state };
  await supabase.from("ai_messages").update({ actions: acts }).eq("id", messageId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !UUID.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  await supabase.from("ai_conversations").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
