import PayrollScreen from "./payroll-screen";
import { getPayroll } from "./payroll.server";
import { getCompanyData } from "@/lib/employees.server";
import { getPayPeriodStart } from "@/lib/pay-period.server";
import { getSettlementsDue } from "@/lib/terminations.server";
import { SettlementsCard } from "../starfsfolk/termination/settlements";
import { currentPlan } from "@/lib/plan.server";
import { planAllows } from "@/lib/plan-features";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";

export default async function LaunakeyrslurPage() {
  const plan = await currentPlan(); // áskriftarleið (0089)
  if (plan && !planAllows(plan, "payroll")) return <UpgradePrompt feature="payroll" />;
  const [view, { empty }, periodStart, due] = await Promise.all([getPayroll(), getCompanyData(), getPayPeriodStart(), getSettlementsDue()]);
  return <PayrollScreen view={view} empty={empty} periodStart={periodStart} notice={due.length ? <SettlementsCard items={due} /> : null} />;
}
