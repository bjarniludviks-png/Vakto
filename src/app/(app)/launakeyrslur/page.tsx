import PayrollScreen from "./payroll-screen";
import { getPayroll } from "./payroll.server";
import { getCompanyData } from "@/lib/employees.server";
import { getPayPeriod } from "@/lib/pay-period.server";
import { getSettlementsDue } from "@/lib/terminations.server";
import { SettlementsCard } from "../starfsfolk/termination/settlements";
import { currentPlan } from "@/lib/plan.server";
import { planAllows } from "@/lib/plan-features";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";
import { payPeriodOf } from "@/lib/periods";
import { getPayrollPeriod } from "./actions";

export default async function LaunakeyrslurPage() {
  const plan = await currentPlan(); // áskriftarleið (0089)
  if (plan && !planAllows(plan, "payroll")) return <UpgradePrompt feature="payroll" />;
  // Yfirstandandi launatímabil reiknað á þjóninum: skjárinn opnast með réttu tölunum í stað þess að sýna
  // fyrst síðustu vistuðu keyrslu (eða gróft mat) og skipta svo um þegar vafrinn hefur sótt tímabilið.
  const periodStart = await getPayPeriod();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const cur = payPeriodOf(today, periodStart);
  const [view, { empty }, due, initialPeriod] = await Promise.all([getPayroll(), getCompanyData(), getSettlementsDue(), getPayrollPeriod(cur.from, cur.to)]);
  return <PayrollScreen view={view} empty={empty} periodStart={periodStart} initialPeriod={initialPeriod.live ? initialPeriod : null} notice={due.length ? <SettlementsCard items={due} /> : null} />;
}
