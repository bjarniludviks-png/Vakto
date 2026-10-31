import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { employeeCtx, EMPLOYEE_WRITE, describeEmployeeWrite, executeEmployeeWrite } from "@/lib/ai/employee-ai.server";

// Framkvæmir tillögu VAKTO AI fyrir starfsmann eftir „Staðfesta“ — innskráning og inntak athuguð aftur.
export async function POST(request: Request) {
  const supabase = await createClient();
  const me = await employeeCtx(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  let body: { tool?: string; input?: Record<string, unknown> } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const tool = String(body.tool ?? ""), input = body.input ?? {};
  if (!EMPLOYEE_WRITE.has(tool)) return NextResponse.json({ ok: false, error: "Óþekkt aðgerð" }, { status: 400 });
  const d = await describeEmployeeWrite(tool, input, me);
  if (!d.ok) return NextResponse.json({ ok: false, error: d.error }, { status: 400 });
  const res = await executeEmployeeWrite(tool, input, me);
  return NextResponse.json({ ok: res.ok, error: res.ok ? undefined : (res.error ?? "Tókst ekki") });
}
