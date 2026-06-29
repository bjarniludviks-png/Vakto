import PerformanceScreen from "./performance-screen";
import { getCompanyData } from "@/lib/employees.server";
import { getPerformance } from "@/lib/analytics.server";

export default async function FrammistadaPage() {
  const [{ empty }, perf] = await Promise.all([getCompanyData(), getPerformance()]);
  return <PerformanceScreen empty={empty} live={perf.live} perf={perf} />;
}
