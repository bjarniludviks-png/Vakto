// Rekstur — yfirlit stjórnanda: hverjir eru á vakt núna, laun sem hlutfall af
// veltu, kostnaður og tímar vikunnar, beiðnir sem bíða og vaktir sem enginn er á.
// Aðeins sýnilegt eigendum og vaktstjórum (sjá isManager).
import { supabase } from "../supabase";
import { BURDEN } from "../payroll";
import { iso, type Me } from "./me";
import { canPin } from "./feed";

/** Eigandi eða vaktstjóri? Sama athugun og fréttaveitan notar. */
export const isManager = canPin;

/** Fyrirtæki notandans. Eigendur hafa oft ekkert starfsmannaspjald, svo við
 *  lesum users.company_id og notum starfsmannaspjaldið aðeins sem vararleið. */
export async function myCompanyId(me: Me | null): Promise<string | null> {
  if (me?.companyId) return me.companyId;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("users").select("company_id").eq("id", auth.user.id).maybeSingle();
  return (data?.company_id as string) ?? null;
}

export const DEFAULT_LABOR_TARGET = 30;
const WEEK_FULL = 40; // klst áður en yfirvinna telst til í yfirlitinu

export type OnShift = { id: string; empId: string; name: string; color: string | null; photo: string | null; since: string; dept: string | null };
export type PendingReq = { id: string; kind: "leave" | "swap"; name: string; title: string; sub: string };
export type OpenShiftRow = { id: string; date: string; start: string | null; end: string | null; dept: string | null };

