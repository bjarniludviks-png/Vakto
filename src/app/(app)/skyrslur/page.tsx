import ReportsScreen from "./reports-screen";
import { getCompanyData } from "@/lib/employees.server";
import { getWeekAttendance } from "@/lib/analytics.server";
import { getTimeBank, type TimeBank } from "./timebank.server";

export default async function SkyrslurPage() {
  const [{ empty }, att, timebank] = await Promise.all([getCompanyData(), getWeekAttendance(), getTimeBank()]);
  return <ReportsScreen empty={empty} live={att.live} rows={att.rows} timebank={timebank as TimeBank} />;
}
