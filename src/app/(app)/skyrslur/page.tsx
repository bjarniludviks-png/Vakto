import ReportsScreen from "./reports-screen";
import { getCompanyData } from "@/lib/employees.server";

export default async function SkyrslurPage() {
  const { empty } = await getCompanyData();
  return <ReportsScreen empty={empty} />;
}
