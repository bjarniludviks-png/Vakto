import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeLine, computeFromPunches, hourBuckets, type PayLine } from "@/lib/payroll";
import { resolveRuleSet } from "@/lib/payrules";
import { DEMO_EMPLOYEES, type Employee } from "@/lib/employees";

// Launalínur + tímar flokkaðir fyrir launakerfi (Payday/DK/Excel). Notað af útflutnings-
// endapunktinum og beinni sendingu í Payday, svo báðar leiðir skili nákvæmlega sömu tölum.

const toEmp = (e: Record<string, unknown>): Employee => ({
  id: e.id as string, fullName: e.full_name as string,
  payType: (e.pay_type as Employee["payType"]) ?? "hourly",
  rate: Number(e.rate), employmentRatio: Number(e.employment_ratio),
} as Employee);

/** Worked hours split the way Payday's timesheet import wants them. */
export type HourBuckets = { dagvinna: number; yfirvinna: number; alag: Record<number, number> };

export async function getExportLines(from?: string, to?: string): Promise<{ lines: PayLine[]; kt: Record<string, string>; hours: Map<string, HourBuckets>; monthly: Set<string>; live: boolean }> {
  const hours = new Map<string, HourBuckets>();
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
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    const { data: emps } = company
      ? await supabase.from("employees").select("id, full_name, kennitala, pay_type, rate, employment_ratio, union_agreement, role").eq("company_id", company).neq("role", "contractor")
      : { data: null };
    if (!emps?.length) {
      const kt: Record<string, string> = {};
      DEMO_EMPLOYEES.forEach((e) => { if (e.kennitala) kt[e.id] = e.kennitala; });
      return { lines: DEMO_EMPLOYEES.map(computeLine), kt, hours, monthly, live: false };
    }
    const kt: Record<string, string> = {};
    emps.forEach((e) => { if (e.kennitala) kt[e.id as string] = e.kennitala as string; if (e.pay_type === "monthly") monthly.add(e.id as string); });

    // With a period: export approved worked hours. Without: contracted baseline.
    if (from && to && company) {
      let punches: { employee_id: string; clock_in: string; clock_out: string }[] = [];
      const approved = await supabase.from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).eq("approved", true).not("clock_out", "is", null)
        .gte("clock_in", from).lte("clock_in", to + "T23:59:59");
      if (approved.error) {
        const all = await supabase.from("punches").select("employee_id, clock_in, clock_out")
          .eq("company_id", company).not("clock_out", "is", null)
          .gte("clock_in", from).lte("clock_in", to + "T23:59:59");
        punches = (all.data ?? []) as typeof punches;
      } else punches = (approved.data ?? []) as typeof punches;
      const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
      for (const p of punches) {
        if (!byEmp.has(p.employee_id)) byEmp.set(p.employee_id, []);
        byEmp.get(p.employee_id)!.push({ clockIn: p.clock_in, clockOut: p.clock_out });
      }
      const ruleMap = new Map<string, never>();
      const pr = await supabase.from("employees").select("id, pay_rule").eq("company_id", company);
      if (!pr.error) for (const r of pr.data ?? []) ruleMap.set(r.id as string, (r.pay_rule as never));
      const lines = emps
        .filter((e) => (byEmp.get(e.id as string)?.length ?? 0) > 0 || e.pay_type === "monthly")
        .map((e) => {
          const rules = resolveRuleSet(e.union_agreement as string, ruleMap.get(e.id as string));
          const group = byEmp.get(e.id as string) ?? [];
          // Sama regla og launavélin: dagvinna, yfirvinna og álagstímar per prósentu.
          // Fastlaunafólk fær laun óháð tímum — engir álagsliðir þar.
          const hb = hourBuckets(group, rules);
          hours.set(e.id as string, e.pay_type === "hourly" ? hb : { dagvinna: Math.round((hb.dagvinna + hb.yfirvinna) * 100) / 100, yfirvinna: 0, alag: {} });
          return computeFromPunches(toEmp(e), group, rules);
        });
      return { lines, kt, hours, monthly, live: true };
    }

    const lines = emps.map((e) => computeLine(toEmp(e)));
    return { lines, kt, hours, monthly, live: true };
  } catch {
    return { lines: DEMO_EMPLOYEES.map(computeLine), kt: {}, hours, monthly, live: false };
  }
}

