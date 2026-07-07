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
    // Fall back to the demo proposal so the UI always responds.
    const message = err instanceof Error ? err.message : "AI villa";
    return NextResponse.json(
      {
        summary: prompt ? `„${prompt}" — VAKTO bjó til eftirfarandi tillögu:` : "Bestun vaktaplans",
        laborPct: "31,8%",
        shifts: [],
        live: false,
        error: message,
        items: [
          { kind: "good", title: "14 vaktir búnar til", detail: "Ómar · 2-2-3 mynstur · 11:00–22:00 · maí 2026", tag: "+128 klst" },
          { kind: "info", title: "Hvíldartími virtur", detail: "11 klst milli vakta — engin brot", tag: "ok" },
          { kind: "warn", title: "Yfirvinna", detail: "4 klst yfir starfshlutfalli — staðfestu eða dreifðu", tag: "+9.800 kr" },
          { kind: "info", title: "Laun af tekjum", detail: "helst í 31,8% — undir 33% viðmiði", tag: "31,8%" },
        ],
      },
      { status: 200 },
    );
  }
}
