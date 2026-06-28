import PayrollScreen from "./payroll-screen";
import { getPayroll } from "./payroll.server";
import { getCompanyData } from "@/lib/employees.server";

export default async function LaunakeyrslurPage() {
  const [view, { empty }] = await Promise.all([getPayroll(), getCompanyData()]);
  return <PayrollScreen view={view} empty={empty} />;
}
