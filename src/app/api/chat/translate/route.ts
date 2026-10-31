import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { MODEL_HAIKU } from "@/lib/ai/models";
import { recordAiUsage } from "@/lib/ai/usage.server";
import { aiAllowance } from "@/lib/ai/ai-plan.server";
import { rateLimited } from "@/lib/ai/assistant-auth";

// Þýðing spjallskilaboða á tungumál lesandans (allt starfsfólk, ekki bara stjórnendur).
// Skilaboðin eru lesin með lykli notandans svo RLS tryggir að hann megi sjá þau.
// Telst ekki til AI-spurninga leiðarinnar (Haiku, örfáir tókar) en virðir kostnaðarþakið.
const LANG_NAME: Record<string, string> = { is: "Icelandic", en: "English", vi: "Vietnamese", pl: "Polish" };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "Þýðing er ekki uppsett" }, { status: 503 });
  let body: { messageId?: string; lang?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const lang = LANG_NAME[body.lang ?? ""] ? body.lang! : "is";
  if (!body.messageId) return NextResponse.json({ ok: false, error: "Vantar skilaboð" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  if (rateLimited(`tr:${user.id}`, 60)) return NextResponse.json({ ok: false, error: "Of margar þýðingar í einu — bíddu aðeins." }, { status: 429 });

  const { data: msg } = await supabase.from("messages").select("body, kind, company_id").eq("id", body.messageId).maybeSingle();
  const text = (msg?.body as string | null)?.trim();
  if (!msg || !text || msg.kind === "file") return NextResponse.json({ ok: false, error: "Ekkert að þýða" }, { status: 404 });

  const companyId = msg.company_id as string;
  const a = await aiAllowance(companyId).catch(() => null);
  if (a && a.costIsk > a.costCapIsk) return NextResponse.json({ ok: false, error: "Þýðing er í hléi út mánuðinn." }, { status: 402 });

  try {
    const res = await new Anthropic().messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1000,
      system: `You translate workplace chat messages into ${LANG_NAME[lang]}. Reply with the translation only — no quotes, notes or explanations. Keep names, emoji and tone. If the message is already in ${LANG_NAME[lang]}, return it unchanged.`,
      messages: [{ role: "user", content: text.slice(0, 4000) }],
    });
    await recordAiUsage({ model: res.model, usage: res.usage, feature: "chat_translate", companyId, userId: user.id });
    const out = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return NextResponse.json({ ok: true, text: out || text });
  } catch (e) {
    console.error("[chat-translate]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Þýðing tókst ekki" }, { status: 502 });
  }
}
