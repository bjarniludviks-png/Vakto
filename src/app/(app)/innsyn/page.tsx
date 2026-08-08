import { InsightsTabs } from "./insights-tabs";
import { getCompanyData } from "@/lib/employees.server";
import { getPerformance, getWeekAttendance } from "@/lib/analytics.server";
import { getStaffingPattern } from "../frammistada/staffing.server";
import { getPerfHistory } from "../frammistada/perf.server";
import { getInsights } from "../frammistada/insights.server";
import { getTimeBank, type TimeBank } from "../skyrslur/timebank.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function InnsynPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const to = new Date(); to.setHours(0, 0, 0, 0);
  const from = new Date(to); from.setDate(from.getDate() - 55);
  const [{ empty }, perf, staffing, history, { insights }, att, timebank, scope] = await Promise.all([
    getCompanyData(), getPerformance(), getStaffingPattern(iso(from), iso(to)), getPerfHistory(6), getInsights(),
    getWeekAttendance(), getTimeBank(), getMyScope(),
  ]);
  const d = scope.departments;
  const owner = scope.role === "owner";
  return (
    <InsightsTabs
      owner={owner}
      initialTab={tab === "timar" ? "timar" : "rekstur"}
      empty={empty}
      perf={{ live: perf.live, perf, staffing, history, insights }}
      reports={{ live: att.live, rows: scopeRows(d, att.rows), timebank: { ...timebank, rows: scopeRows(d, timebank.rows) } as TimeBank }}
    />
  );
}
