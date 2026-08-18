// Employee self-service requests — mirrors src/app/(app)/mitt-svaedi/actions.ts
// (leave_requests / shift_swaps / availability RLS from migration 0005).
import { supabase } from "../supabase";
import type { Me } from "./me";

type Result = { ok: boolean; error?: string };

export async function submitLeaveRequest(
  me: Me,
  input: { fromDate: string; toDate: string; type: "orlof" | "veikindi" | "olaunad" }
): Promise<Result> {
  const { error } = await supabase.from("leave_requests").insert({
    company_id: me.companyId,
    employee_id: me.empId,
    type: input.type,
    from_date: input.fromDate,
    to_date: input.toDate,
    status: "pending",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function requestShiftSwap(me: Me, note: string): Promise<Result> {
  const { error } = await supabase.from("shift_swaps").insert({
    company_id: me.companyId,
    requester_id: me.empId,
    note,
    status: "pending",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Apply for an open shift — same convention as the web (note-encoded). */
export async function applyForShift(me: Me, note: string): Promise<Result> {
  return requestShiftSwap(me, `Umsókn um opna vakt: ${note}`);
}

export async function setAvailability(
  me: Me,
  input: { weekdays: number[]; available?: boolean; reason?: string }
): Promise<Result> {
  const { error } = await supabase.from("availability").insert({
    company_id: me.companyId,
    employee_id: me.empId,
    available: input.available ?? true,
    weekdays: input.weekdays,
    reason: input.reason ?? null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateMyProfile(
  me: Me,
  input: { phone?: string; email?: string; bankAccount?: string }
): Promise<Result> {
  const { error } = await supabase
    .from("employees")
    .update({
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.bankAccount !== undefined ? { bank_account: input.bankAccount } : {}),
    })
    .eq("id", me.empId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type MyRequest = {
  id: string;
  kind: "leave" | "swap";
  label: string;
  status: "pending" | "approved" | "rejected";
  created: string;
};

const LEAVE_LABEL: Record<string, string> = {
  orlof: "Orlof",
  veikindi: "Veikindi",
  olaunad: "Ólaunað leyfi",
};

export async function listMyRequests(me: Me): Promise<MyRequest[]> {
  const [leaves, swaps] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, type, from_date, to_date, status")
      .eq("employee_id", me.empId)
      .order("from_date", { ascending: false })
      .limit(20),
    supabase
      .from("shift_swaps")
      .select("id, note, status, created_at")
      .eq("requester_id", me.empId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const out: MyRequest[] = [];
  for (const l of leaves.data ?? []) {
    out.push({
      id: l.id,
      kind: "leave",
      label: `${LEAVE_LABEL[l.type] ?? l.type} ${l.from_date} – ${l.to_date}`,
      status: l.status,
      created: l.from_date,
    });
  }
  for (const s of swaps.data ?? []) {
    out.push({
      id: s.id,
      kind: "swap",
      label: s.note || "Vaktaskipti",
      status: s.status,
      created: (s.created_at ?? "").slice(0, 10),
    });
  }
  return out.sort((a, b) => (a.created < b.created ? 1 : -1));
}
