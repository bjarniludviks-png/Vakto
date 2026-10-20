import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isoOf, type LeavingInfo, type TerminationReason, type NoticeUnit, type DocumentMode, type ShiftAction } from "@/lib/termination";

// Starfslok (0088) — lestur fyrir stjórnendaskjái. RLS: eigendur/vaktstjórar fyrirtækisins.
// Allt þolir að migration 0088 vanti (skilar tómu).

export type TerminationRow = {
  id: string; employeeId: string; reason: TerminationReason;
  noticeDate: string; noticeValue: number; noticeUnit: NoticeUnit; lastDay: string;
  gardenLeave: boolean; gardenFrom: string | null; note: string | null;
  documentMode: DocumentMode; documentId: string | null; contractId: string | null; contractStatus: string | null;
  shiftAction: ShiftAction; shiftsAffected: number;
  payrollReminder: boolean; settledAt: string | null;
  deactivate: boolean; deactivatedAt: string | null;
  accessMonths: number; accessUntil: string; accessClosedAt: string | null;
  createdAt: string; createdBy: string | null;
};

/** Íslensk dagsetning í dag (YYYY-MM-DD) — Ísland er á UTC allt árið. */
export const todayIs = () => new Date().toISOString().slice(0, 10);

const COLS = "id, employee_id, reason, notice_date, notice_value, notice_unit, last_day, garden_leave, garden_leave_from, note, document_mode, document_id, contract_id, shift_action, shifts_affected, payroll_reminder, settled_at, deactivate, deactivated_at, access_months, access_until, access_closed_at, created_at, created_by, contracts(status)";

function mapRow(r: Record<string, unknown>): TerminationRow {
  const c = (Array.isArray(r.contracts) ? r.contracts[0] : r.contracts) as { status?: string } | null;
  return {
    id: r.id as string, employeeId: r.employee_id as string, reason: r.reason as TerminationReason,
    noticeDate: String(r.notice_date), noticeValue: Number(r.notice_value) || 0, noticeUnit: r.notice_unit as NoticeUnit,
    lastDay: String(r.last_day), gardenLeave: !!r.garden_leave, gardenFrom: (r.garden_leave_from as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    documentMode: r.document_mode as DocumentMode, documentId: (r.document_id as string | null) ?? null,
    contractId: (r.contract_id as string | null) ?? null, contractStatus: c?.status ?? null,
    shiftAction: r.shift_action as ShiftAction, shiftsAffected: Array.isArray(r.shifts_affected) ? (r.shifts_affected as unknown[]).length : 0,
    payrollReminder: !!r.payroll_reminder, settledAt: (r.settled_at as string | null) ?? null,
    deactivate: !!r.deactivate, deactivatedAt: (r.deactivated_at as string | null) ?? null,
    accessMonths: Number(r.access_months) || 0, accessUntil: String(r.access_until), accessClosedAt: (r.access_closed_at as string | null) ?? null,
    createdAt: String(r.created_at), createdBy: (r.created_by as string | null) ?? null,
  };
}

/** Virk starfslok eins starfsmanns (með innri athugasemd — aðeins stjórnendur fá röðina gegnum RLS). */
export async function getTermination(employeeId: string): Promise<TerminationRow | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employment_terminations").select(COLS)
      .eq("employee_id", employeeId).is("revoked_at", null).maybeSingle();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Allir sem hætta / eru hættir (virk starfslok) — fyrir listann í Starfsfólk. */
export const getLeavingMap = cache(async (): Promise<Record<string, LeavingInfo>> => {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employment_terminations")
      .select("id, employee_id, reason, last_day, access_until").is("revoked_at", null);
    if (error) return {};
    const today = todayIs();
    const out: Record<string, LeavingInfo> = {};
    for (const r of data ?? []) {
      out[r.employee_id as string] = {
        id: r.id as string, reason: r.reason as TerminationReason, lastDay: String(r.last_day),
        accessUntil: String(r.access_until), past: String(r.last_day) < today,
      };
    }
    return out;
  } catch {
    return {};
  }
});

export type SettlementDue = { id: string; employeeId: string; name: string; reason: TerminationReason; lastDay: string; payType: string; past: boolean };

/** Lokauppgjör sem bíða: áminning á, ekki merkt afgreitt, síðasti dagur innan 45 daga eða liðinn. */
export async function getSettlementsDue(): Promise<SettlementDue[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const horizon = isoOf(new Date(Date.now() + 45 * 86400000));
    const { data, error } = await supabase.from("employment_terminations")
      .select("id, employee_id, reason, last_day, employees(full_name, pay_type)")
      .is("revoked_at", null).eq("payroll_reminder", true).is("settled_at", null)
      .lte("last_day", horizon).order("last_day");
    if (error) return [];
    const today = todayIs();
    return (data ?? []).map((r) => {
      const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as { full_name?: string; pay_type?: string } | null;
      return {
        id: r.id as string, employeeId: r.employee_id as string, name: e?.full_name ?? "—", reason: r.reason as TerminationReason,
        lastDay: String(r.last_day), payType: e?.pay_type ?? "hourly", past: String(r.last_day) < today,
      };
    });
  } catch {
    return [];
  }
}

/** Starfsmenn sem hætta á tímabilinu (VAKTO AI lesverkfæri). Engin innri athugasemd. */
export async function getUpcomingLeavers(days: number): Promise<{ name: string; reason: TerminationReason; noticeDate: string; lastDay: string; gardenLeave: boolean; settled: boolean; accessUntil: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const until = isoOf(new Date(Date.now() + Math.max(1, Math.min(days, 365)) * 86400000));
  const { data, error } = await supabase.from("employment_terminations")
    .select("reason, notice_date, last_day, garden_leave, settled_at, access_until, employees(full_name)")
    .is("revoked_at", null).gte("last_day", isoOf(new Date(Date.now() - 30 * 86400000))).lte("last_day", until).order("last_day");
  if (error) return [];
  return (data ?? []).map((r) => {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as { full_name?: string } | null;
    return {
      name: e?.full_name ?? "—", reason: r.reason as TerminationReason, noticeDate: String(r.notice_date), lastDay: String(r.last_day),
      gardenLeave: !!r.garden_leave, settled: !!r.settled_at, accessUntil: String(r.access_until),
    };
  });
}

export type MyAccess = { state: "active" | "readonly" | "closed"; lastDay: string | null; accessUntil: string | null };

/** Aðgangsstaða innskráðs notanda (0088). Fyrir migration → alltaf „active“. */
export async function getMyAccess(): Promise<MyAccess> {
  if (!isSupabaseConfigured()) return { state: "active", lastDay: null, accessUntil: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_access_state");
    if (error || !data) return { state: "active", lastDay: null, accessUntil: null };
    const d = data as { state?: string; last_day?: string | null; access_until?: string | null };
    const state = d.state === "readonly" || d.state === "closed" ? d.state : "active";
    return { state, lastDay: d.last_day ?? null, accessUntil: d.access_until ?? null };
  } catch {
    return { state: "active", lastDay: null, accessUntil: null };
  }
}
