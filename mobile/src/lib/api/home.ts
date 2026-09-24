// Heim — næsta vakt, opin stimplun, hverjir eru á vakt í dag, lausar vaktir,
// tilkynningar (afleiddar úr beiðnum, lausum vöktum, festum færslum og ólesnum
// skilaboðum) og launamat mánaðarins.
import { supabase } from "../supabase";
import { tr, trf } from "../../../src/lib/i18n";
import { iso, type Me } from "./me";
import { monthPay, type MonthPay } from "./pay";
import { getUnreadTotal } from "./chat";

export type HomeShift = { id: string; date: string; start: string; end: string; dept: string | null; typeName: string | null; color: string | null };
export type Coworker = { empId: string; name: string; color: string | null; photo: string | null; start: string; end: string; dept: string | null };
export type Noti = {
  id: string;
  kind: "open" | "request" | "post" | "chat" | "shift";
  tone: "brand" | "good" | "bad" | "info" | "warn";
  title: string;
  sub: string;
  when: string;
  at: string;
};
export type Home = {
  openSince: string | null;
  today: HomeShift | null;      // vakt í dag (eða næsta)
  next: HomeShift | null;       // næsta vakt eftir daginn í dag
  coworkers: Coworker[];
  openCount: number;
  unread: number;
  notis: Noti[];
  pay: MonthPay;
};

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
const DAY = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
export function dayLabel(dateISO: string, todayISO: string): string {
  if (dateISO === todayISO) return tr("í dag");
  const d = new Date(dateISO + "T12:00:00");
  const t = new Date(todayISO + "T12:00:00");
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return tr("á morgun");
  return `${tr(DAY[d.getDay()])} ${d.getDate()}.${d.getMonth() + 1}`;
}
function ago(ts: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 60) return `${mins} mín`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} klst`;
  const d = Math.floor(h / 24);
  return d === 1 ? tr("Í gær") : `${d} d.`;
}

export async function getHome(me: Me): Promise<Home> {
  const now = new Date();
  const today = iso(now);
  const in21 = new Date(now); in21.setDate(in21.getDate() + 21);
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const since14 = new Date(now); since14.setDate(since14.getDate() - 14);

  const [mineQ, openPunchQ, todayAllQ, openQ, punchesQ, leavesQ, swapsQ, postsQ, unread] = await Promise.all([
    supabase.from("shifts").select("id, date, start_time, end_time, shift_types(name, color), employees(departments(name, color))")
      .eq("employee_id", me.empId).gte("date", today).lte("date", iso(in21)).order("date").order("start_time").limit(12),
    supabase.from("punches").select("clock_in").eq("employee_id", me.empId).is("clock_out", null).order("clock_in", { ascending: false }).limit(1),
    supabase.from("shifts").select("id, employee_id, start_time, end_time, employees(full_name, avatar_color, photo_url, departments(name))")
      .eq("company_id", me.companyId).eq("date", today).not("employee_id", "is", null).order("start_time"),
    supabase.from("shifts").select("id, date, start_time, end_time, created_at").eq("company_id", me.companyId).is("employee_id", null).gte("date", today).order("date").limit(10),
    supabase.from("punches").select("clock_in, clock_out").eq("employee_id", me.empId).gte("clock_in", monthFrom.toISOString()).not("clock_out", "is", null),
    supabase.from("leave_requests").select("id, type, from_date, to_date, status").eq("employee_id", me.empId).neq("status", "pending").gte("from_date", iso(since14)).limit(5),
    supabase.from("shift_swaps").select("id, note, status, created_at").eq("requester_id", me.empId).neq("status", "pending").gte("created_at", since14.toISOString()).limit(5),
    supabase.from("posts").select("id, body, created_at, pinned").eq("company_id", me.companyId).eq("pinned", true).order("created_at", { ascending: false }).limit(1),
    getUnreadTotal(),
  ]);

  const toShift = (s: Record<string, unknown>): HomeShift | null => {
    if (!s || !s.start_time || !s.end_time) return null;
    const st = (Array.isArray(s.shift_types) ? s.shift_types[0] : s.shift_types) as { name?: string; color?: string } | null;
    const emp = (Array.isArray(s.employees) ? s.employees[0] : s.employees) as { departments?: { name?: string; color?: string } | { name?: string; color?: string }[] } | null;
    const dep = emp?.departments ? (Array.isArray(emp.departments) ? emp.departments[0] : emp.departments) : null;
    return { id: s.id as string, date: s.date as string, start: hm(s.start_time as string)!, end: hm(s.end_time as string)!, dept: dep?.name ?? null, typeName: st?.name ?? null, color: st?.color ?? dep?.color ?? null };
  };
  const mine = ((mineQ.data ?? []) as Record<string, unknown>[]).map(toShift).filter(Boolean) as HomeShift[];
  const todayShift = mine.find((s) => s.date === today) ?? mine[0] ?? null;
  const next = mine.find((s) => s.date > (todayShift?.date ?? today)) ?? null;

  const coworkers: Coworker[] = ((todayAllQ.data ?? []) as Record<string, unknown>[])
    .filter((s) => s.employee_id !== me.empId)
    .map((s) => {
      const e = (Array.isArray(s.employees) ? s.employees[0] : s.employees) as { full_name?: string; avatar_color?: string; photo_url?: string; departments?: { name?: string } | { name?: string }[] } | null;
      const dep = e?.departments ? (Array.isArray(e.departments) ? e.departments[0] : e.departments) : null;
      return { empId: s.employee_id as string, name: e?.full_name ?? "—", color: e?.avatar_color ?? null, photo: e?.photo_url ?? null, start: hm(s.start_time as string) ?? "", end: hm(s.end_time as string) ?? "", dept: dep?.name ?? null };
    });

  // tilkynningar
  const notis: Noti[] = [];
  for (const o of (openQ.data ?? []).slice(0, 3)) {
    notis.push({ id: "open:" + o.id, kind: "open", tone: "brand", title: `${tr("Laus vakt")} ${dayLabel(o.date, today)} ${hm(o.start_time) ?? ""}–${hm(o.end_time) ?? ""}`, sub: tr("Sæktu um í Vaktir → Lausar"), when: ago(o.created_at ?? now.toISOString()), at: o.created_at ?? "" });
  }
  const LEAVE: Record<string, string> = { orlof: "Orlof", veikindi: "Veikindi", olaunad: "Ólaunað leyfi" };
  for (const l of leavesQ.data ?? []) {
    const ok = l.status === "approved";
    notis.push({ id: "leave:" + l.id, kind: "request", tone: ok ? "good" : "bad", title: `${tr(LEAVE[l.type] ?? "Beiðni")} ${tr(ok ? "samþykkt" : "hafnað")} · ${l.from_date.slice(8, 10)}.${l.from_date.slice(5, 7)}–${l.to_date.slice(8, 10)}.${l.to_date.slice(5, 7)}`, sub: tr(ok ? "Vaktstjóri samþykkti beiðnina þína" : "Vaktstjóri hafnaði beiðninni"), when: "", at: l.from_date });
  }
  for (const s of swapsQ.data ?? []) {
    const ok = s.status === "approved";
    notis.push({ id: "swap:" + s.id, kind: "request", tone: ok ? "good" : "bad", title: `${tr(s.note?.startsWith("Umsókn") ? "Umsókn um vakt" : "Vaktaskipti")} ${tr(ok ? "samþykkt" : "hafnað")}`, sub: s.note ?? "", when: ago(s.created_at), at: s.created_at });
  }
  for (const p of postsQ.data ?? []) {
    notis.push({ id: "post:" + p.id, kind: "post", tone: "info", title: tr("Fest tilkynning í fréttaveitu"), sub: (p.body as string).slice(0, 80), when: ago(p.created_at), at: p.created_at });
  }
  if (unread > 0) notis.unshift({ id: "chat", kind: "chat", tone: "warn", title: trf("{n} ólesin skilaboð", unread), sub: tr("Opnaðu Spjall"), when: "", at: now.toISOString() });
  notis.sort((a, b) => (a.at < b.at ? 1 : -1));

  const punches = (punchesQ.data ?? []).map((p) => ({ clockIn: p.clock_in as string, clockOut: p.clock_out as string }));
  const future = mine.filter((s) => s.date >= today && s.date <= iso(monthEnd) && !(s.date === today && openPunchQ.data?.[0]));
  const pay = monthPay(me, punches, future.map((s) => ({ date: s.date, start: s.start, end: s.end })), now);

  return {
    openSince: openPunchQ.data?.[0]?.clock_in ?? null,
    today: todayShift,
    next,
    coworkers,
    openCount: (openQ.data ?? []).length,
    unread,
    notis: notis.slice(0, 8),
    pay,
  };
}

/** Month pay for the Laun screen (earned + planned). */
export async function getMonthPay(me: Me): Promise<MonthPay> {
  const now = new Date();
  const today = iso(now);
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [punchesQ, shiftsQ] = await Promise.all([
    supabase.from("punches").select("clock_in, clock_out").eq("employee_id", me.empId).gte("clock_in", monthFrom.toISOString()).not("clock_out", "is", null),
    supabase.from("shifts").select("date, start_time, end_time").eq("employee_id", me.empId).gt("date", today).lte("date", iso(monthEnd)),
  ]);
  const punches = (punchesQ.data ?? []).map((p) => ({ clockIn: p.clock_in as string, clockOut: p.clock_out as string }));
  const future = (shiftsQ.data ?? []).map((s) => ({ date: s.date as string, start: hm(s.start_time as string), end: hm(s.end_time as string) }));
  return monthPay(me, punches, future, now);
}
