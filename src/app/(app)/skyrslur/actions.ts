"use server";

// Manager report library (Skýrslusafn) — period-scoped datasets a framkvæmdastjóri
// wants to pull and compare: hours for payroll, overtime/premiums, attendance
// deviations, and orlof/time-bank status. One generic table shape → the client
// exports it as Excel or PDF. Demo fallback when Supabase isn't connected.
// Kjarninn er í src/lib/manager-report.server.ts (sami kóði nýtist í vöktunum/cron).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { getTimeBank } from "./timebank.server";
import { buildManagerReport, applyReportFilters, failReport, DEMO_REPORT_ROWS, REPORT_TITLES, type ReportKind, type ReportFilters, type ManagerReport } from "@/lib/manager-report.server";

export type { ReportKind, ReportFilters, ManagerReport };

/** Build one manager report over [fromISO, toISO], optionally filtered. */
export async function getManagerReport(kind: ReportKind, fromISO: string, toISO: string, filters?: ReportFilters): Promise<ManagerReport> {
  const title = REPORT_TITLES[kind];
  if (!isSupabaseConfigured()) return { ok: true, demo: true, title, company: "Kaffi Krónan", ...DEMO_REPORT_ROWS[kind] };
  try {
    const { employees: allEmployees, live } = await getEmployees();
    if (!live) return { ok: true, demo: true, title, company: "Kaffi Krónan", ...DEMO_REPORT_ROWS[kind] };
    const employees = applyReportFilters(allEmployees, filters);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failReport(kind, "Ekki innskráð(ur)");
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return failReport(kind, "Fyrirtæki fannst ekki");
    const { data: comp } = await supabase.from("companies").select("name").eq("id", company).maybeSingle();
    const companyName = (comp?.name as string) ?? "VAKTO";
    return await buildManagerReport({ db: supabase, companyId: company, companyName, employees, timeBank: () => getTimeBank(6) }, kind, fromISO, toISO);
  } catch (e) {
    return failReport(kind, e instanceof Error ? e.message : "Villa");
  }
}
