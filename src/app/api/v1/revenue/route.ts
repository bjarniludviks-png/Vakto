import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// VAKTO open Revenue API — any POS/middleware can push sales figures.
//
//   POST /api/v1/revenue
//   Authorization: Bearer vk_live_…        (create keys in Stillingar → Tengingar)
//   { "date": "2026-08-08", "amount": 214500, "location": "Kringlan" }
//
// `date` defaults to today, `location` to the company's first location.
// Amount is ISK (whole numbers). Idempotency is the caller's concern —
// each POST inserts one revenue row (source: "api").

type Body = { date?: string; amount?: number | string; location?: string };

const err = (status: number, message: string) => NextResponse.json({ ok: false, error: message }, { status });

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return err(503, "Supabase not configured");
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!key.startsWith("vk_")) return err(401, "Missing API key — send Authorization: Bearer vk_live_…");

  const admin = createAdminClient();
  const hash = createHash("sha256").update(key).digest("hex");
  const { data: k } = await admin
    .from("api_keys").select("id, company_id, revoked").eq("key_hash", hash).maybeSingle();
  if (!k || k.revoked) return err(401, "Invalid or revoked API key");

  let body: Body;
  try { body = await req.json(); } catch { return err(400, "Body must be JSON"); }
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return err(400, "amount must be a positive number (ISK)");
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");

  const { data: locs } = await admin
    .from("locations").select("id, name").eq("company_id", k.company_id);
  const loc = body.location
    ? locs?.find((l) => (l.name as string).toLowerCase() === body.location!.toLowerCase())
    : locs?.[0];
  if (!loc) return err(400, body.location ? `Unknown location "${body.location}"` : "Company has no locations yet");

  const { error } = await admin.from("revenue").insert({ location_id: loc.id, date, amount, source: "api" });
  if (error) return err(500, error.message);
  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id).then(() => {});
  return NextResponse.json({ ok: true, date, amount, location: loc.name });
}
