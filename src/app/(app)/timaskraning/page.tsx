import AttendanceScreen from "./attendance-screen";
import { getTodayAttendance } from "./attendance.server";
import { getCompanyData } from "@/lib/employees.server";
import { getWeekAttendance } from "@/lib/analytics.server";

export default async function TimaskraningPage() {
  const [{ onShift }, { empty }, att] = await Promise.all([
    getTodayAttendance(), getCompanyData(), getWeekAttendance(),
  ]);
  return <AttendanceScreen onShift={onShift} empty={empty} live={att.live} rows={att.rows} />;
}
