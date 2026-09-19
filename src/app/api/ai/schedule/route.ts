import { NextResponse } from "next/server";
import { getAiScheduleProposal, isAiConfigured } from "@/lib/ai/schedule";

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: "AI-vaktaplan er ekki virkt á þessum reikningi." }, { status: 503 });
  }

  let prompt = "";
  let context = "";
  try {
    const body = await request.json();
    prompt = String(body.prompt ?? "");
    context = String(body.context ?? "");
  } catch {
    /* empty body is fine */
  }

  try {
    const proposal = await getAiScheduleProposal(prompt, context);
    return NextResponse.json({ ok: true, ...proposal });
  } catch (err) {
    // No canned proposal — report the failure honestly and log the detail.
    console.error("[ai/schedule]", err);
    const message = err instanceof Error ? err.message : "Óþekkt villa";
    return NextResponse.json({ ok: false, error: `Tókst ekki að búa til tillögu: ${message}` }, { status: 502 });
  }
}
