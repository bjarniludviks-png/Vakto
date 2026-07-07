import "server-only";
// Live data for Mitt svæði: my shifts (this week + upcoming), open punch state,
// month pay estimate from real punches, rights (orlof/tímabanki), profile fields
// and open shifts I can apply for. Everything scoped to the signed-in employee.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { resolveRuleSet } from "@/lib/payrules";
import { classifyPay, computeFromPunches, STORHATID, BURDEN } from "@/lib/payroll";

const MONTHLY_HOURS = 173.33;
const ORLOF_PCT = 0.1017;
const DAYS_IS = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : "");

export type MyDay = { label: string; time: string | null; premium: string | null; today: boolean };
export type MyShift = { label: string; time: string; premium: string | null; today: boolean };
export type MyOpenShift = { id: string; label: string; time: string; premium: string | null };
export type MyArea = {
  live: boolean;
  openSince: string | null; // ISO clock_in of my open punch (null = not on shift)
  weekLabel: string;        // "22.–28. júní"
  days: MyDay[];            // mon..sun this week
  upcoming: MyShift[];      // next shifts from today (max 3)
  weekHours: number;
  nextPayday: string;       // "1. ágúst"
  pay: { monthly: boolean; dayH: number; dayKr: number; premH: number; premKr: number; otH: number; otKr: number; totalH: number; totalKr: number } | null;
  rights: { required: number; worked: number; bank: number; orlofDays: number; orlofFund: number; union: string } | null;
  profile: { name: string; kennitala: string; position: string; dept: string; phone: string; email: string; bank: string; union: string } | null;
  openShifts: MyOpenShift[];
};

const EMPTY: MyArea = { live: false, openSince: null, weekLabel: "", days: [], upcoming: [], weekHours: 0, nextPayday: "", pay: null, rights: null, profile: null, openShifts: [] };

