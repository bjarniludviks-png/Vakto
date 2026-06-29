import DashboardScreen from "./dashboard-screen";
import { getDashboard } from "./dashboard.server";

export default async function MaelabordPage() {
  const view = await getDashboard();
  return <DashboardScreen laborPct={view.laborPct} laborCostWeek={view.laborCostWeek} hoursWeek={view.hoursWeek} onboarding={view.onboarding} live={view.live} />;
}
