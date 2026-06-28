import "server-only";
import { getLaborMetrics } from "@/lib/revenue.server";
import { getEmployees } from "@/lib/employees.server";
import { computeLine, totals as sumTotals } from "@/lib/payroll";
import { nf, dec1 } from "@/lib/format";

export type DashboardView = {
  laborPct: number;
  laborCostWeek: string; // m kr (1 dp)
  hoursWeek: string;
  live: boolean;
};

const WEEKS_PER_MONTH = 4.33;

// Demo headline mirrors the prototype before Supabase is connected.
const DEMO: DashboardView = { laborPct: 32.1, laborCostWeek: "1,40", hoursWeek: "374", live: false };

/** Dashboard headline KPIs — labor% (live) + weekly labor cost/hours from real employees. */
export async function getDashboard(): Promise<DashboardView> {
  const metrics = await getLaborMetrics();
  const { employees, live } = await getEmployees();
  if (!live) {
    return { ...DEMO, laborPct: metrics.live ? metrics.laborPct : DEMO.laborPct, live: metrics.live };
  }
  if (employees.length === 0) {
    return { laborPct: metrics.live ? metrics.laborPct : 0, laborCostWeek: "0", hoursWeek: "0", live: true };
  }
  const t = sumTotals(employees.map((e) => computeLine(e)));
  const weekCost = t.cost / WEEKS_PER_MONTH;
  const weekHours = Math.round(t.hours / WEEKS_PER_MONTH);
  return {
    laborPct: metrics.laborPct,
    laborCostWeek: dec1(Math.round(weekCost / 100000) / 10),
    hoursWeek: nf(weekHours),
    live: true,
  };
}
