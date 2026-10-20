import "server-only";

// Vinnuyfirlit — útreikningur á snapshot per starfsmann og lestur úr work_overviews (0084).
// Launaliðir: periodPayLine + hourBuckets úr src/lib/payroll.ts — SAMI útreikningur og
// launakeyrslan (samþykktar, lokaðar stimplanir). Enginn annar launaútreikningur hér.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmployees } from "@/lib/employees.server";
import { periodPayLine, hourBuckets } from "@/lib/payroll";
import { resolveRuleSet } from "@/lib/payrules";
import { daysIn } from "@/lib/periods";
import type { WoDay, WoSnapshot, WoRow, WoStatus, WoLogEntry } from "@/lib/work-overview";

const r2 = (n: number) => Math.round(n * 100) / 100;
const hm = (isoTs: string) => isoTs.slice(11, 16); // Ísland = UTC
const shiftHours = (s: string | null, e: string | null) => {
  if (!s || !e) return 0;
  const [sh, sm] = s.split(":").map(Number), [eh, em] = e.split(":").map(Number);
  let m = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
  if (m <= 0) m += 24 * 60; // yfir miðnætti
  return m / 60;
};

/** Útbýr snapshot fyrir starfsmenn fyrirtækisins á tímabilinu. onlyIds = aðeins þessir. */
export async function buildSnapshots(supabase: SupabaseClient, company: string, from: string, to: string, onlyIds?: string[]): Promise<WoSnapshot[]> {
  const { employees } = await getEmployees();
  const end = `${to}T23:59:59`;
  const [punchRes, pendRes, shiftRes, leaveRes, ruleRes, coRes] = await Promise.all([
    supabase.from("punches").select("employee_id, clock_in, clock_out")
      .eq("company_id", company).eq("approved", true).not("clock_out", "is", null)
      .gte("clock_in", from).lte("clock_in", end),
    supabase.from("punches").select("employee_id")
      .eq("company_id", company).or("approved.is.null,approved.eq.false").gte("clock_in", from).lte("clock_in", end),
    supabase.from("shifts").select("employee_id, date, start_time, end_time")
      .eq("company_id", company).eq("published", true).gte("date", from).lte("date", to),
    supabase.from("leave_requests").select("employee_id, type, from_date, to_date")
      .eq("company_id", company).eq("status", "approved").lte("from_date", to).gte("to_date", from),
    supabase.from("employees").select("id, pay_rule").eq("company_id", company),
    supabase.from("companies").select("name, kennitala").eq("id", company).maybeSingle(),
  ]);
  // Fyrir 0008 (approved-dálkur) fellur launakeyrslan á allar lokaðar stimplanir — sama hér.
  let punches = (punchRes.data ?? []) as { employee_id: string; clock_in: string; clock_out: string }[];
  if (punchRes.error) {
    const all = await supabase.from("punches").select("employee_id, clock_in, clock_out")
      .eq("company_id", company).not("clock_out", "is", null).gte("clock_in", from).lte("clock_in", end);
    punches = (all.data ?? []) as typeof punches;
  }
  const pending = new Map<string, number>();
  for (const p of pendRes.data ?? []) pending.set(p.employee_id as string, (pending.get(p.employee_id as string) ?? 0) + 1);
  const rules = new Map<string, Record<string, unknown> | null>();
  if (!ruleRes.error) for (const r of ruleRes.data ?? []) rules.set(r.id as string, (r.pay_rule as Record<string, unknown> | null) ?? null);

  const byEmp = <T extends { employee_id: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { if (!r.employee_id) continue; if (!m.has(r.employee_id)) m.set(r.employee_id, []); m.get(r.employee_id)!.push(r); }
    return m;
  };
  const pBy = byEmp(punches);
  const sBy = byEmp((shiftRes.data ?? []) as { employee_id: string | null; date: string; start_time: string | null; end_time: string | null }[]);
  const lBy = byEmp((leaveRes.data ?? []) as { employee_id: string; type: string; from_date: string; to_date: string }[]);
  const allDays = daysIn(from, to);
  const now = new Date().toISOString();

  return employees
    .filter((e) => e.role !== "contractor")
    .filter((e) => !onlyIds || onlyIds.includes(e.id))
    .filter((e) => e.status !== "inactive" || (pBy.get(e.id)?.length ?? 0) > 0)
    .map((e): WoSnapshot => {
      const ps = (pBy.get(e.id) ?? []).slice().sort((a, b) => a.clock_in.localeCompare(b.clock_in));
      const ss = sBy.get(e.id) ?? [];
      const ls = lBy.get(e.id) ?? [];
      const days: WoDay[] = [];
      for (const d of allDays) {
        const dayShifts = ss.filter((s) => String(s.date).slice(0, 10) === d).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
        const dayPunches = ps.filter((p) => p.clock_in.slice(0, 10) === d);
        const lv = ls.find((l) => String(l.from_date) <= d && String(l.to_date) >= d);
        if (!dayShifts.length && !dayPunches.length && !lv) continue;
        let breakMin = 0;
        for (let i = 1; i < dayPunches.length; i++) {
          const gap = (Date.parse(dayPunches[i].clock_in) - Date.parse(dayPunches[i - 1].clock_out)) / 60000;
          if (gap > 0 && gap < 6 * 60) breakMin += gap;
        }
        days.push({
          date: d,
          planned: r2(dayShifts.reduce((a, s) => a + shiftHours(s.start_time, s.end_time), 0)),
          plannedText: dayShifts.length ? dayShifts.map((s) => `${String(s.start_time ?? "").slice(0, 5)}–${String(s.end_time ?? "").slice(0, 5)}`).join(", ") : null,
          worked: r2(dayPunches.reduce((a, p) => a + Math.max(0, (Date.parse(p.clock_out) - Date.parse(p.clock_in)) / 3.6e6), 0)),
          punches: dayPunches.map((p) => ({ in: hm(p.clock_in), out: hm(p.clock_out) })),
          breakMin: Math.round(breakMin),
          leave: lv ? (lv.type as WoDay["leave"]) : null,
        });
      }
      const pp = ps.map((p) => ({ clockIn: p.clock_in, clockOut: p.clock_out }));
      const rule = rules.get(e.id) ?? null;
      const line = periodPayLine(e, pp, rule, from);
      const monthly = e.payType === "monthly";
      const b = monthly ? { dagvinna: 0, yfirvinna: 0, alag: {} as Record<number, number> } : hourBuckets(pp, resolveRuleSet(e.union, rule));
      const planned = r2(days.reduce((a, d) => a + d.planned, 0));
      const worked = r2(days.reduce((a, d) => a + d.worked, 0));
      const weekday = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; };
      return {
        v: 1,
        employee: { id: e.id, name: e.fullName, kennitala: e.kennitala, title: e.title || e.position, dept: e.department, union: e.union },
        company: { name: (coRes.data?.name as string) ?? "", kennitala: (coRes.data?.kennitala as string | null) ?? null },
        from, to, days,
        totals: {
          planned, worked, diff: r2(worked - planned),
          breakMin: days.reduce((a, d) => a + d.breakMin, 0),
          sickDays: days.filter((d) => d.leave === "veikindi" && weekday(d.date)).length,
          leaveDays: days.filter((d) => d.leave && d.leave !== "veikindi" && weekday(d.date)).length,
          shifts: ss.length,
        },
        pay: {
          monthly, rate: e.rate, hours: line.hours,
          dagvinnaH: b.dagvinna, yfirvinnaH: b.yfirvinna,
          alag: Object.entries(b.alag).map(([pct, h]) => ({ pct: Number(pct), h })).sort((x, y) => x.pct - y.pct),
          dayPay: line.dayPay, premiums: line.premiums, overtime: line.overtime, uppbot: line.uppbot,
          orlof: line.orlof, benefits: line.benefits, gross: line.gross,
        },
        pendingPunches: pending.get(e.id) ?? 0,
        generatedAt: now,
      };
    });
}

