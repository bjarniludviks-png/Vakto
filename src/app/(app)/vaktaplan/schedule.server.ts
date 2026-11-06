import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultShiftTypes } from "@/lib/provision";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees, } from "@/lib/employees.server";
import { planEmployees } from "./roster.server";
import { dec1 } from "@/lib/format";
import { allRows } from "@/lib/supabase/all-rows";
import { getLocTree, type LocTree } from "@/lib/locations.server";
import { buildWeekCells, type ExtraShift } from "./week-cells";
import { companyPaySetup } from "@/lib/pay-period.server";
import type { PayPeriodCfg } from "@/lib/periods";

// initials, birtingarnafn, aðaldeild, litur, starfsmanns-id, aðrar deildir („A|B“)
export type Emp4 = [string, string, string, string, string?, string?];
export type ShiftTypeView = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
export type ScheduleInitial = { emp: Emp4[]; grid: string[][]; times: Record<string, { start: string; end: string }>; cellTypes: Record<string, string>; types: ShiftTypeView[]; pool: Emp4[]; fte: string; company: string; todayISO: string; targets: number[]; unavail: Record<string, number[]>; cellLocs: Record<string, string>; locTree: LocTree;
  /** 0110: deild hverrar aðalvaktar (ef önnur en aðaldeild) + aukavaktir sama dag. */
  cellDepts: Record<string, string>; extras: Record<string, ExtraShift[]>;
  /** Launatímabil fyrirtækisins — mánaðarsýnin fylgir því (ekki almanaksmánuði). */
  payPeriod: PayPeriodCfg };

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// 7 ISO dates for the (Mon-start) week containing `ref`.
function weekDatesOf(ref: Date): string[] {
  const mon = new Date(ref); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return isoOf(d); });
}

/** Live schedule: real employees as rows + published shifts mapped into the grid.
 * Returns null when not configured / no live data → screen uses its demo defaults. */
export async function getSchedule(): Promise<ScheduleInitial | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { live: anyLive } = await getEmployees();
    if (!anyLive) return null;
    const { list: employees } = await planEmployees();

    const today = new Date();
    const todayISO = isoOf(today);
    const WEEK_DATES = weekDatesOf(today);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;

    const rowOf = (e: (typeof employees)[number]): Emp4 => [
      e.init, e.name, e.dept, e.color, e.id, e.depts.filter((d) => d !== e.dept).join("|"),
    ];

    // shift types
    let types: ShiftTypeView[] = [];
    if (company) {
      let { data: st } = await supabase
        .from("shift_types").select("name, start_time, end_time, premium_label, color, bg, border")
        .eq("company_id", company);
      // Eldri fyrirtæki án vaktategunda: vista sjálfgefnu svo vaktir fái tegund.
      if (!st?.length && (await ensureDefaultShiftTypes(company))) {
        st = (await supabase.from("shift_types").select("name, start_time, end_time, premium_label, color, bg, border").eq("company_id", company)).data;
      }
      types = (st ?? []).map((s) => ({
        nm: s.name as string,
        t: s.start_time && s.end_time ? `${(s.start_time as string).slice(0, 5)}–${(s.end_time as string).slice(0, 5)}` : "",
        prem: (s.premium_label as string) ?? "Dagvinna",
        bg: (s.bg as string) ?? "#eef0ff",
        bd: (s.border as string) ?? "#e0e2fb",
        fg: (s.color as string) ?? "#4338ca",
      }));
    }

    // Vaktir vikunnar → grid (fleiri vaktir sama dag í `extras`, deild hverrar vaktar í `cellDepts`, 0110).
    const idById = new Map(employees.map((e, i) => [e.id, i]));
    let cells = buildWeekCells([], idById, WEEK_DATES, employees.length);
    if (company) {
      const { data: shifts } = await allRows((a, b) => supabase
        .from("shifts").select("id, employee_id, date, start_time, end_time, published, location_id, slot, shift_types(name), departments(name)")
        .eq("company_id", company).eq("pending_delete", false).in("date", WEEK_DATES).order("id").range(a, b));
      cells = buildWeekCells(shifts ?? [], idById, WEEK_DATES, employees.length);
    }

    let companyName = "Vaktaplan";
    let targets: number[] = [];
    if (company) {
      const { data: co } = await supabase.from("companies").select("name").eq("id", company).maybeSingle();
      if (co?.name) companyName = co.name as string;
      const { data: st } = await supabase.from("companies").select("staffing_targets").eq("id", company).maybeSingle();
      if (Array.isArray(st?.staffing_targets)) targets = (st!.staffing_targets as number[]).slice(0, 7);
    }

    // Allt virkt starfsfólk er alltaf í planinu. Áður fóru þeir sem áttu enga vakt í vikunni í
    // „pottinn“ um leið og ein vakt var komin — hjá 44 manna hóteli hvarf þá nánast allt starfsfólkið.
    const emp: Emp4[] = employees.map(rowOf);
    const pool: Emp4[] = [];
    const { employees: all } = await getEmployees();
    const fte = dec1(all.filter((e) => e.status !== "inactive").reduce((a, e) => a + e.employmentRatio, 0) / 100);
    const unavail = await getWeekUnavail(WEEK_DATES);
    const locTree: LocTree = company ? await getLocTree(supabase, company) : { locations: [], deptLocs: {}, empHome: {} };
    const payPeriod: PayPeriodCfg = company ? (await companyPaySetup(supabase, company)).period : { kind: "month", startDay: 1 };
    return { emp, grid: cells.grid, times: cells.times, cellTypes: cells.cellTypes, cellDepts: cells.cellDepts, extras: cells.extras, types, pool, fte, company: companyName, todayISO, targets, unavail, cellLocs: cells.cellLocs, locTree, payPeriod };
  } catch {
    return null;
  }
}

/** Registered UN-availability per employee first name (lowercase) for a week —
 * day indices 0=Mán … 6=Sun. Weekday rules + date ranges from `availability`
 * (Mitt svæði → Skrá framboð). Empty map on any failure. */
export async function getWeekUnavail(weekDates: string[]): Promise<Record<string, number[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return {};
    const { data: av } = await supabase
      .from("availability")
      .select("available, weekdays, employee_id, from_date, to_date, employees(full_name)")
      .eq("company_id", company).eq("available", false);
    const out: Record<string, number[]> = {};
    for (const a of av ?? []) {
      const full = (a.employees as unknown as { full_name?: string } | null)?.full_name ?? "";
      const name = full.split(/\s+/)[0]?.toLowerCase();
      if (!name) continue;
      for (let c = 0; c < 7; c++) {
        const date = weekDates[c];
        const inRange = (!a.from_date || date >= (a.from_date as string)) && (!a.to_date || date <= (a.to_date as string));
        if (!inRange) continue;
        const wd = (a.weekdays ?? []) as number[];
        if (wd.length === 0 || wd.includes(c)) {
          // Lykill bæði fornafn (AI-aðstoðin) og starfsmanns-id (planið — fornöfn geta verið eins).
          for (const k of [name, a.employee_id as string | null]) if (k && !(out[k] ?? []).includes(c)) (out[k] ??= []).push(c);
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}
