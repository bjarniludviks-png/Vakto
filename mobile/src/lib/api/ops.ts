// Mælaborð stjórnanda — laun% og kostnaður fyrir valið tímabil (sami
// útreikningur og á vefnum, sjá ../labor.ts), hverjir eru á vakt núna,
// beiðnir sem bíða og vaktir sem enginn er á.
import { supabase } from "../supabase";
import { getLaborPeriods, DEFAULT_LABOR_TARGET as LT, type LaborPeriod } from "../labor";
import { iso, type Me } from "./me";
import { canPin } from "./feed";

/** Eigandi eða vaktstjóri? Sama athugun og fréttaveitan notar. */
export const isManager = canPin;
export const DEFAULT_LABOR_TARGET = LT;

/** Fyrirtæki notandans. Eigendur hafa oft ekkert starfsmannaspjald, svo við
 *  lesum users.company_id og notum starfsmannaspjaldið aðeins sem vararleið. */
export async function myCompanyId(me: Me | null): Promise<string | null> {
  if (me?.companyId) return me.companyId;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("users").select("company_id").eq("id", auth.user.id).maybeSingle();
  return (data?.company_id as string) ?? null;
}

export function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}

export type PeriodId = "day" | "week" | "month";
/** Valið tímabil: fast tímabil með hliðrun aftur í tímann, eða valdar dagsetningar. */
export type PeriodSel = { id: PeriodId; offset: number } | { id: "custom"; from: string; to: string };

