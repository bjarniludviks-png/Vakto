import PayrollScreen from "./payroll-screen";
import { getPayroll } from "./payroll.server";
import { getCompanyData } from "@/lib/employees.server";
import { getPayPeriodStart } from "@/lib/pay-period.server";
import { getSettlementsDue } from "@/lib/terminations.server";
import { SettlementsCard } from "../starfsfolk/termination/settlements";

export default async function LaunakeyrslurPage() {
  const [view, { empty }, periodStart, due] = await Promise.all([getPayroll(), getCompanyData(), getPayPeriodStart(), getSettlementsDue()]);
  return <PayrollScreen view={view} empty={empty} periodStart={periodStart} notice={due.length ? <SettlementsCard items={due} /> : null} />;
}
