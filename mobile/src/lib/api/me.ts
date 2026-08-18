// "Mitt svæði" data — direct-Supabase port of src/app/(app)/mitt-svaedi/my.server.ts
import { supabase } from "../supabase";
import { classifyPay, computeFromPunches, STORHATID } from "../payroll";
import { resolveRuleSet, type CustomRules } from "../payrules";

const MONTHLY_HOURS = 173.33;
const ORLOF_PCT = 0.1017;

export type Me = {
  empId: string;
  companyId: string;
  fullName: string;
  title: string | null;
  department: string | null;
  kennitala: string | null;
  phone: string | null;
  email: string | null;
  bankAccount: string | null;
  rate: number;
  hourly: boolean;
  union: string | null;
  ratio: number;
  photoUrl: string | null;
  avatarColor: string | null;
  rules: CustomRules;
};

export async function getMe(): Promise<Me | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: e } = await supabase
    .from("employees")
    .select(
      "id, company_id, full_name, title, kennitala, phone, email, bank_account, rate, pay_type, union_agreement, employment_ratio, photo_url, avatar_color, pay_rule, departments(name), positions(name)"
    )
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();
  if (!e) return null;
  const dep = (e.departments as { name?: string } | null)?.name ?? null;
  const pos = (e.positions as { name?: string } | null)?.name ?? null;
  return {
    empId: e.id,
    companyId: e.company_id,
    fullName: e.full_name,
    title: e.title ?? pos,
    department: dep,
    kennitala: e.kennitala,
    phone: e.phone,
    email: e.email,
    bankAccount: e.bank_account,
    rate: Number(e.rate ?? 0),
    hourly: e.pay_type !== "monthly",
    union: e.union_agreement,
    ratio: Number(e.employment_ratio ?? 100),
    photoUrl: e.photo_url,
    avatarColor: e.avatar_color,
    rules: resolveRuleSet(e.union_agreement, (e.pay_rule as Partial<CustomRules> | null) ?? undefined),
  };
}

/* ---------- date helpers (local time, Mon-based weeks like the web) ---------- */

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  m.setHours(0, 0, 0, 0);
  return m;
}
const DAY_LABELS = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];

export type DayCell = {
  label: string;
  date: string;
  time: string | null;
  premium: string | null;
  today: boolean;
};
export type Upcoming = { date: string; label: string; time: string };
export type OpenShift = { id: string; date: string; label: string; time: string };

export type MyArea = {
  openSince: string | null; // ISO clock_in of open punch
  weekLabel: string;
  days: DayCell[];
  upcoming: Upcoming[];
  weekHours: number;
  nextPayday: string;
  pay: {
    dayH: number;
    dayKr: number;
    premH: number;
    premKr: number;
    otH: number;
    otKr: number;
    totalH: number;
    totalKr: number;
  } | null;
  rights: {
    required: number;
    worked: number;
    bank: number;
    orlofDays: number;
    orlofFund: number;
    union: string | null;
  } | null;
  openShifts: OpenShift[];
};

function hm(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null;
}

function premOf(dateISO: string, start: string | null, rules: CustomRules): string | null {
  if (STORHATID.has(dateISO)) return `+${rules.holiday}%`;
  const day = new Date(dateISO + "T12:00:00").getDay();
  if (day === 0 || day === 6) return `+${rules.weekend}%`;
  const h = start ? parseInt(start.slice(0, 2), 10) : NaN;
  if (!Number.isNaN(h) && (h < 8 || h >= 17)) return `+${rules.eve}%`;
  return null;
}

