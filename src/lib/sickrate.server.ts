import "server-only";

// Veikindahlutfall = veikindatímar ÷ áætlaðir vinnutímar, per tímabil (launatímabil/mánuður/ársfj./ár).
//   Veikindi  = samþykktar leave_requests af gerðinni 'veikindi' (sama og Fjarvistir & mæting).
//   Veikindatímar = tímar birtra vakta starfsmanns á veikindadegi; ef engin vakt var skráð þann dag
//                  telst virkur dagur (mán–fös) 8 klst. × starfshlutfall (sama og leaveWorkdays).
//   Áætlaðir tímar = allar birtar vaktir á tímabilinu + þeir veikindatímar sem voru ekki á vakt.
//   Tilvik = veikindabeiðnir (samfelld veikindi) sem skarast við tímabilið.
// Aðeins liðnir dagar (til og með í dag). Ísland = UTC.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { getPayPeriod } from "@/lib/pay-period.server";
import { getMyScope } from "@/lib/scope.server";
import { daysIn, lastRanges, todayISO, type Gran } from "@/lib/periods";

import { SICK_COUNT, type SickBucket, type SickRate, type SickRow } from "@/lib/sickrate";
const r1 = (n: number) => Math.round(n * 10) / 10;
const shiftHours = (s: string | null, e: string | null) => {
  if (!s || !e) return 0;
  const [sh, sm] = s.split(":").map(Number), [eh, em] = e.split(":").map(Number);
  let m = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
  if (m <= 0) m += 24 * 60;
  return m / 60;
};
const weekday = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; };

export async function getSickRate(gran: Gran = "month", count = SICK_COUNT[gran]): Promise<SickRate> {
  const empty: SickRate = { live: false, gran, startDay: 1, company: "", buckets: [] };
  if (!isSupabaseConfigured()) return empty;
  try {
    const [{ employees, live }, startDay, scope] = await Promise.all([getEmployees(), getPayPeriod(), getMyScope()]);
    if (!live) return empty;
    if (scope.role !== "owner" && scope.role !== "manager") return { ...empty, startDay };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return empty;

    const today = todayISO();
    const ranges = lastRanges(gran, Math.min(24, Math.max(1, count)), startDay, today);
    const from = ranges[0].from, to = ranges[ranges.length - 1].to < today ? ranges[ranges.length - 1].to : today;

    const [shiftRes, leaveRes, coRes] = await Promise.all([
      supabase.from("shifts").select("employee_id, date, start_time, end_time")
        .eq("company_id", company).eq("published", true).not("employee_id", "is", null).gte("date", from).lte("date", to),
      supabase.from("leave_requests").select("id, employee_id, from_date, to_date")
        .eq("company_id", company).eq("type", "veikindi").eq("status", "approved").lte("from_date", to).gte("to_date", from),
      supabase.from("companies").select("name").eq("id", company).maybeSingle(),
    ]);

    const emp = new Map(employees
      .filter((e) => e.role !== "contractor")
      .filter((e) => !scope.departments.length || (!!e.department && scope.departments.includes(e.department)))
      .map((e) => [e.id, e]));
    // Áætlaðir tímar per starfsmann/dag.
    const plan = new Map<string, number>();
    for (const s of shiftRes.data ?? []) {
      const eid = s.employee_id as string;
      if (!emp.has(eid)) continue;
      const k = `${eid}|${String(s.date).slice(0, 10)}`;
      plan.set(k, (plan.get(k) ?? 0) + shiftHours(s.start_time as string | null, s.end_time as string | null));
    }
    // Veikindadagar: tímar per starfsmann/dag + tilvik (beiðni) per dag.
    const sick = new Map<string, { h: number; extra: number; leave: string }>();
    for (const l of leaveRes.data ?? []) {
      const e = emp.get(l.employee_id as string);
      if (!e) continue;
      const a = String(l.from_date) < from ? from : String(l.from_date);
      const b = String(l.to_date) > to ? to : String(l.to_date);
      for (const d of daysIn(a, b)) {
        const k = `${e.id}|${d}`;
        if (sick.has(k)) continue;
        const p = plan.get(k) ?? 0;
        if (p > 0) sick.set(k, { h: p, extra: 0, leave: l.id as string });
        else if (weekday(d)) { const h = 8 * (e.employmentRatio || 100) / 100; sick.set(k, { h, extra: h, leave: l.id as string }); }
      }
    }

    const buckets: SickBucket[] = ranges.map((r) => {
      const rows = new Map<string, SickRow & { leaves: Set<string> }>();
      const rowOf = (eid: string) => {
        let x = rows.get(eid);
        if (!x) { const e = emp.get(eid)!; x = { id: eid, name: e.fullName, dept: e.department ?? "—", planned: 0, sick: 0, sickDays: 0, occurrences: 0, leaves: new Set() }; rows.set(eid, x); }
        return x;
      };
      const inR = (k: string) => { const d = k.slice(k.indexOf("|") + 1); return d >= r.from && d <= r.to && d <= today; };
      for (const [k, h] of plan) if (inR(k)) rowOf(k.slice(0, k.indexOf("|"))).planned += h;
      for (const [k, v] of sick) {
        if (!inR(k)) continue;
        const x = rowOf(k.slice(0, k.indexOf("|")));
        x.sick += v.h; x.planned += v.extra; x.sickDays++; x.leaves.add(v.leave);
      }
      const list: SickRow[] = [...rows.values()].map(({ leaves, ...x }) => ({ ...x, planned: r1(x.planned), sick: r1(x.sick), occurrences: leaves.size }))
        .sort((a, b) => b.sick - a.sick || a.name.localeCompare(b.name, "is"));
      const planned = r1(list.reduce((a, x) => a + x.planned, 0));
      const sickH = r1(list.reduce((a, x) => a + x.sick, 0));
      return {
        key: r.key, label: r.label, short: r.short, from: r.from, to: r.to, planned, sick: sickH,
        rate: planned > 0 ? Math.round((sickH / planned) * 1000) / 10 : null,
        sickDays: list.reduce((a, x) => a + x.sickDays, 0), occurrences: list.reduce((a, x) => a + x.occurrences, 0), rows: list,
      };
    });
    return { live: true, gran, startDay, company: (coRes.data?.name as string) ?? "", buckets };
  } catch (e) {
    console.error("getSickRate", e);
    return empty;
  }
}
