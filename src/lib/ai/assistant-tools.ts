import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getDashboardPeriod } from "@/app/(app)/maelabord/actions";
import { getWhoIsOn } from "@/app/(app)/timaskraning/attendance.server";
import { fetchAttendance, setClockOut } from "@/app/(app)/timaskraning/actions";
import { getShiftsInRange, saveShift, deleteShift, updateLeaveRequest, approveShiftSwap } from "@/app/(app)/vaktaplan/actions";
import { getPendingRequests } from "@/app/(app)/vaktaplan/requests.server";

// VAKTO AI — verkfæri. LESverkfæri keyra strax (sömu aðgerðir og skjáirnir nota, sama aðgangsstýring).
// SKRIFverkfæri keyra ALDREI í líkaninu sjálfu: þau verða „tillaga" sem notandinn staðfestir með hnappi,
// og /api/assistant/execute framkvæmir hana eftir að hafa athugað innskráningu og hlutverk aftur.

const DATE = { type: "string", description: "YYYY-MM-DD" } as const;
const TIME = { type: "string", description: "HH:MM (24 klst.)" } as const;

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: "labor_summary",
    description: "Laun sem % af veltu, velta, launakostnaður, unnir og áætlaðir tímar, frávik og kostnaður þess, yfirvinna og álag, og tölur per starfsmann, fyrir tímabil.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "who_is_on_now",
    description: "Hverjir eru stimplaðir inn núna (og síðan hvenær), og hverjir á plani dagsins hafa ekki mætt.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "staff_hours",
    description: "Áætlaðir og unnir tímar per starfsmann á tímabili, frávik og kostnaður.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "shifts",
    description: "Vaktir á tímabili (nafn, deild, dagsetning, tímar, vaktategund). Notaðu til að skoða vaktaplan áður en þú leggur til breytingar.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "pending_requests",
    description: "Opnar beiðnir starfsfólks: frí-beiðnir, vaktaskipti og óframboð, með auðkennum (id) sem þarf til að afgreiða þær.",
    input_schema: { type: "object", properties: {} },
  },
];

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "set_shift",
    description: "LEGGJA TIL að setja eða breyta vakt starfsmanns á dagsetningu. Framkvæmist ekki fyrr en notandinn staðfestir.",
    input_schema: {
      type: "object",
      properties: { employee: { type: "string", description: "Fornafn starfsmanns eins og það birtist í kerfinu" }, date: DATE, start: TIME, end: TIME, shiftType: { type: "string", description: "Heiti vaktategundar, t.d. Dagvakt (valfrjálst)" } },
      required: ["employee", "date", "start", "end"],
    },
  },
  {
    name: "remove_shift",
    description: "LEGGJA TIL að eyða vakt starfsmanns á dagsetningu. Framkvæmist ekki fyrr en notandinn staðfestir.",
    input_schema: { type: "object", properties: { employee: { type: "string" }, date: DATE }, required: ["employee", "date"] },
  },
  {
    name: "decide_leave",
    description: "LEGGJA TIL að samþykkja eða hafna frí-beiðni (id úr pending_requests).",
    input_schema: { type: "object", properties: { id: { type: "string" }, approve: { type: "boolean" }, label: { type: "string", description: "Stutt lýsing, t.d. „Frí-beiðni Mínu 12.–14. okt.“" } }, required: ["id", "approve", "label"] },
  },
  {
    name: "approve_swap",
    description: "LEGGJA TIL að samþykkja vaktaskipti (id úr pending_requests).",
    input_schema: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } }, required: ["id", "label"] },
  },
  {
    name: "clock_out",
    description: "LEGGJA TIL að stimpla starfsmann út (t.d. ef hann gleymdi því) á tilteknum tíma í dag.",
    input_schema: { type: "object", properties: { employee: { type: "string" }, time: TIME }, required: ["employee", "time"] },
  },
];

export const WRITE_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

type In = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const okDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(v));
const okTime = (v: unknown) => /^\d{1,2}:\d{2}$/.test(str(v));