export type Ops = {
  onShift: OnShift[];
  hoursWeek: number;
  otHoursWeek: number;
  costWeek: number;          // launakostnaður með launatengdum gjöldum
  revenueWeek: number;
  laborPct: number | null;   // null = engin velta skráð
  laborTarget: number;
  pending: PendingReq[];
  openShifts: OpenShiftRow[];
};

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
export function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}
/** "síðan 14:05" fyrir opna stimplun. */
function sinceLabel(isoTs: string): string {
  const d = new Date(isoTs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const dayName = (dateISO: string) => ["sun", "mán", "þri", "mið", "fim", "fös", "lau"][new Date(dateISO + "T12:00:00").getDay()];

export async function getOps(companyId: string): Promise<Ops> {
  const now = new Date();
  const today = iso(now);
  const mon = mondayOf(now);
  const monISO = iso(mon);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const sunISO = iso(sun);
  const in14 = new Date(now); in14.setDate(in14.getDate() + 14);

  const [openPunchQ, weekPunchQ, empQ, revQ, leaveQ, swapQ, openShiftQ, compQ] = await Promise.all([
    supabase.from("punches")
      .select("id, employee_id, clock_in, employees(full_name, avatar_color, photo_url, departments(name))")
      .eq("company_id", companyId).is("clock_out", null).order("clock_in"),
    supabase.from("punches")
      .select("employee_id, clock_in, clock_out")
      .eq("company_id", companyId).gte("clock_in", `${monISO}T00:00:00`).lte("clock_in", `${sunISO}T23:59:59`),
    supabase.from("employees").select("id, rate, pay_type, employment_ratio").eq("company_id", companyId),
    supabase.from("revenue").select("amount, date, locations!inner(company_id)")
      .eq("locations.company_id", companyId).gte("date", monISO).lte("date", sunISO),
    supabase.from("leave_requests")
      .select("id, type, from_date, to_date, employees(full_name)")
      .eq("company_id", companyId).eq("status", "pending").order("from_date"),
    supabase.from("shift_swaps")
      .select("id, note, created_at, employees!shift_swaps_requester_id_fkey(full_name)")
      .eq("company_id", companyId).eq("status", "pending").order("created_at"),
    supabase.from("shifts")
      .select("id, date, start_time, end_time, shift_types(name)")
      .eq("company_id", companyId).is("employee_id", null)
      .gte("date", today).lte("date", iso(in14)).order("date"),
    supabase.from("companies").select("labor_target").eq("id", companyId).maybeSingle(),
  ]);

  // ---- hverjir eru á vakt núna ----
  const onShift: OnShift[] = ((openPunchQ.data ?? []) as unknown as Record<string, unknown>[]).map((p) => {
    const e = (Array.isArray(p.employees) ? p.employees[0] : p.employees) as
      { full_name?: string; avatar_color?: string | null; photo_url?: string | null; departments?: unknown } | null;
    const dep = e?.departments ? (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } : null;
    return {
      id: p.id as string,
      empId: p.employee_id as string,
      name: e?.full_name ?? "Starfsmaður",
      color: e?.avatar_color ?? null,
      photo: e?.photo_url ?? null,
      since: sinceLabel(p.clock_in as string),
      dept: dep?.name ?? null,
    };
  });

  // ---- tímar og kostnaður vikunnar ----
  const rateOf = new Map<string, number>();
  for (const e of (empQ.data ?? []) as { id: string; rate: number | null; pay_type: string | null; employment_ratio: number | null }[]) {
    // mánaðarlaun → tímakaup m.v. 173,33 klst í fullu starfi
    const r = e.pay_type === "monthly"
      ? Math.round(((e.rate ?? 0) * ((e.employment_ratio ?? 100) / 100)) / 173.33)
      : e.rate ?? 0;
    rateOf.set(e.id, r);
  }
  const hoursBy = new Map<string, number>();
  for (const p of (weekPunchQ.data ?? []) as { employee_id: string; clock_in: string; clock_out: string | null }[]) {
    if (!p.clock_out) continue;
    const h = (new Date(p.clock_out).getTime() - new Date(p.clock_in).getTime()) / 3600000;
    if (h > 0) hoursBy.set(p.employee_id, (hoursBy.get(p.employee_id) ?? 0) + h);
  }
  let hoursWeek = 0, otHoursWeek = 0, gross = 0;
  for (const [empId, h] of hoursBy) {
    hoursWeek += h;
    otHoursWeek += Math.max(0, h - WEEK_FULL);
    gross += h * (rateOf.get(empId) ?? 0);
  }
  const costWeek = Math.round(gross * (1 + BURDEN));

  // ---- velta og laun% ----
  const revenueWeek = ((revQ.data ?? []) as { amount: number | null }[]).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const laborPct = revenueWeek > 0 ? (costWeek / revenueWeek) * 100 : null;
  const laborTarget = Number((compQ.data as { labor_target?: number } | null)?.labor_target ?? DEFAULT_LABOR_TARGET);

  // ---- beiðnir sem bíða ----
  const LEAVE_LABEL: Record<string, string> = { orlof: "Orlof", veikindi: "Veikindi", olaunad: "Ólaunað leyfi" };
  const fmtDate = (d: string) => { const x = new Date(d + "T12:00:00"); return `${x.getDate()}.${x.getMonth() + 1}.`; };
  const pending: PendingReq[] = [];
  for (const r of ((leaveQ.data ?? []) as unknown as Record<string, unknown>[])) {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as { full_name?: string } | null;
    const from = r.from_date as string, to = r.to_date as string;
    pending.push({
      id: r.id as string, kind: "leave", name: e?.full_name ?? "Starfsmaður",
      title: LEAVE_LABEL[r.type as string] ?? "Leyfi",
      sub: from === to ? fmtDate(from) : `${fmtDate(from)}–${fmtDate(to)}`,
    });
  }
  for (const r of ((swapQ.data ?? []) as unknown as Record<string, unknown>[])) {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as { full_name?: string } | null;
    pending.push({
      id: r.id as string, kind: "swap", name: e?.full_name ?? "Starfsmaður",
      title: "Vaktaskipti", sub: (r.note as string) ?? "",
    });
  }

  // ---- vaktir sem enginn er á ----
  const openShifts: OpenShiftRow[] = ((openShiftQ.data ?? []) as unknown as Record<string, unknown>[]).map((s) => {
    const t = (Array.isArray(s.shift_types) ? s.shift_types[0] : s.shift_types) as { name?: string } | null;
    return {
      id: s.id as string, date: s.date as string,
      start: hm(s.start_time as string), end: hm(s.end_time as string),
      dept: t?.name ?? null,
    };
  });

  return { onShift, hoursWeek, otHoursWeek, costWeek, revenueWeek, laborPct, laborTarget, pending, openShifts };
}

export function openShiftLabel(s: OpenShiftRow): string {
  const d = new Date(s.date + "T12:00:00");
  return `${dayName(s.date)} ${d.getDate()}.${d.getMonth() + 1}. · ${s.start ?? ""}–${s.end ?? ""}`;
}

/** Samþykkja eða hafna beiðni. Vaktstjórar og eigendur hafa skrifheimild (RLS). */
export async function decideRequest(r: PendingReq, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const table = r.kind === "leave" ? "leave_requests" : "shift_swaps";
  const { error } = await supabase.from(table).update({ status: approve ? "approved" : "rejected" }).eq("id", r.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
