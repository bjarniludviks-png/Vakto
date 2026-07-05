import AttendanceScreen from "./attendance-screen";
import { getTodayAttendance, getWhoIsOn } from "./attendance.server";
import { getCorrections } from "./actions";
import { getCompanyData } from "@/lib/employees.server";
import { getWeekAttendance } from "@/lib/analytics.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";

export default async function TimaskraningPage() {
  const [{ onShift }, { empty }, att, board, corr, scope] = await Promise.all([
    getTodayAttendance(), getCompanyData(), getWeekAttendance(), getWhoIsOn(), getCorrections(), getMyScope(),
  ]);
  const d = scope.departments;
  // A scoped manager only monitors their own departments. (Corrections carry no
  // department field, so they're left unscoped.)
  const rows = scopeRows(d, att.rows);
  const onNow = scopeRows(d, board.rows);
  const roster = scopeRows(d, board.roster);
  const onShiftCount = d.length ? onNow.length : onShift;
  return <AttendanceScreen onShift={onShiftCount} empty={empty} live={att.live} rows={rows} onNow={onNow} roster={roster} corrections={corr.rows} />;
}
