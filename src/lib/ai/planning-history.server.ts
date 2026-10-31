import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/supabase/all-rows";

// Saga vaktaplans fyrir AI: hvar var unnið meira/minna en planað var, eftir vikudögum, klukkustundum,
// deildum og starfsfólki, ásamt veltu. VAKTO AI (planning_history) og „Gervigreind (AI) bestun“ á
// Vaktaplani nota þetta til að setja upp næsta plan nær raunverulegri þörf.
// Ísland = UTC, svo dagsetningar og klukkustundir eru lesnar beint úr UTC.

type Db = Awaited<ReturnType<typeof createClient>>;

const DAYS = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
/** Stimplun lengri en þetta er nær örugglega gleymd útstimplun — skekkir söguna, svo hún er ekki talin. */
const LONG_PUNCH_H = 14;
const r1 = (n: number) => Math.round(n * 10) / 10;
const dayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

export type PlanningHistory = {
  range: { from: string; to: string };
  daysWithData: number;
  excludedLongPunches: number;
  totals: { planned: number; worked: number; deviation: number; deviationPct: number | null; revenue: number | null };
  byWeekday: { day: string; days: number; planned: number; worked: number; deviation: number; revenue: number | null; revenuePerWorkedHour: number | null }[];
  /** Meðalfjöldi á vakt eftir klukkustund: „HH planað/unnið“. */
  hourlyByWeekday: Record<string, string>;
  byDepartment: { dept: string; planned: number; worked: number; deviation: number; worstWeekday: string | null }[];
  overDays: { date: string; day: string; planned: number; worked: number; deviation: number; revenue: number | null; who: string }[];
  underDays: { date: string; day: string; planned: number; worked: number; deviation: number; revenue: number | null }[];
  byEmployee: { name: string; planned: number; worked: number; deviation: number; daysOver: number }[];
};

