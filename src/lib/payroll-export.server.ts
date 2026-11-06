import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeLine, computeFromPunches, hourBuckets, hourBucketsByKey, computeUppbot, uppbotForMonth, uppbotMonths, type PayLine } from "@/lib/payroll";
import { resolveRuleSet, withOtMode, resolveUppbot } from "@/lib/payrules";
import { DEMO_EMPLOYEES, type Employee } from "@/lib/employees";
import { getEmployees } from "@/lib/employees.server";
import { allRows } from "@/lib/supabase/all-rows";
import { hasPerm } from "@/lib/access.server";
import { companyPaySetup } from "@/lib/pay-period.server";

// Launalínur + tímar flokkaðir fyrir launakerfi (Payday/DK/Excel). Notað af útflutnings-
// endapunktinum og beinni sendingu í Payday, svo báðar leiðir skili nákvæmlega sömu tölum.

const toEmp = (e: Record<string, unknown>): Employee => ({
  id: e.id as string, fullName: e.full_name as string,
  payType: (e.pay_type as Employee["payType"]) ?? "hourly",
  rate: Number(e.rate), employmentRatio: Number(e.employment_ratio),
} as Employee);

/** Worked hours split the way Payday's timesheet import wants them. */
export type HourBuckets = { dagvinna: number; yfirvinna: number; alag: Record<number, number> };
/** Tímar starfsmanns skiptir á deildir (0110): deildar-id → tímar. "" = engin deild skráð. */
export type DeptSplit = Map<string, HourBuckets>;

