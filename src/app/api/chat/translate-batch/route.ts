import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODEL_HAIKU } from "@/lib/ai/models";
import { recordAiUsage } from "@/lib/ai/usage.server";
import { aiAllowance } from "@/lib/ai/ai-plan.server";
import { rateLimited } from "@/lib/ai/assistant-auth";

// Sjálfvirk þýðing spjalls (0103): þýðir mörg skilaboð í einu á tungumál lesandans og vistar
// niðurstöðuna (message_translations) svo hver skilaboð séu aðeins þýdd einu sinni per tungumál.
// Skilaboðin eru lesin með lykli notandans — RLS tryggir að hann megi sjá þau.
// Skilar { translations: { [id]: texti | null } } — null = skilaboðin eru þegar á tungumálinu.
const LANG_NAME: Record<string, string> = { is: "Icelandic", en: "English", vi: "Vietnamese", pl: "Polish" };
const MAX = 40;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "Þýðing er ekki uppsett" }, { status: 503 });
  let body: { ids?: unknown; lang?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const lang = LANG_NAME[body.lang ?? ""] ? body.lang! : "is";
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, MAX);
  if (!ids.length) return NextResponse.json({ ok: true, translations: {} });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  if (rateLimited(`trb:${user.id}`, 30)) return NextResponse.json({ ok: false, error: "Of margar þýðingar í einu — bíddu aðeins." }, { status: 429 });

  const [{ data: msgs }, { data: cached }] = await Promise.all([
    supabase.from("messages").select("id, body, kind, company_id").in("id", ids),
    supabase.from("message_translations").select("message_id, body").eq("lang", lang).in("message_id", ids),
  ]);
  const out: Record<string, string | null> = {};
  for (const c of cached ?? []) out[c.message_id as string] = (c.body as string | null) ?? null;
  const todo = (msgs ?? []).filter((m) => !(m.id in out) && m.kind !== "file" && typeof m.body === "string" && m.body.trim());
  if (!todo.length) return NextResponse.json({ ok: true, translations: out });

  const companyId = todo[0].company_id as string;
  const a = await aiAllowance(companyId).catch(() => null);
  if (a && a.costIsk > a.costCapIsk) return NextResponse.json({ ok: true, translations: out, paused: true });

  try {
    const input = todo.map((m, i) => ({ i, text: String(m.body).slice(0, 2000) }));
    const res = await new Anthropic().messages.create({
      model: MODEL_HAIKU,
      max_tokens: 4000,
      system: `You translate workplace chat messages into ${LANG_NAME[lang]}. You get a JSON array of {i, text}. Reply with ONLY a JSON array of {i, t} in the same order: t is the translation into ${LANG_NAME[lang]}, or null if the text is already in ${LANG_NAME[lang]} (or is only emoji, numbers, names or links). Keep names, emoji and tone. No notes.`,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await recordAiUsage({ model: res.model, usage: res.usage, feature: "chat_translate", companyId, userId: user.id });
    const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1)) as { i: number; t: string | null }[];
    const rows: { message_id: string; lang: string; body: string | null }[] = [];
    for (const r of arr) {
      const m = todo[r.i];
      if (!m) continue;
      const t = typeof r.t === "string" && r.t.trim() && r.t.trim() !== String(m.body).trim() ? r.t.trim() : null;
      out[m.id as string] = t;
      rows.push({ message_id: m.id as string, lang, body: t });
    }
    if (rows.length) {
      const { error } = await createAdminClient().from("message_translations").upsert(rows);
      if (error) console.error("[chat-translate-batch] save", error.message);
    }
    return NextResponse.json({ ok: true, translations: out });
  } catch (e) {
    console.error("[chat-translate-batch]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Þýðing tókst ekki", translations: out }, { status: 502 });
  }
}
