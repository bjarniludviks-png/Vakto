import { NextResponse } from "next/server";
import { getAiScheduleProposal } from "@/lib/ai/schedule";

export async function POST(request: Request) {
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
    return NextResponse.json(proposal);
  } catch (err) {
    // No demo proposal: the UI shows the error and the user can retry.
    const message = err instanceof Error ? err.message : "AI villa";
    console.error("[ai/schedule]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
