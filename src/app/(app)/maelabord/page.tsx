import DashboardScreen from "./dashboard-screen";
import { getDashboard } from "./dashboard.server";
import { getWhoIsOn } from "../timaskraning/attendance.server";
import { getPendingRequests } from "../vaktaplan/requests.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";

export default async function MaelabordPage() {
  const scope = await getMyScope();
  const [view, board, reqs] = await Promise.all([getDashboard(scope.departments), getWhoIsOn(), getPendingRequests()]);
  const d = scope.departments;
  return <DashboardScreen laborPct={view.laborPct} laborCostWeek={view.laborCostWeek} hoursWeek={view.hoursWeek} onboarding={view.onboarding} live={view.live} onNow={scopeRows(d, board.rows)} missing={scopeRows(d, board.missing)} pending={reqs.items.length} />;
}
