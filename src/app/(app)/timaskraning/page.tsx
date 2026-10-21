import AttendanceScreen from "./attendance-screen";
import { getTodayAttendance, getWhoIsOn } from "./attendance.server";
import { getCorrections } from "./actions";
import { getCompanyData } from "@/lib/employees.server";
import { getWeekAttendance } from "@/lib/analytics.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";
import { checkLongPunches } from "@/lib/punch-check.server";
import { checkNoShows } from "@/lib/noshow.server";
import { after } from "next/server";
import { currentPlan } from "@/lib/plan.server";
import { planAllows } from "@/lib/plan-features";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";

export default async function TimaskraningPage() {
  const plan = await currentPlan(); // áskriftarleið (0089)
  if (plan && !planAllows(plan, "clock")) return <UpgradePrompt feature="clock" />;
  // Opportunistic "Ertu enn að vinna?" check — the daily cron is the backstop.
  void checkLongPunches();
  after(() => checkNoShows());
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
