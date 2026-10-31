import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { assistantUser, rateLimited } from "@/lib/ai/assistant-auth";
import { aiStop, bumpAiUsage } from "@/lib/ai/ai-plan.server";
import { recordAiUsage } from "@/lib/ai/usage.server";
import { MODEL_SONNET } from "@/lib/ai/models";
import { strictSchema } from "@/lib/ai/schema";

// VAKTO AI skrifar drög að tilboði (0104): verktakinn lýsir verkinu, AI stingur upp á línum (vinna í klst.,
// efni, annað) með tímagjaldi verktakans. Aðeins drög — verktakinn fer yfir og breytir áður en sent er.
// Telst ein AI-spurning.
const SCHEMA = strictSchema({
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["labor", "material", "other"] },
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          unitPrice: { type: "number" },
        },
        required: ["kind", "description", "quantity", "unit", "unitPrice"],
      },
    },
    assumptions: { type: "string" },
  },
  required: ["title", "description", "items", "assumptions"],
});

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "AI er ekki uppsett" }, { status: 503 });
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(me.userId)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });
  const stop = await aiStop(me.companyId, me.role).catch(() => null);
  if (stop) return NextResponse.json({ ok: false, error: stop.error }, { status: 402 });

  let body: { description?: string; rate?: string | number; address?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const desc = String(body.description ?? "").trim().slice(0, 3000);
  if (desc.length < 8) return NextResponse.json({ ok: false, error: "Lýstu verkinu aðeins nánar" }, { status: 400 });
  const rate = Number(String(body.rate ?? "").replace(",", ".")) || null;

  try {
    const res = await new Anthropic().messages.create({
      model: MODEL_SONNET,
      max_tokens: 4000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: `Þú ert reyndur íslenskur verktaki sem skrifar tilboð á íslensku. Út frá lýsingu skaltu stinga upp á tilboðslínum: vinnu (kind "labor", unit "klst.", unitPrice = tímagjald verktakans án vsk.), efni (kind "material", raunhæft íslenskt verð án vsk. í kr.) og annað (kind "other", t.d. förgun, akstur, leiga). Skiptu vinnu í verkþætti með raunhæfum tímafjölda. Ekki ofmeta. Öll verð án vsk., heilar krónur. title: stutt heiti verks. description: 2–4 setningar um umfang verksins fyrir viðskiptavininn. assumptions: stutt upptalning á forsendum og því sem er ekki innifalið (t.d. „Verð á efni er áætlað og getur breyst“).`,
      messages: [{ role: "user", content: `Lýsing verks: ${desc}\n${body.address ? `Staðsetning: ${String(body.address).slice(0, 200)}\n` : ""}Tímagjald: ${rate ? `${rate} kr./klst. án vsk.` : "ekki gefið — notaðu 9.500 kr./klst."}` }],
    });
    await Promise.all([bumpAiUsage(me.companyId), recordAiUsage({ model: res.model, usage: res.usage, feature: "verk_quote", companyId: me.companyId, userId: me.userId })]);
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const draft = JSON.parse(text) as { title: string; description: string; items: unknown[]; assumptions: string };
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    console.error("[verk/ai-quote]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "VAKTO AI gat ekki skrifað tilboð núna. Reyndu aftur." }, { status: 502 });
  }
}
