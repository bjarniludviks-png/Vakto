import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Gesturinn sækir svör eigandans (pollað á meðan spjallið er opið).
export const runtime = "nodejs";
export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "", token = url.searchParams.get("token") ?? "";
  if (!id || !token) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data: th } = await admin.from("support_threads").select("id, status").eq("id", id).eq("token", token).maybeSingle();
  if (!th) return NextResponse.json({ ok: false }, { status: 404 });
  const { data: msgs } = await admin.from("support_messages").select("id, role, body, created_at").eq("thread_id", th.id).order("created_at").limit(80);
  return NextResponse.json({ ok: true, status: th.status, messages: msgs ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