export async function getMyArea(): Promise<MyArea> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY;
    const { data: emp } = await supabase
      .from("employees")
      .select("id, company_id, full_name, kennitala, phone, email, bank_account, rate, pay_type, union_agreement, employment_ratio, positions(name), departments(name)")
      .eq("user_id", user.id).maybeSingle();
    if (!emp) return EMPTY;
    const empId = emp.id as string, company = emp.company_id as string;
    const rate = Number(emp.rate) || 0;
    const hourly = (emp.pay_type as string) !== "monthly";
    const ratio = Number(emp.employment_ratio) || 100;
    const union = (emp.union_agreement as string) ?? "Efling";

    // Per-employee custom pay rule (tolerant — 0013).
    let custom: unknown = null;
    const pr = await supabase.from("employees").select("pay_rule").eq("id", empId).maybeSingle();
    if (!pr.error) custom = (pr.data?.pay_rule as never) ?? null;
    const rules = resolveRuleSet(union, custom as never);

    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const todayISO = isoOf(today);
    const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const monthFrom = isoOf(new Date(now.getFullYear(), now.getMonth(), 1));
    const sixBack = isoOf(new Date(now.getFullYear(), now.getMonth() - 5, 1));

    const [{ data: myShifts }, { data: open }, { data: punches }, { data: openShiftRows }] = await Promise.all([
      supabase.from("shifts").select("date, start_time, end_time")
        .eq("company_id", company).eq("employee_id", empId)
        .gte("date", isoOf(mon)).lte("date", isoOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14)))
        .order("date").order("start_time"),
      supabase.from("punches").select("clock_in").eq("employee_id", empId)
        .is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("punches").select("clock_in, clock_out")
        .eq("company_id", company).eq("employee_id", empId)
        .gte("clock_in", sixBack).order("clock_in"),
      supabase.from("shifts").select("id, date, start_time, end_time")
        .eq("company_id", company).is("employee_id", null)
        .gte("date", todayISO).order("date").limit(5),
    ]);

    // Premium label for a shift (highest applicable band, simplified).
    const premOf = (dateISO: string, start?: string | null): string | null => {
      if (STORHATID.has(dateISO)) return `+${rules.holiday}%`;
      const wd = new Date(dateISO + "T00:00:00").getDay();
      if (wd === 0 || wd === 6) return `+${rules.weekend}%`;
      const h = start ? Number(String(start).slice(0, 2)) : 12;
      if (h < 8 || h >= 17) return `+${rules.eve}%`;
      return null;
    };
    const shiftHours = (s?: string | null, e?: string | null) => {
      if (!s || !e) return 0;
      const [sh, sm] = String(s).split(":").map(Number), [eh, em] = String(e).split(":").map(Number);
      let h = (eh + em / 60) - (sh + sm / 60); if (h < 0) h += 24;
      return h;
    };
    const niceDay = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      return `${DAYS_IS[d.getDay()]} ${d.getDate()}. ${MONTHS_IS[d.getMonth()].slice(0, 3)}${MONTHS_IS[d.getMonth()].length > 4 ? "." : ""}`;
    };

    // This week mon..sun.
    const byDate = new Map<string, { start: string | null; end: string | null }>();
    for (const s of myShifts ?? []) {
      const key = String(s.date);
      if (!byDate.has(key)) byDate.set(key, { start: s.start_time as string, end: s.end_time as string });
    }
    const days: MyDay[] = [];
    let weekHours = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const iso = isoOf(d);
      const s = byDate.get(iso);
      if (s) weekHours += shiftHours(s.start, s.end);
      days.push({
        label: `${DAYS_IS[d.getDay()]} ${d.getDate()}.`,
        time: s ? `${hhmm(s.start)}–${hhmm(s.end)}` : null,
        premium: s ? premOf(iso, s.start) : null,
        today: iso === todayISO,
      });
    }
    const weekLabel = `${mon.getDate()}.–${sun.getDate()}. ${MONTHS_IS[sun.getMonth()]}`;

    // Upcoming shifts (from today).
    const upcoming: MyShift[] = (myShifts ?? [])
      .filter((s) => String(s.date) >= todayISO && s.start_time)
      .slice(0, 3)
      .map((s) => ({
        label: String(s.date) === todayISO ? `Í dag · ${niceDay(String(s.date))}` : niceDay(String(s.date)),
        time: `${hhmm(s.start_time as string)}–${hhmm(s.end_time as string)}`,
        premium: premOf(String(s.date), s.start_time as string),
        today: String(s.date) === todayISO,
      }));

    // Month punches → pay estimate.
    const closed = (punches ?? []).filter((p) => p.clock_out) as { clock_in: string; clock_out: string }[];
    const monthGroup = closed
      .filter((p) => p.clock_in >= monthFrom)
      .map((p) => ({ clockIn: p.clock_in, clockOut: p.clock_out }));
    let pay: MyArea["pay"] = null;
    if (monthGroup.length || !hourly) {
      const cls = classifyPay(rate, hourly, monthGroup, rules);
      const line = computeFromPunches(
        { id: empId, fullName: emp.full_name as string, payType: hourly ? "hourly" : "monthly", rate, employmentRatio: ratio },
        monthGroup, rules,
      );
      const dayH = Math.max(0, Math.round((cls.total - cls.premium - cls.overtime) * 10) / 10);
      pay = {
        monthly: !hourly,
        dayH,
        dayKr: Math.round(dayH * rate),
        premH: cls.premium,
        premKr: Math.round(cls.premium * rate + cls.premiumPay / (1 + BURDEN)),
        otH: cls.overtime,
        otKr: Math.round(cls.overtime * rate + cls.overtimePay / (1 + BURDEN)),
        totalH: cls.total,
        totalKr: line.gross,
      };
    }

    // Rights: vinnuskylda, month worked, time bank (last 6 months, only months with data),
    // and an orlof estimate accrued from worked hours this calendar year.
    const required = Math.round(MONTHLY_HOURS * (ratio / 100) * 10) / 10;
    const monthWorked = monthGroup.reduce((a, p) => a + (new Date(p.clockOut).getTime() - new Date(p.clockIn).getTime()) / 3600000, 0);
    const byMonth = new Map<string, number>();
    for (const p of closed) {
      const d = new Date(p.clock_in);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth.set(k, (byMonth.get(k) ?? 0) + (new Date(p.clock_out).getTime() - d.getTime()) / 3600000);
    }
    const curKey = `${now.getFullYear()}-${now.getMonth()}`;
    let bank = 0;
    for (const [k, h] of byMonth) { if (k !== curKey && h > 0) bank += h - required; }
    const yearFrom = `${now.getFullYear()}-01-01`;
    const yearWorked = closed
      .filter((p) => p.clock_in >= yearFrom)
      .reduce((a, p) => a + (new Date(p.clock_out).getTime() - new Date(p.clock_in).getTime()) / 3600000, 0);
    const rights: MyArea["rights"] = {
      required,
      worked: Math.round(monthWorked * 10) / 10,
      bank: Math.round(bank * 10) / 10,
      orlofDays: Math.round((yearWorked * ORLOF_PCT / 8) * 10) / 10,
      orlofFund: hourly ? Math.round(yearWorked * rate * 1.18 * ORLOF_PCT) : 0,
      union,
    };

    const position = ((Array.isArray(emp.positions) ? emp.positions[0] : emp.positions) as { name?: string } | null)?.name ?? "";
    const dept = ((Array.isArray(emp.departments) ? emp.departments[0] : emp.departments) as { name?: string } | null)?.name ?? "";
    const openShifts: MyOpenShift[] = (openShiftRows ?? []).map((s) => ({
      id: s.id as string,
      label: niceDay(String(s.date)),
      time: `${hhmm(s.start_time as string)}–${hhmm(s.end_time as string)}`,
      premium: premOf(String(s.date), s.start_time as string),
    }));

    const payday = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      live: true,
      openSince: (open?.clock_in as string) ?? null,
      weekLabel,
      days,
      upcoming,
      weekHours: Math.round(weekHours * 10) / 10,
      nextPayday: `${payday.getDate()}. ${MONTHS_IS[payday.getMonth()]}`,
      pay,
      rights,
      profile: {
        name: (emp.full_name as string) ?? "",
        kennitala: (emp.kennitala as string) ?? "",
        position,
        dept,
        phone: (emp.phone as string) ?? "",
        email: (emp.email as string) ?? "",
        bank: (emp.bank_account as string) ?? "",
        union,
      },
      openShifts,
    };
  } catch {
    return EMPTY;
  }
}