export async function getPlanningHistory(supabase: Db, companyId: string, from: string, to: string): Promise<PlanningHistory | { error: string }> {
  const [empRes, shiftRes, punchRes, locRes] = await Promise.all([
    supabase.from("employees").select("id, full_name, departments(name)").eq("company_id", companyId),
    allRows((a, b) => supabase.from("shifts").select("id, employee_id, date, start_time, end_time")
      .eq("company_id", companyId).not("employee_id", "is", null).gte("date", from).lte("date", to).order("id").range(a, b)),
    allRows((a, b) => supabase.from("punches").select("id, employee_id, clock_in, clock_out")
      .eq("company_id", companyId).gte("clock_in", from).lte("clock_in", `${to}T23:59:59`).order("id").range(a, b)),
    supabase.from("locations").select("id").eq("company_id", companyId),
  ]);
  if (shiftRes.error || punchRes.error) return { error: "Tókst ekki að sækja vaktir eða stimplanir" };
  const locIds = (locRes.data ?? []).map((l) => l.id as string);
  const revRes = locIds.length
    ? await allRows((a, b) => supabase.from("revenue").select("id, amount, date").in("location_id", locIds).gte("date", from).lte("date", to).order("id").range(a, b))
    : { data: [] as Record<string, unknown>[] };

  const emp = new Map<string, { name: string; dept: string }>();
  for (const e of empRes.data ?? []) {
    const d = (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } | null;
    emp.set(e.id as string, { name: String(e.full_name ?? "—"), dept: d?.name ?? "Án deildar" });
  }

  // Mínútubil á hverjum degi (vaktir yfir miðnætti ná inn í næsta dag: allt talið á upphafsdegi).
  type Span = { eid: string; date: string; s: number; e: number };
  const planned: Span[] = [];
  for (const r of shiftRes.data ?? []) {
    const s = toMin(String(r.start_time)), e0 = toMin(String(r.end_time));
    planned.push({ eid: r.employee_id as string, date: String(r.date).slice(0, 10), s, e: e0 <= s ? e0 + 1440 : e0 });
  }
  const worked: Span[] = [];
  let excluded = 0;
  for (const p of punchRes.data ?? []) {
    if (!p.clock_out) continue;
    const ci = new Date(p.clock_in as string), co = new Date(p.clock_out as string);
    const h = (co.getTime() - ci.getTime()) / 3600000;
    if (h <= 0) continue;
    if (h > LONG_PUNCH_H) { excluded++; continue; }
    const s = ci.getUTCHours() * 60 + ci.getUTCMinutes();
    worked.push({ eid: p.employee_id as string, date: ci.toISOString().slice(0, 10), s, e: s + h * 60 });
  }
  const revByDate = new Map<string, number>();
  for (const r of revRes.data ?? []) { const d = String(r.date).slice(0, 10); revByDate.set(d, (revByDate.get(d) ?? 0) + Number(r.amount ?? 0)); }

  const hrs = (x: Span) => (x.e - x.s) / 60;
  const dates = [...new Set([...planned.map((x) => x.date), ...worked.map((x) => x.date)])].sort();
  const sumBy = <K,>(xs: Span[], key: (x: Span) => K) => { const m = new Map<K, number>(); for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + hrs(x)); return m; };
  const plDate = sumBy(planned, (x) => x.date), wkDate = sumBy(worked, (x) => x.date);
  const plDateEmp = sumBy(planned, (x) => `${x.date}|${x.eid}`), wkDateEmp = sumBy(worked, (x) => `${x.date}|${x.eid}`);

  // Vikudagar: meðaltal per dag sem hafði einhver gögn.
  const wd = Array.from({ length: 7 }, () => ({ days: 0, pl: 0, wk: 0, rev: 0, revDays: 0, revWk: 0 }));
  for (const d of dates) {
    const w = wd[dayOf(d)];
    w.days++; w.pl += plDate.get(d) ?? 0; w.wk += wkDate.get(d) ?? 0;
    if (revByDate.has(d)) { w.rev += revByDate.get(d)!; w.revDays++; w.revWk += wkDate.get(d) ?? 0; }
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  const byWeekday = order.filter((i) => wd[i].days).map((i) => {
    const w = wd[i];
    return {
      day: DAYS[i], days: w.days, planned: r1(w.pl / w.days), worked: r1(w.wk / w.days), deviation: r1((w.wk - w.pl) / w.days),
      revenue: w.revDays ? Math.round(w.rev / w.revDays) : null,
      revenuePerWorkedHour: w.revDays && w.revWk > 0 ? Math.round(w.rev / w.revWk) : null,
    };
  });

  // Klukkustundir: meðalfjöldi á vakt (planað/unnið) per vikudag og klst.
  const grid = (xs: Span[]) => {
    const g = Array.from({ length: 7 }, () => new Array<number>(30).fill(0));
    for (const x of xs) {
      const row = g[dayOf(x.date)];
      for (let h = Math.floor(x.s / 60); h < Math.min(30, Math.ceil(x.e / 60)); h++) {
        const ov = Math.min(x.e, (h + 1) * 60) - Math.max(x.s, h * 60);
        if (ov > 0) row[h] += ov / 60;
      }
    }
    return g;
  };
  const gp = grid(planned), gw = grid(worked);
  const hourlyByWeekday: Record<string, string> = {};
  for (const i of order) {
    const n = wd[i].days;
    if (!n) continue;
    const cells: string[] = [];
    for (let h = 0; h < 30; h++) {
      const p = gp[i][h] / n, w = gw[i][h] / n;
      if (p < 0.15 && w < 0.15) continue;
      cells.push(`${String(h % 24).padStart(2, "0")} ${r1(p)}/${r1(w)}`);
    }
    if (cells.length) hourlyByWeekday[DAYS[i]] = cells.join(", ");
  }

  // Deildir og versti vikudagur hverrar.
  const deptOf = (eid: string) => emp.get(eid)?.dept ?? "Án deildar";
  const dPl = sumBy(planned, (x) => deptOf(x.eid)), dWk = sumBy(worked, (x) => deptOf(x.eid));
  const dDay = new Map<string, number>();
  for (const x of planned) dDay.set(`${deptOf(x.eid)}|${dayOf(x.date)}`, (dDay.get(`${deptOf(x.eid)}|${dayOf(x.date)}`) ?? 0) - hrs(x));
  for (const x of worked) dDay.set(`${deptOf(x.eid)}|${dayOf(x.date)}`, (dDay.get(`${deptOf(x.eid)}|${dayOf(x.date)}`) ?? 0) + hrs(x));
  const byDepartment = [...new Set([...dPl.keys(), ...dWk.keys()])].map((dept) => {
    let worst: string | null = null, wv = 0.5;
    for (const i of order) { const v = (dDay.get(`${dept}|${i}`) ?? 0) / Math.max(1, wd[i].days); if (v > wv) { wv = v; worst = DAYS[i]; } }
    const p = dPl.get(dept) ?? 0, w = dWk.get(dept) ?? 0;
    return { dept, planned: r1(p), worked: r1(w), deviation: r1(w - p), worstWeekday: worst };
  }).sort((a, b) => b.deviation - a.deviation);

  // Einstakir dagar.
  const dayRows = dates.map((d) => ({ date: d, day: DAYS[dayOf(d)], planned: r1(plDate.get(d) ?? 0), worked: r1(wkDate.get(d) ?? 0), deviation: r1((wkDate.get(d) ?? 0) - (plDate.get(d) ?? 0)), revenue: revByDate.get(d) ?? null }));
  const overDays = [...dayRows].filter((x) => x.deviation >= 1).sort((a, b) => b.deviation - a.deviation).slice(0, 12).map((x) => {
    const who = [...emp.keys()].map((eid) => ({ n: emp.get(eid)!.name.split(/\s+/)[0], v: (wkDateEmp.get(`${x.date}|${eid}`) ?? 0) - (plDateEmp.get(`${x.date}|${eid}`) ?? 0) }))
      .filter((y) => y.v >= 0.5).sort((a, b) => b.v - a.v).slice(0, 4).map((y) => `${y.n} +${r1(y.v)}`).join(", ");
    return { ...x, who };
  });
  const underDays = [...dayRows].filter((x) => x.deviation <= -1).sort((a, b) => a.deviation - b.deviation).slice(0, 6);

  // Starfsfólk sem vinnur oftast umfram plan.
  const ePl = sumBy(planned, (x) => x.eid), eWk = sumBy(worked, (x) => x.eid);
  const byEmployee = [...emp.keys()].map((eid) => {
    let daysOver = 0;
    for (const d of dates) if ((wkDateEmp.get(`${d}|${eid}`) ?? 0) - (plDateEmp.get(`${d}|${eid}`) ?? 0) >= 0.5) daysOver++;
    const p = ePl.get(eid) ?? 0, w = eWk.get(eid) ?? 0;
    return { name: emp.get(eid)!.name, planned: r1(p), worked: r1(w), deviation: r1(w - p), daysOver };
  }).filter((x) => x.planned || x.worked).sort((a, b) => b.deviation - a.deviation).slice(0, 10);

  const tp = [...plDate.values()].reduce((a, b) => a + b, 0), tw = [...wkDate.values()].reduce((a, b) => a + b, 0);
  const rev = [...revByDate.values()].reduce((a, b) => a + b, 0);
  return {
    range: { from, to }, daysWithData: dates.length, excludedLongPunches: excluded,
    totals: { planned: r1(tp), worked: r1(tw), deviation: r1(tw - tp), deviationPct: tp > 0 ? r1(((tw - tp) / tp) * 100) : null, revenue: rev > 0 ? Math.round(rev) : null },
    byWeekday, hourlyByWeekday, byDepartment, overDays, underDays, byEmployee,
  };
}

