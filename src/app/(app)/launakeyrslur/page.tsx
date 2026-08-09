import PayrollScreen from "./payroll-screen";
import { getPayroll } from "./payroll.server";
import { getCompanyData } from "@/lib/employees.server";
import { getPayPeriodStart } from "@/lib/pay-period.server";

export default async function LaunakeyrslurPage() {
  const [view, { empty }, periodStart] = await Promise.all([getPayroll(), getCompanyData(), getPayPeriodStart()]);
  return <PayrollScreen view={view} empty={empty} periodStart={periodStart} />;
}
