import PerformanceScreen from "./performance-screen";
import { getCompanyData } from "@/lib/employees.server";

export default async function FrammistadaPage() {
  const { empty } = await getCompanyData();
  return <PerformanceScreen empty={empty} />;
}