/** Sjálfgefið tímabil: síðustu `weeks` heilu vikur (mán–sun) fyrir `before` (YYYY-MM-DD). */
export function historyRange(before: string, weeks = 8): { from: string; to: string } {
  const d = new Date(`${before}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // dagar frá mánudegi
  const lastSun = new Date(d.getTime() - (back + 1) * 864e5);
  const firstMon = new Date(lastSun.getTime() - (weeks * 7 - 1) * 864e5);
  return { from: firstMon.toISOString().slice(0, 10), to: lastSun.toISOString().slice(0, 10) };
}

/** Stutt textaútgáfa fyrir AI-vaktaplan Vaktaplans-síðunnar. */
export function historyForPrompt(h: PlanningHistory): string {
  if (!h.daysWithData) return "";
  const lines = [
    `SAGA (${h.range.from}–${h.range.to}, ${h.daysWithData} dagar): planað ${h.totals.planned} klst., unnið ${h.totals.worked} klst. (frávik ${h.totals.deviation > 0 ? "+" : ""}${h.totals.deviation} klst.${h.totals.deviationPct != null ? `, ${h.totals.deviationPct} %` : ""}).${h.excludedLongPunches ? ` ${h.excludedLongPunches} stimplanir >14 klst. (líklega gleymd útstimplun) ekki taldar.` : ""}`,
    "Meðaltal per vikudag (planað/unnið klst., velta):",
    ...h.byWeekday.map((w) => `- ${w.day}: ${w.planned}/${w.worked} (${w.deviation > 0 ? "+" : ""}${w.deviation})${w.revenue != null ? `, velta ${w.revenue.toLocaleString("is-IS")} kr.` : ""}`),
    "Fjöldi á vakt eftir klst. (planað/unnið):",
    ...Object.entries(h.hourlyByWeekday).map(([d, s]) => `- ${d}: ${s}`),
  ];
  const depts = h.byDepartment.filter((d) => Math.abs(d.deviation) >= 2);
  if (depts.length) lines.push("Deildir: " + depts.map((d) => `${d.dept} ${d.deviation > 0 ? "+" : ""}${d.deviation} klst.${d.worstWeekday ? ` (mest á ${d.worstWeekday})` : ""}`).join("; "));
  lines.push("Notaðu söguna: þar sem unnið er reglulega meira en planað (sömu vikudagar/klst.) þarf líklega fleiri eða lengri vaktir; þar sem planað er meira en unnið má stytta. Gleymdar útstimplanir eru ekki merki um þörf.");
  return lines.join("\n");
}
