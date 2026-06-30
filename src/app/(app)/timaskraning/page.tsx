import AttendanceScreen from "./attendance-screen";
import { getTodayAttendance, getWhoIsOn } from "./attendance.server";
import { getCompanyData } from "@/lib/employees.server";
import { getWeekAttendance } from "@/lib/analytics.server";

export default async function TimaskraningPage() {
  const [{ onShift }, { empty }, att, board] = await Promise.all([
    getTodayAttendance(), getCompanyData(), getWeekAttendance(), getWhoIsOn(),
  ]);
  return <AttendanceScreen onShift={onShift} empty={empty} live={att.live} rows={att.rows} onNow={board.rows} roster={board.roster} />;
}
