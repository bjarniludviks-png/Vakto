import PayrollScreen from "./payroll-screen";
import { getPayroll } from "./payroll.server";

export default async function LaunakeyrslurPage() {
  const view = await getPayroll();
  return <PayrollScreen view={view} />;
}
