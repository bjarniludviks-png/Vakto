import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WRITE_NAMES, describeWrite, executeWrite } from "@/lib/ai/assistant-tools";
import { assistantUser } from "@/lib/ai/assistant-auth";
import { logAudit } from "@/lib/audit";

// Framkvæmir tillögu VAKTO AI eftir að notandinn ýtti á „Staðfesta". Hlutverk og inntak eru athuguð aftur hér;
// aðgerðirnar eru sömu server-aðgerðir og skjáirnir nota (sami aðgangur og ef notandinn gerði þetta sjálfur).
export async function POST(request: Request) {
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  let body: { tool?: string; input?: Record<string, unknown>; lang?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const tool = String(body.tool ?? ""), input = body.input ?? {};
  if (!WRITE_NAMES.has(tool)) return NextResponse.json({ ok: false, error: "Óþekkt aðgerð" }, { status: 400 });
  const d = describeWrite(tool, input, "is");
  if (!d.ok) return NextResponse.json({ ok: false, error: d.error }, { status: 400 });
  const res = await executeWrite(tool, input);
  if (res.ok) await logAudit(supabase, me.companyId, me.userId, { action: "VAKTO AI", detail: d.summary });
  return NextResponse.json({ ok: res.ok, error: res.ok ? undefined : (res.error ?? "Tókst ekki") });
}