/** Keyrir lesverkfæri og skilar JSON-streng fyrir líkanið. */
export async function runReadTool(name: string, input: In): Promise<string> {
  try {
    if (name === "labor_summary" || name === "staff_hours" || name === "shifts") {
      if (!okDate(input.from) || !okDate(input.to)) return JSON.stringify({ error: "from/to verða að vera YYYY-MM-DD" });
      const from = str(input.from), to = str(input.to);
      if (name === "labor_summary") {
        const d = await getDashboardPeriod(from, to);
        const { series: _s, ...rest } = d; void _s;
        return JSON.stringify(rest);
      }
      if (name === "staff_hours") return JSON.stringify((await fetchAttendance(from, to)).rows.map(({ c: _c, av: _a, ...r }) => r));
      const res = await getShiftsInRange(from, to);
      return JSON.stringify(res.rows.slice(0, 400));
    }
    if (name === "who_is_on_now") {
      const w = await getWhoIsOn();
      return JSON.stringify({
        onShift: w.rows.map((r) => ({ name: r.name, dept: r.dept, since: r.in, unscheduled: !!r.unscheduled })),
        notArrived: w.missing.map((m) => ({ name: m.name, dept: m.dept, plannedStart: m.start, late: m.late, minutes: m.mins })),
      });
    }
    if (name === "pending_requests") {
      const r = await getPendingRequests();
      return JSON.stringify(r.items.filter((i) => i.id).map((i) => ({ id: i.id, kind: i.kind, title: i.title, detail: i.detail, hints: i.hints?.map((h) => h.text) })));
    }
    return JSON.stringify({ error: "Óþekkt verkfæri" });
  } catch (e) {
    console.error("[assistant tool]", name, e);
    return JSON.stringify({ error: "Tókst ekki að sækja gögnin" });
  }
}

/** Ein staðfestingartillaga sem UI sýnir með „Staðfesta"-hnappi. */
export type PendingAction = { tool: string; input: In; summary: string };

/** Sannreynir inntak skrifverkfæris og býr til lýsingu fyrir notandann (ekkert framkvæmt). */
export function describeWrite(name: string, input: In, lang: string): { ok: true; summary: string } | { ok: false; error: string } {
  const en = lang === "en";
  const who = str(input.employee);
  switch (name) {
    case "set_shift":
      if (!who || !okDate(input.date) || !okTime(input.start) || !okTime(input.end)) return { ok: false, error: "Vantar starfsmann, dagsetningu eða tíma (HH:MM)" };
      return { ok: true, summary: en ? `Set ${who}'s shift on ${input.date}: ${input.start}–${input.end}${str(input.shiftType) ? ` (${input.shiftType})` : ""}` : `Setja vakt hjá ${who} ${input.date}: ${input.start}–${input.end}${str(input.shiftType) ? ` (${input.shiftType})` : ""}` };
    case "remove_shift":
      if (!who || !okDate(input.date)) return { ok: false, error: "Vantar starfsmann eða dagsetningu" };
      return { ok: true, summary: en ? `Remove ${who}'s shift on ${input.date}` : `Eyða vakt hjá ${who} ${input.date}` };
    case "decide_leave":
      if (!str(input.id) || typeof input.approve !== "boolean") return { ok: false, error: "Vantar id eða ákvörðun" };
      return { ok: true, summary: `${input.approve ? (en ? "Approve" : "Samþykkja") : (en ? "Reject" : "Hafna")}: ${str(input.label) || str(input.id)}` };
    case "approve_swap":
      if (!str(input.id)) return { ok: false, error: "Vantar id" };
      return { ok: true, summary: `${en ? "Approve shift swap" : "Samþykkja vaktaskipti"}: ${str(input.label) || str(input.id)}` };
    case "clock_out":
      if (!who || !okTime(input.time)) return { ok: false, error: "Vantar starfsmann eða tíma" };
      return { ok: true, summary: en ? `Clock out ${who} at ${input.time}` : `Stimpla ${who} út kl. ${input.time}` };
  }
  return { ok: false, error: "Óþekkt aðgerð" };
}

/** Framkvæmir staðfesta aðgerð (kallað úr /api/assistant/execute eftir hlutverkaathugun). */
export async function executeWrite(name: string, input: In): Promise<{ ok: boolean; error?: string }> {
  switch (name) {
    case "set_shift":
      return saveShift({ employeeName: str(input.employee), date: str(input.date), startTime: str(input.start), endTime: str(input.end), shiftTypeName: str(input.shiftType) });
    case "remove_shift":
      return deleteShift({ employeeName: str(input.employee), dateISO: str(input.date) });
    case "decide_leave":
      return updateLeaveRequest(str(input.id), input.approve === true);
    case "approve_swap":
      return approveShiftSwap(str(input.id));
    case "clock_out":
      return setClockOut({ employeeName: str(input.employee), time: str(input.time) });
  }
  return { ok: false, error: "Óþekkt aðgerð" };
}