type DbRow = {
  id: string; employee_id: string; period_start: string; period_end: string; status: string; snapshot: WoSnapshot;
  employee_comment: string | null; manager_comment: string | null; sent_at: string | null; employee_approved_at: string | null;
  employee_flagged_at: string | null; final_at: string | null; document_id: string | null; fingerprint: string | null; log: WoLogEntry[] | null;
};
export const WO_COLS = "id, employee_id, period_start, period_end, status, snapshot, employee_comment, manager_comment, sent_at, employee_approved_at, employee_flagged_at, final_at, document_id, fingerprint, log";

export function toRow(r: DbRow): WoRow {
  return {
    id: r.id, employeeId: r.employee_id, name: r.snapshot?.employee?.name ?? "", dept: r.snapshot?.employee?.dept ?? null,
    from: String(r.period_start), to: String(r.period_end), status: r.status as WoStatus, snapshot: r.snapshot,
    employeeComment: r.employee_comment, managerComment: r.manager_comment, sentAt: r.sent_at,
    employeeAt: r.employee_approved_at ?? r.employee_flagged_at, finalAt: r.final_at, documentId: r.document_id,
    fingerprint: r.fingerprint, log: Array.isArray(r.log) ? r.log : [],
  };
}

/** Er work_overviews-taflan til? (0084 ókeyrð → villa frá PostgREST). */
export const missingTable = (err: { code?: string; message?: string } | null | undefined) =>
  !!err && (err.code === "42P01" || err.code === "PGRST205" || /work_overviews/.test(err.message ?? ""));
