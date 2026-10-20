// Vinnuyfirlit (migration 0084) — starfsmaður les eigin yfirlit (RLS: ekki drög) og svarar
// AÐEINS gegnum respond_work_overview(). Tölurnar eru frystar í snapshot þegar stjórnandi bjó
// yfirlitið til (sami launaútreikningur og launakeyrslan á vefnum) — appið reiknar ekkert sjálft.
import { supabase } from "../supabase";
import { notifyServer } from "./notify";

export type WoStatus = "draft" | "sent" | "employee_approved" | "employee_flagged" | "final";
export type WoDay = { date: string; planned: number; plannedText: string | null; worked: number; punches: { in: string; out: string }[]; breakMin: number; leave: string | null };
export type WoSnapshot = {
  from: string; to: string; days: WoDay[];
  totals: { planned: number; worked: number; breakMin: number; diff: number; sickDays: number; leaveDays: number; shifts: number };
  pay: { monthly: boolean; rate: number; hours: number; dagvinnaH: number; yfirvinnaH: number; alag: { pct: number; h: number }[]; dayPay: number; premiums: number; overtime: number; uppbot: number; orlof: number; benefits: number; gross: number };
  pendingPunches: number;
};
export type MyOverview = {
  id: string; from: string; to: string; status: WoStatus; snapshot: WoSnapshot;
  employeeComment: string | null; documentId: string | null; fingerprint: string | null;
};

/** null = taflan er ekki til (0084 ókeyrð) → skjárinn sýnir vinalegt tómt ástand. */
export async function listMyOverviews(empId: string): Promise<MyOverview[] | null> {
  const { data, error } = await supabase
    .from("work_overviews")
    .select("id, period_start, period_end, status, snapshot, employee_comment, document_id, fingerprint")
    .eq("employee_id", empId)
    .neq("status", "draft")
    .order("period_start", { ascending: false })
    .limit(12);
  if (error) return null;
  return (data ?? []).map((r) => ({
    id: r.id as string, from: String(r.period_start), to: String(r.period_end), status: r.status as WoStatus,
    snapshot: r.snapshot as WoSnapshot, employeeComment: (r.employee_comment as string | null) ?? null,
    documentId: (r.document_id as string | null) ?? null, fingerprint: (r.fingerprint as string | null) ?? null,
  }));
}

export async function respondOverview(id: string, approve: boolean, comment?: string): Promise<{ ok: boolean; error?: string }> {
  const note = (comment ?? "").trim();
  if (!approve && !note) return { ok: false, error: "Skrifaðu athugasemdina" };
  const { error } = await supabase.rpc("respond_work_overview", { p_id: id, p_approve: approve, p_comment: note || null });
  if (error) return { ok: false, error: /NOT_PENDING/.test(error.message) ? "Yfirlitið bíður ekki staðfestingar" : "Tókst ekki að vista svarið" };
  void notifyServer("work_overview", id);
  return { ok: true };
}

/** Slóð á PDF lokaðs yfirlits (skjalið er í skjalasafni starfsmannsins). */
export async function overviewPdfPath(documentId: string): Promise<string | null> {
  const { data } = await supabase.from("documents").select("url").eq("id", documentId).maybeSingle();
  return (data?.url as string | undefined) ?? null;
}
