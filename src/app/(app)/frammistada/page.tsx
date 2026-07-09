import PerformanceScreen from "./performance-screen";
import { getCompanyData } from "@/lib/employees.server";
import { getPerformance } from "@/lib/analytics.server";
import { getStaffingPattern } from "./staffing.server";
import { getPerfHistory } from "./perf.server";
import { getInsights } from "./insights.server";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function FrammistadaPage() {
  // Staffing pattern averaged over the last ~8 weeks.
  const to = new Date(); to.setHours(0, 0, 0, 0);
  const from = new Date(to); from.setDate(from.getDate() - 55);
  const [{ empty }, perf, staffing, history, { insights }] = await Promise.all([
    getCompanyData(), getPerformance(), getStaffingPattern(iso(from), iso(to)), getPerfHistory(6), getInsights(),
  ]);
  return <PerformanceScreen empty={empty} live={perf.live} perf={perf} staffing={staffing} history={history} insights={insights} />;
}
