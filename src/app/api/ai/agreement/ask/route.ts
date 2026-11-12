import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { aiGate } from "@/lib/ai/ai-plan.server";
import { currentUserIsDemo } from "@/lib/demo.server";
import { modelFor } from "@/lib/ai/models";
import { recordAiUsage } from "@/lib/ai/usage.server";
import { agreementById, describeRules, rulesOf } from "@/lib/agreements";
import { templateToPayRule, type RuleSet } from "@/lib/rules";

// „Spyrja um samninginn“: spurning um eitt afbrigði í Kjarasamningasafninu (eða eigin reglu fyrirtækisins).
// Samhengið er ÞAÐ SEM VAKTO REIKNAR EFTIR (reglan, orlofsþrep, óstaðfest atriði, heimild) — AI svarar út frá
// því og segir hreint út þegar svarið er ekki þar. Aðeins stjórnendur. Telur sem AI-spurning (aiGate) + kostnaður.
export const maxDuration = 60;

const SYSTEM = `Þú svarar spurningum stjórnanda um kjarasamning í VAKTO (vakta- og launakerfi).
Reglur:
- Svaraðu AÐEINS út frá samhenginu hér á eftir (reglan sem VAKTO reiknar eftir, orlofsþrep, atriði og óstaðfest atriði). Vísaðu í grein (gr.) þegar hún er gefin.
- Ef svarið er ekki í samhenginu: segðu það hreint út og bentu á heimildina (samningstextann) — giskaðu aldrei á tölur.
- Ef atriði er merkt óstaðfest, taktu það fram.
- Hreinn texti: stuttar línur og „- “ fyrir upptalningu, engar fyrirsagnir (#) eða töflur.
- Stutt og skýrt, á máli spurningarinnar (íslensku nema spurt sé á öðru máli). Engin lögfræðiráðgjöf — mæltu með að staðfesta við stéttarfélagið þegar mikið liggur við.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  const { data: u } = await supabase.from("users").select("role, company_id").eq("id", user.id).maybeSingle();
  if (u?.role !== "owner" && u?.role !== "manager") return NextResponse.json({ ok: false, error: "Aðeins stjórnendur" }, { status: 403 });

  let body: { agreementId?: string; templateId?: string; question?: string; history?: { q: string; a: string }[] };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 }); }
  const question = String(body.question ?? "").trim().slice(0, 1000);
  if (question.length < 3) return NextResponse.json({ ok: false, error: "Skrifaðu spurningu" }, { status: 400 });

  let context = "";
  if (body.agreementId) {
    const a = agreementById(body.agreementId);
    if (!a) return NextResponse.json({ ok: false, error: "Samningur fannst ekki" }, { status: 404 });
    context = [
      `Samningur: ${a.union} og SA — ${a.title} (${a.kind}). Gildistími ${a.validity}. Staða í VAKTO: ${a.status === "verified" ? "staðfest gegn samningstexta" : a.status === "partial" ? "staðfest að hluta" : "óstaðfest"}.`,
      `Fyrir hverja: ${a.who}`, `Vinnutími: ${a.hours}`,
      `Launaregla sem VAKTO reiknar eftir:`, ...describeRules(rulesOf(a)).map((l) => `- ${l.label}: ${l.value}${l.detail ? ` (${l.detail})` : ""}`),
      `Önnur atriði:`, ...a.points.map((p) => `- ${p.label}: ${p.text}${p.ref ? ` [${p.ref}]` : ""}`),
      `Orlofsþrep:`, ...a.orlof.flatMap((g) => g.steps.map((s) => `- ${g.group ? `${g.group}: ` : ""}${s.days} dagar / ${String(s.pct).replace(".", ",")} % — ${s.when} [${g.ref}]`)),
      a.unverified.length ? `Óstaðfest / einfaldað í VAKTO:\n${a.unverified.map((x) => `- ${x}`).join("\n")}` : "",
      `Heimild: ${a.source.label} — ${a.source.url}`,
    ].filter(Boolean).join("\n");
  } else if (body.templateId && u?.company_id) {
    const { data: tpl } = await supabase.from("rule_templates").select("name, rules").eq("id", body.templateId).eq("company_id", u.company_id).maybeSingle();
    if (!tpl) return NextResponse.json({ ok: false, error: "Reglan fannst ekki" }, { status: 404 });
    const r = tpl.rules as RuleSet;
    context = [
      `Eigin regla fyrirtækisins: ${tpl.name}`, ...describeRules(templateToPayRule(r)).map((l) => `- ${l.label}: ${l.value}${l.detail ? ` (${l.detail})` : ""}`),
      r.notes ? `Athugasemdir: ${r.notes}` : "",
      r.sources?.length ? `Tilvitnanir úr samningi:\n${r.sources.map((s) => `- ${s.field} = ${s.value} (${s.location}): „${s.quote}“`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
  } else return NextResponse.json({ ok: false, error: "Veldu samning" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "AI er ekki virkt." }, { status: 503 });
  const stop = await aiGate();
  if (stop) return NextResponse.json({ ok: false, error: stop }, { status: 429 });

  const history = (body.history ?? []).slice(-4).flatMap((h) => [
    { role: "user" as const, content: String(h.q).slice(0, 1000) },
    { role: "assistant" as const, content: String(h.a).slice(0, 3000) },
  ]);
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: modelFor("chat", { demo: await currentUserIsDemo() }),
      max_tokens: 1200,
      system: [{ type: "text", text: SYSTEM }, { type: "text", text: `Samhengi:\n${context}` }],
      messages: [...history, { role: "user", content: question }],
    });
    await recordAiUsage({ model: msg.model, usage: msg.usage, feature: "agreement_qa" });
    const answer = msg.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    if (!answer) return NextResponse.json({ ok: false, error: "Ekkert svar" }, { status: 502 });
    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    console.error("[agreement-qa]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "AI svaraði ekki — reyndu aftur." }, { status: 502 });
  }
}
