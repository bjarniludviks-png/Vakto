import "server-only";

// Fjarvistir & mæting per starfsmann yfir tímabil (sjálfgefið síðustu 30 dagar):
//   missed = liðinn dagur með birtri vakt en engri stimplun og ekki í samþykktu fríi
//   late   = fyrsta innstimplun dagsins meira en LATE_MIN eftir upphaf vaktar
//   sick   = samþykktir veikindadagar (virkir dagar) á tímabilinu
// Tímar vakta eru íslenskur tími = UTC. RLS: stjórnandi sér sitt fyrirtæki.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";
import { leaveWorkdays } from "@/lib/orlof";

const LATE_MIN = 5;

export type AbsenceRow = {
  id: string; name: string; av: string; c: string; dept: string;
  shifts: number; missed: number; late: number; lateMin: number; sick: number;
  lastMissed: string | null;
};
export type Absence = { live: boolean; from: string; to: string; rows: AbsenceRow[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function getAbsence(days = 30): Promise<Absence> {
  const now = new Date();
  const to = iso(now);
  const from = iso(new Date(now.getTime() - (days - 1) * 86400e3));
  const empty: Absence = { live: false, from, to, rows: [] };
  if (!isSupabaseConfigured()) return empty;
  try {
    const { employees, live } = await getEmployees();
    if (!live) return empty;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return empty;

    const [shiftRes, punchRes, leaveRes] = await Promise.all([
      supabase.from("shifts").select("employee_id, date, start_time")
        .eq("company_id", company).eq("published", true).gte("date", from).lte("date", to),
      supabase.from("punches").select("employee_id, clock_in")
        .eq("company_id", company).gte("clock_in", `${from}T00:00:00Z`).lte("clock_in", `${to}T23:59:59Z`),
      supabase.from("leave_requests").select("employee_id, type, from_date, to_date")
        .eq("company_id", company).eq("status", "approved").lte("from_date", to).gte("to_date", from),
    ]);

    // Fyrsta innstimplun per starfsmann/dag (mínútur frá miðnætti).
    const firstIn = new Map<string, number>();
    for (const p of punchRes.data ?? []) {
      const ci = String(p.clock_in);
      const k = `${p.employee_id}|${ci.slice(0, 10)}`;
      const d = new Date(ci);
      const m = d.getUTCHours() * 60 + d.getUTCMinutes();
      if (!firstIn.has(k) || m < firstIn.get(k)!) firstIn.set(k, m);
    }
    const onLeave = (eid: string, day: string) => (leaveRes.data ?? []).some((l) =>
      l.employee_id === eid && String(l.from_date) <= day && String(l.to_date) >= day);

    const acc = new Map<string, AbsenceRow>();
    const rowOf = (eid: string) => {
      let r = acc.get(eid);
      if (!r) {
        const e = employees.find((x) => x.id === eid);
        if (!e) return null;
        r = { id: e.id, name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—",
          shifts: 0, missed: 0, late: 0, lateMin: 0, sick: 0, lastMissed: null };
        acc.set(eid, r);
      }
      return r;
    };

    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    for (const s of shiftRes.data ?? []) {
      const eid = s.employee_id as string | null;
      if (!eid) continue;
      const day = String(s.date).slice(0, 10);
      const [h, mi] = String(s.start_time).split(":").map(Number);
      const start = h * 60 + (mi || 0);
      if (day === to && start + 15 > nowMin) continue; // ekki hafin (eða innan frests) í dag
      const r = rowOf(eid);
      if (!r) continue;
      if (onLeave(eid, day)) continue;
      r.shifts++;
      const fi = firstIn.get(`${eid}|${day}`);
      if (fi == null) {
        r.missed++;
        if (!r.lastMissed || day > r.lastMissed) r.lastMissed = day;
      } else if (fi > start + LATE_MIN) {
        r.late++; r.lateMin += fi - start;
      }
    }
    for (const l of leaveRes.data ?? []) {
      if (String(l.type) !== "veikindi") continue;
      const r = rowOf(l.employee_id as string);
      if (!r) continue;
      const a = String(l.from_date) < from ? from : String(l.from_date);
      const b = String(l.to_date) > to ? to : String(l.to_date);
      r.sick += leaveWorkdays(a, b);
    }

    const rows = [...acc.values()]
      .filter((r) => r.shifts > 0 || r.sick > 0)
      .sort((a, b) => (b.missed * 3 + b.late + b.sick) - (a.missed * 3 + a.late + a.sick) || a.name.localeCompare(b.name));
    return { live: true, from, to, rows };
  } catch (e) {
    console.error("getAbsence", e);
    return empty;
  }
}
