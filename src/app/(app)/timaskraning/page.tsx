import AttendanceScreen from "./attendance-screen";
import { getTodayAttendance } from "./attendance.server";
import { getCompanyData } from "@/lib/employees.server";

export default async function TimaskraningPage() {
  const [{ onShift }, { empty }] = await Promise.all([getTodayAttendance(), getCompanyData()]);
  return <AttendanceScreen onShift={onShift} empty={empty} />;
}
