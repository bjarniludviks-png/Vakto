import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiScheduleProposal } from "@/lib/ai/schedule";
import { assistantUser, rateLimited } from "@/lib/ai/assistant-auth";

// AI-tillaga að vaktaplani — aðeins stjórnendur og vaktstjórar, með sömu takmörkun og VAKTO AI.
export async function POST(request: Request) {
  const me = await assistantUser(await createClient());
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(me.userId)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });

  let prompt = "";
  let context = "";
  let lang = "is";
  try {
    const body = await request.json();
    prompt = String(body.prompt ?? "").slice(0, 2000);
    context = String(body.context ?? "").slice(0, 20000);
    lang = body.lang === "en" ? "en" : body.lang === "vi" ? "vi" : "is";
  } catch {
    /* empty body is fine */
  }

  try {
    const proposal = await getAiScheduleProposal(prompt, context, lang);
    return NextResponse.json(proposal);
  } catch (err) {
    // No demo proposal: the UI shows the error and the user can retry.
    console.error("[ai/schedule]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: lang === "en" ? "The AI could not build a plan right now. Try again." : "AI gat ekki búið til plan núna. Reyndu aftur." }, { status: 502 });
  }
}
