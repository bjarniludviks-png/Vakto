import AttendanceScreen from "./attendance-screen";
import { getTodayAttendance } from "./attendance.server";

export default async function TimaskraningPage() {
  const { onShift } = await getTodayAttendance();
  return <AttendanceScreen onShift={onShift} />;
}
