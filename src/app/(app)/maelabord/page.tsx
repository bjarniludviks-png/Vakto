import DashboardScreen from "./dashboard-screen";
import { getDashboard } from "./dashboard.server";
import { getWhoIsOn } from "../timaskraning/attendance.server";
import { getPendingRequests } from "../vaktaplan/requests.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";

export default async function MaelabordPage() {
  const [scope, view, board, reqs] = await Promise.all([getMyScope(), getDashboard(), getWhoIsOn(), getPendingRequests()]);
  const d = scope.departments;
  return (
    <DashboardScreen
      view={{ ...view, openPunches: scopeRows(d, view.openPunches) }}
      onNow={scopeRows(d, board.rows)}
      missing={scopeRows(d, board.missing)}
      pending={reqs.live ? reqs.items.length : 0}
    />
  );
}