export async function getExportLines(from?: string, to?: string): Promise<{ lines: PayLine[]; kt: Record<string, string>; hours: Map<string, HourBuckets>; monthly: Set<string>; live: boolean; denied?: boolean; byDept?: Map<string, DeptSplit> }> {
  const hours = new Map<string, HourBuckets>();
  const byDept = new Map<string, DeptSplit>();
  const monthly = new Set<string>();
  if (!isSupabaseConfigured()) {
    const kt: Record<string, string> = {};
    DEMO_EMPLOYEES.forEach((e) => { if (e.kennitala) kt[e.id] = e.kennitala; });
    return { lines: DEMO_EMPLOYEES.map(computeLine), kt, hours, monthly, live: false };
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle()
      : { data: null };
    // Laun allra starfsmanna: eigandi eða stjórnandi með aðgang að Launakeyrslum (0095).
    if (!profile?.company_id || !(await hasPerm("launakeyrslur", supabase))) return { lines: [], kt: {}, hours, monthly, live: true, denied: true };
    const company = profile.company_id as string;
    const { data: emps } = company
      ? await supabase.from("employees").select("id, full_name, kennitala, pay_type, rate, employment_ratio, union_agreement, role, hire_date, department_id").eq("company_id", company).neq("role", "contractor")
      : { data: null };
    if (!emps?.length) return { lines: [], kt: {}, hours, monthly, live: true }; // aldrei sýnigögn fyrir innskráð fyrirtæki
    // Launaliðir (skattkort, lífeyrir, orlof …) eins og í launakeyrslunni.
    const payOf = new Map((await getEmployees()).employees.map((x) => [x.id, { pay: x.pay, orlof: x.orlof, benefits: x.benefits }]));
    const toEmpP = (e: Record<string, unknown>): Employee => ({ ...toEmp(e), ...(payOf.get(e.id as string) ?? {}) });
    const kt: Record<string, string> = {};
    emps.forEach((e) => { if (e.kennitala) kt[e.id as string] = e.kennitala as string; if (e.pay_type === "monthly") monthly.add(e.id as string); });

    // With a period: export approved worked hours. Without: contracted baseline.
    if (from && to && company) {
      let punches: { employee_id: string; clock_in: string; clock_out: string }[] = [];
      // Síðað (allRows) — sama ástæða og í launakeyrslunni: >1.000 stimplanir á tímabili duttu út.
      const approved = await allRows<{ employee_id: string; clock_in: string; clock_out: string }>((a, b) => supabase.from("punches").select("id, employee_id, clock_in, clock_out")
        .eq("company_id", company).eq("approved", true).not("clock_out", "is", null)
        .gte("clock_in", from).lte("clock_in", to + "T23:59:59").order("id").range(a, b));
      if (approved.error) {
        const all = await allRows<{ employee_id: string; clock_in: string; clock_out: string }>((a, b) => supabase.from("punches").select("id, employee_id, clock_in, clock_out")
          .eq("company_id", company).not("clock_out", "is", null)
          .gte("clock_in", from).lte("clock_in", to + "T23:59:59").order("id").range(a, b));
        punches = (all.data ?? []) as typeof punches;
      } else punches = (approved.data ?? []) as typeof punches;
      // Deild hverrar stimplunar (0110): vakt sama dag sem skarast mest við stimplunina → deild vaktarinnar,
      // annars aðaldeild starfsmanns. Þannig skiptast tímar t.d. á morgunmat og þrif í DK.
      const homeDept = new Map(emps.map((e) => [e.id as string, (e.department_id as string | null) ?? ""]));
      const dayShifts = new Map<string, { s: number; e: number; dept: string }[]>();
      {
        const pre = new Date(`${from}T00:00:00Z`); pre.setUTCDate(pre.getUTCDate() - 1);
        const sh = await allRows<{ employee_id: string; date: string; start_time: string; end_time: string; department_id: string | null }>((a, b) => supabase.from("shifts")
          .select("employee_id, date, start_time, end_time, department_id").eq("company_id", company).eq("pending_delete", false)
          .not("employee_id", "is", null).gte("date", pre.toISOString().slice(0, 10)).lte("date", to).order("id").range(a, b));
        for (const x of sh.error ? [] : sh.data ?? []) {
          if (!x.start_time || !x.end_time) continue;
          const s0 = Date.parse(`${x.date}T${String(x.start_time).slice(0, 5)}:00Z`);
          let e0 = Date.parse(`${x.date}T${String(x.end_time).slice(0, 5)}:00Z`);
          if (e0 <= s0) e0 += 86400000;
          const k = x.employee_id;
          (dayShifts.get(k) ?? dayShifts.set(k, []).get(k)!).push({ s: s0, e: e0, dept: x.department_id ?? "" });
        }
      }
      const deptOfPunch = (eid: string, ci: string, co: string) => {
        const a = Date.parse(ci), b = Date.parse(co);
        let best: { ov: number; dept: string } | null = null;
        for (const x of dayShifts.get(eid) ?? []) {
          const ov = Math.min(b, x.e) - Math.max(a, x.s);
          if (ov > 0 && (!best || ov > best.ov)) best = { ov, dept: x.dept };
        }
        return (best?.dept || homeDept.get(eid)) ?? "";
      };
      const byEmpK = new Map<string, { clockIn: string; clockOut: string; key: string }[]>();
      for (const p of punches) (byEmpK.get(p.employee_id) ?? byEmpK.set(p.employee_id, []).get(p.employee_id)!).push({ clockIn: p.clock_in, clockOut: p.clock_out, key: deptOfPunch(p.employee_id, p.clock_in, p.clock_out) });
      const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
      for (const p of punches) {
        if (!byEmp.has(p.employee_id)) byEmp.set(p.employee_id, []);
        byEmp.get(p.employee_id)!.push({ clockIn: p.clock_in, clockOut: p.clock_out });
      }
      const { otMode } = await companyPaySetup(supabase, company);
      const ruleMap = new Map<string, never>();
      const pr = await supabase.from("employees").select("id, pay_rule").eq("company_id", company);
      if (!pr.error) for (const r of pr.data ?? []) ruleMap.set(r.id as string, (r.pay_rule as never));
      const lines = emps
        .filter((e) => (byEmp.get(e.id as string)?.length ?? 0) > 0 || e.pay_type === "monthly")
        .map((e) => {
          const rules = withOtMode(resolveRuleSet(e.union_agreement as string, ruleMap.get(e.id as string)), otMode, from ?? "", to ?? "");
          const group = byEmp.get(e.id as string) ?? [];
          // Sama regla og launavélin: dagvinna, yfirvinna og álagstímar per prósentu.
          // Fastlaunafólk fær laun óháð tímum — engir álagsliðir þar.
          const hb = hourBuckets(group, rules);
          hours.set(e.id as string, e.pay_type === "hourly" ? hb : { dagvinna: Math.round((hb.dagvinna + hb.yfirvinna) * 100) / 100, yfirvinna: 0, alag: {} });
          if (e.pay_type === "hourly" && group.length) byDept.set(e.id as string, hourBucketsByKey(byEmpK.get(e.id as string) ?? [], rules));
          // Desember-/orlofsuppbót í júní/desember — sama regla og launakeyrslan.
          const y = Number(from.slice(0, 4)), uk = uppbotForMonth(Number(from.slice(5, 7)));
          const hire = (e as { hire_date?: string | null }).hire_date ?? null;
          const ub = uk ? computeUppbot(resolveUppbot(e.union_agreement as string, null, y)[uk], Number(e.employment_ratio), uppbotMonths(uk, y, hire)) : 0;
          return computeFromPunches(toEmpP(e), group, rules, ub, y);
        });
      return { lines, kt, hours, monthly, live: true, byDept };
    }

    const lines = emps.map((e) => computeLine(toEmpP(e)));
    return { lines, kt, hours, monthly, live: true };
  } catch (e) {
    console.error("[payroll-export]", e);
    return { lines: [], kt: {}, hours, monthly, live: true };
  }
}

