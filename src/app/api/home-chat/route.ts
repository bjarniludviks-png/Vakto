import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { systemPrompt } from "@/lib/ai/vakto-knowledge";

// Spjallgaurinn á heimasíðunni. Gestir eru ekki innskráðir — hver þráður er
// auðkenndur með handahófs-token sem vafrinn geymir. Skrifað með service-role.

export const runtime = "nodejs";
const MODEL = "claude-sonnet-5";
const MAX_LEN = 1200;
const MAX_TURNS = 40;         // skilaboð per þráð
const MAX_PER_MIN = 12;       // per IP

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_PER_MIN;
}
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

type Msg = { role: "user" | "assistant" | "owner"; body: string };

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  if (limited(ip)) return NextResponse.json({ ok: false, error: "Of mörg skilaboð — reyndu eftir smástund." }, { status: 429 });
  let payload: { message?: string; lang?: string; threadId?: string; token?: string; page?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const text = (payload.message ?? "").toString().trim().slice(0, MAX_LEN);
  const lang: "is" | "en" = payload.lang === "en" ? "en" : "is";
  if (!text) return NextResponse.json({ ok: false }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  const admin = createAdminClient();
  // þráður: sækja með id+token, annars stofna
  let threadId = payload.threadId ?? null, token = payload.token ?? null, status = "bot";
  if (threadId && token) {
    const { data } = await admin.from("support_threads").select("id, status").eq("id", threadId).eq("token", token).maybeSingle();
    if (!data) { threadId = null; token = null; } else status = data.status as string;
  }
  if (!threadId || !token) {
    token = newToken();
    const { data, error } = await admin.from("support_threads").insert({ token, lang, page: (payload.page ?? "").toString().slice(0, 200) }).select("id").single();
    if (error || !data) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    threadId = data.id as string;
  }
  const { data: prior } = await admin.from("support_messages").select("role, body").eq("thread_id", threadId).order("created_at").limit(MAX_TURNS + 5);
  if ((prior?.length ?? 0) >= MAX_TURNS) return NextResponse.json({ ok: false, error: "Þráðurinn er orðinn langur — sendu okkur póst á hallo@vakto.is." }, { status: 429 });
  await admin.from("support_messages").insert({ thread_id: threadId, role: "user", body: text });
  await admin.from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

  // Eigandi hefur tekið við: engin AI-svör, gesturinn bíður svars (widget pollar).
  if (status === "human") return NextResponse.json({ ok: true, threadId, token, reply: null, status });

  if (!process.env.ANTHROPIC_API_KEY) {
    const reply = lang === "en" ? "The assistant is offline right now — email us at hallo@vakto.is and we'll get back to you." : "Aðstoðin er ekki virk í augnablikinu — sendu okkur póst á hallo@vakto.is og við svörum þér.";
    await admin.from("support_messages").insert({ thread_id: threadId, role: "assistant", body: reply });
    return NextResponse.json({ ok: true, threadId, token, reply, status });
  }
  try {
    const history = [...(prior as Msg[] ?? []), { role: "user" as const, body: text }]
      .filter((m) => m.role !== "owner")
      .slice(-16)
      .map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: m.body }));
    // Anthropic krefst þess að fyrsta skilaboð sé frá user og hlutverk skiptist á
    const merged: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of history) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) last.content += "\n" + m.content; else merged.push({ ...m });
    }
    while (merged.length && merged[0].role !== "user") merged.shift();
    const client = new Anthropic();
    const res = await client.messages.create({ model: MODEL, max_tokens: 500, system: systemPrompt(lang), messages: merged });
    const reply = res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("").trim()
      || (lang === "en" ? "I'm not sure about that — want to talk to a person?" : "Ég er ekki viss um þetta — viltu tala við manneskju?");
    await admin.from("support_messages").insert({ thread_id: threadId, role: "assistant", body: reply });
    return NextResponse.json({ ok: true, threadId, token, reply, status });
  } catch (e) {
    console.error("home-chat:", e instanceof Error ? e.message : e);
    const reply = lang === "en" ? "Something went wrong on my end — try again, or email hallo@vakto.is." : "Eitthvað fór úrskeiðis hjá mér — reyndu aftur eða sendu póst á hallo@vakto.is.";
    return NextResponse.json({ ok: true, threadId, token, reply, status });
  }
}