export async function getMyArea(me: Me): Promise<MyArea> {
  const now = new Date();
  const today = iso(now);
  const mon = mondayOf(now);
  const in14 = new Date(now);
  in14.setDate(in14.getDate() + 14);
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixBack = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [shiftsQ, openQ, punchesQ, openShiftsQ] = await Promise.all([
    supabase
      .from("shifts")
      .select("date, start_time, end_time")
      .eq("employee_id", me.empId)
      .gte("date", iso(mon))
      .lte("date", iso(in14))
      .order("date")
      .order("start_time"),
    supabase
      .from("punches")
      .select("clock_in")
      .eq("employee_id", me.empId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1),
    supabase
      .from("punches")
      .select("clock_in, clock_out")
      .eq("employee_id", me.empId)
      .gte("clock_in", sixBack.toISOString())
      .not("clock_out", "is", null),
    supabase
      .from("shifts")
      .select("id, date, start_time, end_time")
      .eq("company_id", me.companyId)
      .is("employee_id", null)
      .gte("date", today)
      .order("date")
      .limit(5),
  ]);

  const shifts = shiftsQ.data ?? [];
  const openPunch = openQ.data?.[0] ?? null;
  const punches = punchesQ.data ?? [];
  const openShiftRows = openShiftsQ.data ?? [];

  // week grid Mon→Sun
  const days: DayCell[] = [];
  let weekHours = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    const dISO = iso(d);
    const s = shifts.find((x) => x.date === dISO);
    const st = hm(s?.start_time);
    const en = hm(s?.end_time);
    if (st && en) {
      let h =
        parseInt(en.slice(0, 2), 10) +
        parseInt(en.slice(3), 10) / 60 -
        parseInt(st.slice(0, 2), 10) -
        parseInt(st.slice(3), 10) / 60;
      if (h < 0) h += 24;
      weekHours += h;
    }
    days.push({
      label: `${DAY_LABELS[i]} ${d.getDate()}.`,
      date: dISO,
      time: st && en ? `${st}–${en}` : null,
      premium: st ? premOf(dISO, st, me.rules) : null,
      today: dISO === today,
    });
  }

  const upcoming: Upcoming[] = shifts
    .filter((s) => s.date >= today && s.start_time)
    .slice(0, 3)
    .map((s) => {
      const d = new Date(s.date + "T12:00:00");
      return {
        date: s.date,
        label: `${DAY_LABELS[(d.getDay() + 6) % 7]} ${d.getDate()}.`,
        time: `${hm(s.start_time)}–${hm(s.end_time)}`,
      };
    });

  // month-to-date pay estimate from closed punches
  const monthPunches = punches
    .filter((p) => p.clock_in >= monthFrom.toISOString())
    .map((p) => ({ clockIn: p.clock_in, clockOut: p.clock_out as string }));
  let pay: MyArea["pay"] = null;
  if (monthPunches.length) {
    const cls = classifyPay(me.rate, me.hourly, monthPunches, me.rules);
    const line = computeFromPunches(
      { id: me.empId, fullName: me.fullName, payType: me.hourly ? "hourly" : "monthly", rate: me.rate, employmentRatio: me.ratio },
      monthPunches,
      me.rules
    );
    const BURDEN = 0.302;
    const dayH = Math.max(0, cls.total - cls.premium - cls.overtime);
    pay = {
      dayH,
      dayKr: Math.round(dayH * me.rate),
      premH: cls.premium,
      premKr: Math.round(cls.premium * me.rate + cls.premiumPay / (1 + BURDEN)),
      otH: cls.overtime,
      otKr: Math.round(cls.overtime * me.rate + cls.overtimePay / (1 + BURDEN)),
      totalH: cls.total,
      totalKr: Math.round(line.gross),
    };
  }

  // rights: tímabanki over last 6 months (excl. current), orlof
  const required = (MONTHLY_HOURS * me.ratio) / 100;
  const byMonth = new Map<string, number>();
  for (const p of punches) {
    const key = p.clock_in.slice(0, 7);
    const h = (new Date(p.clock_out as string).getTime() - new Date(p.clock_in).getTime()) / 3600000;
    byMonth.set(key, (byMonth.get(key) ?? 0) + h);
  }
  const curKey = today.slice(0, 7);
  let bank = 0;
  let yearWorked = 0;
  for (const [key, h] of byMonth) {
    yearWorked += h;
    if (key !== curKey && h > 0) bank += h - required;
  }
  const worked = byMonth.get(curKey) ?? 0;
  const rights = {
    required: Math.round(required * 10) / 10,
    worked: Math.round(worked * 10) / 10,
    bank: Math.round(bank * 10) / 10,
    orlofDays: Math.round(((yearWorked * ORLOF_PCT) / 8) * 10) / 10,
    orlofFund: me.hourly ? Math.round(yearWorked * me.rate * 1.18 * ORLOF_PCT) : 0,
    union: me.union,
  };

  const nextPayday = iso(new Date(now.getFullYear(), now.getMonth() + 1, 1));

  return {
    openSince: openPunch?.clock_in ?? null,
    weekLabel: `${mon.getDate()}.${mon.getMonth() + 1}–${(() => {
      const s = new Date(mon);
      s.setDate(s.getDate() + 6);
      return `${s.getDate()}.${s.getMonth() + 1}`;
    })()}`,
    days,
    upcoming,
    weekHours: Math.round(weekHours * 10) / 10,
    nextPayday,
    pay,
    rights,
    openShifts: openShiftRows.map((s) => {
      const d = new Date(s.date + "T12:00:00");
      return {
        id: s.id,
        date: s.date,
        label: `${DAY_LABELS[(d.getDay() + 6) % 7]} ${d.getDate()}.${d.getMonth() + 1}`,
        time: s.start_time ? `${hm(s.start_time)}–${hm(s.end_time)}` : "Opin vakt",
      };
    }),
  };
}
