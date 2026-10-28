"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { userError } from "@/lib/user-error";
import type { CoworkerStatus } from "@/lib/presence";

// Virkni, „á vakt“ og léttur prófíll samstarfsmanns (0099). Allt fer um RLS / coworker_status (security definer,
// aðeins eigið fyrirtæki, virkni aðeins ef báðir leyfa). Þolir að 0099 vanti — skilar þá engu.

type Row = { user_id: string; employee_id: string; active: string | null; on_shift: boolean; shift_end: string | null; next_start: string | null };
const toStatus = (r: Row): CoworkerStatus => ({ userId: r.user_id, employeeId: r.employee_id, active: r.active, onShift: !!r.on_shift, shiftEnd: r.shift_end, nextStart: r.next_start });

/** Merkja mig virka(n) — kallað af vef/appi meðan notandinn er að nota kerfið (mest á 2 mín. fresti). */
export async function touchPresence(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try { const supabase = await createClient(); await supabase.rpc("touch_presence"); } catch { /* fyrir 0099 */ }
}

export async function getCoworkerStatus(userIds: string[]): Promise<Record<string, CoworkerStatus>> {
  const ids = Array.from(new Set(userIds.filter(Boolean))).slice(0, 200);
  if (!ids.length || !isSupabaseConfigured()) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("coworker_status", { p_user_ids: ids });
    if (error || !data) return {};
    return Object.fromEntries((data as Row[]).map((r) => [r.user_id, toStatus(r)]));
  } catch {
    return {};
  }
}

export type CoworkerProfile = {
  userId: string; employeeId: string; name: string; title: string | null; department: string | null;
  phone: string | null; email: string | null; photo: string | null; color: string | null;
  status: CoworkerStatus | null;
  shifts: { date: string; start: string; end: string }[];
};

/** Léttur prófíll: nafn, starf, deild, (sími ef leyfður), staða og næstu vaktir. Engin laun eða kennitala. */
export async function getCoworkerProfile(userId: string): Promise<CoworkerProfile | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const supabase = await createClient();
    const { data: e } = await supabase.from("coworkers")
      .select("id, user_id, full_name, title, phone, email, photo_url, avatar_color, departments(name), positions(name)")
      .eq("user_id", userId).neq("status", "inactive").limit(1).maybeSingle();
    if (!e) return null;
    const today = new Date().toISOString().slice(0, 10);
    const [st, sh] = await Promise.all([
      getCoworkerStatus([userId]),
      supabase.from("shifts").select("date, start_time, end_time").eq("employee_id", e.id as string).eq("published", true)
        .gte("date", today).order("date").order("start_time").limit(6),
    ]);
    const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
    return {
      userId, employeeId: e.id as string, name: e.full_name as string,
      title: (e.title as string | null) ?? (one(e.positions as { name?: string } | null) as { name?: string } | null)?.name ?? null,
      department: (one(e.departments as { name?: string } | null) as { name?: string } | null)?.name ?? null,
      phone: (e.phone as string | null) ?? null, email: (e.email as string | null) ?? null,
      photo: (e.photo_url as string | null) ?? null, color: (e.avatar_color as string | null) ?? null,
      status: st[userId] ?? null,
      shifts: (sh.data ?? []).map((s) => ({ date: s.date as string, start: String(s.start_time ?? "").slice(0, 5), end: String(s.end_time ?? "").slice(0, 5) })),
    };
  } catch {
    return null;
  }
}

/** Mínar persónuverndarstillingar í spjalli. */
export async function getMyPrivacy(): Promise<{ showPresence: boolean; showPhone: boolean } | null> {
  if (!isSupabaseConfigured()) return { showPresence: true, showPhone: true };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from("employees").select("show_presence, show_phone").eq("user_id", user.id).limit(1).maybeSingle();
    if (error || !data) return null;
    return { showPresence: data.show_presence !== false, showPhone: data.show_phone !== false };
  } catch {
    return null;
  }
}

export async function setMyPrivacy(input: { showPresence?: boolean; showPhone?: boolean }): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const patch: Record<string, boolean> = {};
    if (input.showPresence !== undefined) patch.show_presence = input.showPresence;
    if (input.showPhone !== undefined) patch.show_phone = input.showPhone;
    const { error } = await supabase.from("employees").update(patch).eq("user_id", user.id);
    if (error) return { ok: false, error: userError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
