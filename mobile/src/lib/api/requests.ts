// Employee self-service requests — mirrors src/app/(app)/mitt-svaedi/actions.ts
// (leave_requests / shift_swaps / availability RLS from migration 0005).
import { supabase } from "../supabase";
import type { Me } from "./me";
import { notifyServer } from "./notify";

type Result = { ok: boolean; error?: string };

/** Friendly text for the leave-cap trigger (migration 0057). */
function leaveError(message: string): string {
  const m = message.match(/LEAVE_CAP:(\d{4}-\d{2}-\d{2})/);
  if (m) {
    const d = new Date(m[1] + "T12:00:00");
    return `Hámarksfjöldi er þegar í fríi ${d.getDate()}.${d.getMonth() + 1}. — talaðu við vaktstjórann.`;
  }
  return message;
}

export async function submitLeaveRequest(
  me: Me,
  input: { fromDate: string; toDate: string; type: "orlof" | "veikindi" | "olaunad" }
): Promise<Result> {
  const { data, error } = await supabase.from("leave_requests").insert({
    company_id: me.companyId,
    employee_id: me.empId,
    type: input.type,
    from_date: input.fromDate,
    to_date: input.toDate,
    status: "pending",
  }).select("id").single();
  if (error) return { ok: false, error: leaveError(error.message) };
  void notifyServer("leave_request", data.id as string);
  return { ok: true };
}

/** Beiðni um að losna við vakt / bjóða hana. Með `shiftId` verður vaktin laus vakt þegar vaktstjóri samþykkir. */
export async function requestShiftSwap(me: Me, note: string, shiftId?: string): Promise<Result> {
  const { data, error } = await supabase.from("shift_swaps").insert({
    company_id: me.companyId,
    requester_id: me.empId,
    ...(shiftId ? { requester_shift_id: shiftId } : {}),
    note,
    status: "pending",
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  void notifyServer("swap_request", data.id as string);
  return { ok: true };
}

/** Veik(ur) eða veikt barn á vakt: veikindabeiðni þann dag til vaktstjóra (push strax). Við samþykki skráist
 *  veikindadagurinn á móti réttinum og vaktin verður laus vakt (vefurinn: updateLeaveRequest). */
export async function reportSickForShift(me: Me, input: { date: string; type: "veikindi" | "veikindi_barns"; note: string }): Promise<Result> {
  const row = { company_id: me.companyId, employee_id: me.empId, type: input.type, from_date: input.date, to_date: input.date, status: "pending", note: input.note || null };
  let res = await supabase.from("leave_requests").insert(row).select("id").single();
  if (res.error && /note|veikindi_barns/.test(res.error.message)) {
    // Eldri gagnagrunnur (fyrir 0096): engin athugasemd og engin „veikindi barns“-tegund.
    const { note: _n, ...rest } = row; void _n;
    res = await supabase.from("leave_requests").insert({ ...rest, type: "veikindi" }).select("id").single();
  }
  if (res.error) return { ok: false, error: leaveError(res.error.message) };
  void notifyServer("leave_request", res.data.id as string);
  return { ok: true };
}

/** Sækja um lausa vakt: umsókn tengd vaktinni (shift_claims, 0082) sem stjórnandi úthlutar í Vaktaplani.
 *  Ef taflan er ekki til (eldri grunnur) fer umsóknin sem beiðni með texta eins og áður. */
export async function applyForShift(me: Me, note: string, shiftId?: string): Promise<Result> {
  if (shiftId) {
    const { data, error } = await supabase.from("shift_claims").insert({ company_id: me.companyId, shift_id: shiftId, employee_id: me.empId }).select("id").single();
    if (!error) { void notifyServer("shift_claim", data.id as string); return { ok: true }; }
    if (error.code === "23505") return { ok: true };
    if (error.code === "42501") return { ok: false, error: "Vaktin er ekki lengur laus" };
    if (error.code !== "42P01" && error.code !== "PGRST205") return { ok: false, error: error.message };
  }
  return requestShiftSwap(me, `Umsókn um opna vakt: ${note}`);
}

/** Lausar vaktir sem ég hef sótt um (shift_claims í bið). */
export async function myOpenShiftClaims(me: Me): Promise<Set<string>> {
  const { data, error } = await supabase.from("shift_claims").select("shift_id").eq("employee_id", me.empId).eq("status", "pending");
  return new Set(error ? [] : (data ?? []).map((r) => r.shift_id as string));
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

/** Prófílmynd: hlaðið í `avatars/<fyrirtæki>/<starfsmaður>/` (RLS: eigin mappa) og vistað í employees.photo_url. */
export async function uploadMyPhoto(me: Me, uri: string, mime: string): Promise<Result & { url?: string }> {
  try {
    const buf = await (await fetch(uri)).arrayBuffer();
    const ext = mime === "image/png" ? "png" : "jpg";
    const path = `${me.companyId}/${me.empId}/photo-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, buf, { contentType: mime, upsert: true });
    if (up.error) return { ok: false, error: up.error.message };
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("employees").update({ photo_url: url }).eq("id", me.empId);
    return error ? { ok: false, error: error.message } : { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
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