export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Tímabilið og sama tímabil á undan, til samanburðar. */
export function periodRange(sel: PeriodSel, now = new Date()): { from: string; to: string; prevFrom: string; prevTo: string; label: string } {
  const d = (x: Date) => iso(x);
  if (sel.id === "custom") {
    const from = new Date(`${sel.from}T12:00:00`), to = new Date(`${sel.to}T12:00:00`);
    const len = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    return { from: sel.from, to: sel.to, prevFrom: d(addDays(from, -len)), prevTo: d(addDays(from, -1)), label: rangeLabel(sel.from, sel.to) };
  }
  const off = sel.offset;
  if (sel.id === "day") {
    const day = addDays(now, -off);
    const y = addDays(day, -1);
    return { from: d(day), to: d(day), prevFrom: d(y), prevTo: d(y), label: off === 0 ? "Í dag" : off === 1 ? "Í gær" : dayLabel(d(day)) };
  }
  if (sel.id === "week") {
    const mon = addDays(mondayOf(now), -7 * off);
    const sun = addDays(mon, 6);
    const pMon = addDays(mon, -7);
    return { from: d(mon), to: d(sun), prevFrom: d(pMon), prevTo: d(addDays(pMon, 6)), label: off === 0 ? "Þessi vika" : rangeLabel(d(mon), d(sun)) };
  }
  const first = new Date(now.getFullYear(), now.getMonth() - off, 1);
  const last = new Date(now.getFullYear(), now.getMonth() - off + 1, 0);
  const pFirst = new Date(first.getFullYear(), first.getMonth() - 1, 1);
  const pLast = new Date(first.getFullYear(), first.getMonth(), 0);
  return { from: d(first), to: d(last), prevFrom: d(pFirst), prevTo: d(pLast), label: off === 0 ? "Þessi mánuður" : MONTHS[first.getMonth()] };
}

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const dayLabel = (isoD: string) => { const x = new Date(`${isoD}T12:00:00`); return `${x.getDate()}. ${MONTHS[x.getMonth()]}`; };
export function rangeLabel(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00`), b = new Date(`${to}T12:00:00`);
  if (from === to) return dayLabel(from);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth ? `${a.getDate()}.–${b.getDate()}. ${MONTHS[b.getMonth()]}` : `${a.getDate()}.${a.getMonth() + 1}. – ${b.getDate()}.${b.getMonth() + 1}.`;
}

export type OnShift = { id: string; empId: string; name: string; color: string | null; photo: string | null; since: string; dept: string | null };
export type PendingReq = { id: string; kind: "leave" | "swap"; name: string; title: string; sub: string };
export type OpenShiftRow = { id: string; date: string; start: string | null; end: string | null; dept: string | null };

export type Ops = {
  label: string;
  now: LaborPeriod;
  prev: LaborPeriod;
  laborTarget: number;
  onShift: OnShift[];
  pending: PendingReq[];
  openShifts: OpenShiftRow[];
};

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
function sinceLabel(isoTs: string): string {
  const d = new Date(isoTs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const dayName = (dateISO: string) => ["sun", "mán", "þri", "mið", "fim", "fös", "lau"][new Date(`${dateISO}T12:00:00`).getDay()];

export async function getOps(companyId: string, sel: PeriodSel): Promise<Ops> {
  const now = new Date();
  const today = iso(now);
  const in14 = new Date(now); in14.setDate(in14.getDate() + 14);
  const r = periodRange(sel, now);

  const [periods, openPunchQ, leaveQ, swapQ, openShiftQ, compQ] = await Promise.all([
    getLaborPeriods(companyId, [{ from: r.from, to: r.to }, { from: r.prevFrom, to: r.prevTo }]),
    supabase.from("punches")
      .select("id, employee_id, clock_in, employees(full_name, avatar_color, photo_url, departments(name))")
      .eq("company_id", companyId).is("clock_out", null).order("clock_in"),
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

  const LEAVE_LABEL: Record<string, string> = { orlof: "Orlof", veikindi: "Veikindi", olaunad: "Ólaunað leyfi" };
  const fmtDate = (d: string) => { const x = new Date(`${d}T12:00:00`); return `${x.getDate()}.${x.getMonth() + 1}.`; };
  const pending: PendingReq[] = [];
  for (const q of ((leaveQ.data ?? []) as unknown as Record<string, unknown>[])) {
    const e = (Array.isArray(q.employees) ? q.employees[0] : q.employees) as { full_name?: string } | null;
    const from = q.from_date as string, to = q.to_date as string;
    pending.push({
      id: q.id as string, kind: "leave", name: e?.full_name ?? "Starfsmaður",
      title: LEAVE_LABEL[q.type as string] ?? "Leyfi",
      sub: from === to ? fmtDate(from) : `${fmtDate(from)}–${fmtDate(to)}`,
    });
  }
  for (const q of ((swapQ.data ?? []) as unknown as Record<string, unknown>[])) {
    const e = (Array.isArray(q.employees) ? q.employees[0] : q.employees) as { full_name?: string } | null;
    pending.push({ id: q.id as string, kind: "swap", name: e?.full_name ?? "Starfsmaður", title: "Vaktaskipti", sub: (q.note as string) ?? "" });
  }

  const openShifts: OpenShiftRow[] = ((openShiftQ.data ?? []) as unknown as Record<string, unknown>[]).map((s) => {
    const t = (Array.isArray(s.shift_types) ? s.shift_types[0] : s.shift_types) as { name?: string } | null;
    return { id: s.id as string, date: s.date as string, start: hm(s.start_time as string), end: hm(s.end_time as string), dept: t?.name ?? null };
  });

  return {
    label: r.label,
    now: periods[0],
    prev: periods[1],
    laborTarget: Number((compQ.data as { labor_target?: number } | null)?.labor_target ?? DEFAULT_LABOR_TARGET),
    onShift, pending, openShifts,
  };
}

export function openShiftLabel(s: OpenShiftRow): string {
  const d = new Date(`${s.date}T12:00:00`);
  return `${dayName(s.date)} ${d.getDate()}.${d.getMonth() + 1}. · ${s.start ?? ""}–${s.end ?? ""}`;
}

/** Frávik frá markmiði í krónum: hvað launin eru yfir (eða undir) markmiðinu. */
export function targetGapKr(p: LaborPeriod, target: number): number | null {
  if (!p || p.revenue <= 0) return null;
  return Math.round(p.cost - p.revenue * (target / 100));
}

/** Samþykkja eða hafna beiðni. Vaktstjórar og eigendur hafa skrifheimild (RLS). */
export async function decideRequest(r: PendingReq, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const table = r.kind === "leave" ? "leave_requests" : "shift_swaps";
  const { error } = await supabase.from(table).update({ status: approve ? "approved" : "rejected" }).eq("id", r.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
