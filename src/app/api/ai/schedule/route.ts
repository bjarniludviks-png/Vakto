import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiScheduleProposal, type AiItem } from "@/lib/ai/schedule";
import { assistantUser, rateLimited } from "@/lib/ai/assistant-auth";
import { demoAiGate } from "@/lib/ai/ai-plan.server";
import { isDemoCompany } from "@/lib/demo.server";
import { ndjsonStream, NDJSON_HEADERS, type ScheduleEvent } from "@/lib/ai/stream";
import { getPlanRequests, formatPlanRequests, guardLeaveShifts, weekDatesFrom, dayShortIS, type PlanRequests } from "@/lib/ai/plan-requests.server";

// AI-tillaga að vaktaplani — aðeins stjórnendur og vaktstjórar, með sömu takmörkun og VAKTO AI.
export async function POST(request: Request) {
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(me.userId)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });
  const demoStop = await demoAiGate();
  if (demoStop) return NextResponse.json({ ok: false, error: demoStop }, { status: 429 });

  let prompt = "";
  let context = "";
  let lang = "is";
  let dates: string[] | null = null;
  try {
    const body = await request.json();
    prompt = String(body.prompt ?? "").slice(0, 2000);
    context = String(body.context ?? "").slice(0, 20000);
    lang = body.lang === "en" ? "en" : body.lang === "vi" ? "vi" : body.lang === "pl" ? "pl" : "is";
    dates = weekDatesFrom(body.weekStart);
  } catch {
    /* empty body is fine */
  }

  // Svarið er streymt sem NDJSON (lib/ai/stream.ts) svo skjárinn sýni framvindu: les beiðnir → hugsar →
  // skrifar tillöguna (fjöldi vakta jafnóðum) → „done“ með tillögunni (sama innihald og JSON-svarið var).
  const demo = isDemoCompany(me.companyId);
  const stream = ndjsonStream<ScheduleEvent>(async (send) => {
    // Beiðnir/frí/framboð vikunnar sótt á þjóninum (RLS + fyrirtæki notandans), ekki tekið úr vafranum.
    let reqs: PlanRequests | null = null;
    if (dates) {
      send({ t: "stage", stage: "read" });
      try {
        reqs = await getPlanRequests(supabase, me.companyId, dates);
      } catch (err) {
        console.error("[ai/schedule] requests", err instanceof Error ? err.message : err);
      }
    }
    send({ t: "stage", stage: "think" });
    try {
      let last = "";
      const proposal = await getAiScheduleProposal(prompt, context, lang, reqs ? formatPlanRequests(reqs) : "", { demo }, (p) => {
        const key = `${p.stage}:${p.shifts}`;
        if (key === last) return;
        if (p.stage !== last.split(":")[0]) send({ t: "stage", stage: p.stage });
        if (p.stage === "write") send({ t: "progress", shifts: p.shifts });
        last = key;
      });
      // Varnagli óháður líkaninu: vaktir á samþykktu fríi fara aldrei í planið.
      let blocked: { employee: string; day: number }[] = [];
      if (reqs && proposal.shifts?.length) {
        const { kept, dropped } = guardLeaveShifts(proposal.shifts, reqs, (s) => s.day);
        if (dropped.length) {
          proposal.shifts = kept;
          blocked = dropped.map((s) => ({ employee: s.employee, day: s.day }));
          const list = dropped.map((s) => `${s.employee} ${dayShortIS(s.day)} ${s.start}–${s.end}`).join(", ");
          const item: AiItem = lang === "is"
            ? { kind: "bad", title: "Vöktum á samþykktu fríi sleppt", detail: `${list} — starfsmaður er í samþykktu fríi. Mannaðu daginn handvirkt ef þarf.`, tag: `−${dropped.length} vakt${dropped.length === 1 ? "" : "ir"}` }
            : { kind: "bad", title: "Shifts on approved leave removed", detail: `${list} — the employee is on approved leave. Cover the day manually if needed.`, tag: `−${dropped.length}` };
          proposal.items = [item, ...(proposal.items ?? [])];
        }
      }
      send({ ...proposal, blocked, t: "done", ok: true });
    } catch (err) {
      // No demo proposal: the UI shows the error and the user can retry.
      console.error("[ai/schedule]", err instanceof Error ? err.message : err);
      send({ t: "done", ok: false, error: lang === "en" ? "The AI could not build a plan right now. Try again." : "AI gat ekki búið til plan núna. Reyndu aftur." });
    }
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}
