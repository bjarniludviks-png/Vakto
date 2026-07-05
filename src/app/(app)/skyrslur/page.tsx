import ReportsScreen from "./reports-screen";
import { getCompanyData } from "@/lib/employees.server";
import { getWeekAttendance } from "@/lib/analytics.server";
import { getTimeBank, type TimeBank } from "./timebank.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";

export default async function SkyrslurPage() {
  const [{ empty }, att, timebank, scope] = await Promise.all([getCompanyData(), getWeekAttendance(), getTimeBank(), getMyScope()]);
  const d = scope.departments;
  const rows = scopeRows(d, att.rows);
  const tb = { ...timebank, rows: scopeRows(d, timebank.rows) } as TimeBank;
  return <ReportsScreen empty={empty} live={att.live} rows={rows} timebank={tb} />;
}
