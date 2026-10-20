import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiScheduleProposal, type AiItem } from "@/lib/ai/schedule";
import { assistantUser, rateLimited } from "@/lib/ai/assistant-auth";
import { getPlanRequests, formatPlanRequests, guardLeaveShifts, weekDatesFrom, dayShortIS, type PlanRequests } from "@/lib/ai/plan-requests.server";

// AI-tillaga að vaktaplani — aðeins stjórnendur og vaktstjórar, með sömu takmörkun og VAKTO AI.
export async function POST(request: Request) {
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(me.userId)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });

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

  // Beiðnir/frí/framboð vikunnar sótt á þjóninum (RLS + fyrirtæki notandans), ekki tekið úr vafranum.
  let reqs: PlanRequests | null = null;
  if (dates) {
    try {
      reqs = await getPlanRequests(supabase, me.companyId, dates);
    } catch (err) {
      console.error("[ai/schedule] requests", err instanceof Error ? err.message : err);
    }
  }

  try {
    const proposal = await getAiScheduleProposal(prompt, context, lang, reqs ? formatPlanRequests(reqs) : "");
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
    return NextResponse.json({ ...proposal, blocked });
  } catch (err) {
    // No demo proposal: the UI shows the error and the user can retry.
    console.error("[ai/schedule]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: lang === "en" ? "The AI could not build a plan right now. Try again." : "AI gat ekki búið til plan núna. Reyndu aftur." }, { status: 502 });
  }
}
