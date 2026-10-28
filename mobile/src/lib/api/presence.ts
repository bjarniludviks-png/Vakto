// „Á vakt“ / virk(ur) samstarfsfólks og eigin virkni (0099) — sama og vefurinn (spjall/presence-actions.ts).
import { supabase } from "../supabase";
import type { CoworkerStatus } from "../presence";

type Row = { user_id: string; employee_id: string; active: string | null; on_shift: boolean; shift_end: string | null; next_start: string | null };

let lastTouch = 0;
/** Merkja mig virka(n) — mest á 2 mín. fresti (gagnagrunnurinn síar líka). Þolir að 0099 vanti. */
export async function touchPresence(): Promise<void> {
  if (Date.now() - lastTouch < 120_000) return;
  lastTouch = Date.now();
  try { await supabase.rpc("touch_presence"); } catch { /* ekki mikilvægt */ }
}

export async function coworkerStatus(userIds: string[]): Promise<Record<string, CoworkerStatus>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc("coworker_status", { p_user_ids: ids });
  if (error || !data) return {};
  return Object.fromEntries((data as Row[]).map((r) => [r.user_id, { userId: r.user_id, employeeId: r.employee_id, active: r.active, onShift: !!r.on_shift, shiftEnd: r.shift_end, nextStart: r.next_start }]));
}

export async function getMyPrivacy(empId: string): Promise<{ showPresence: boolean; showPhone: boolean } | null> {
  const { data, error } = await supabase.from("employees").select("show_presence, show_phone").eq("id", empId).maybeSingle();
  if (error || !data) return null;
  return { showPresence: data.show_presence !== false, showPhone: data.show_phone !== false };
}
export async function setMyPrivacy(empId: string, patch: { show_presence?: boolean; show_phone?: boolean }): Promise<boolean> {
  const { error } = await supabase.from("employees").update(patch).eq("id", empId);
  return !error;
}
