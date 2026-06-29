import ReportsScreen from "./reports-screen";
import { getCompanyData } from "@/lib/employees.server";
import { getWeekAttendance } from "@/lib/analytics.server";

export default async function SkyrslurPage() {
  const [{ empty }, att] = await Promise.all([getCompanyData(), getWeekAttendance()]);
  return <ReportsScreen empty={empty} live={att.live} rows={att.rows} />;
}
