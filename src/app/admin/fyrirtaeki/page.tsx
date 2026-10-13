import { redirect } from "next/navigation";
import { isVaktoAdmin, getAdminOverview } from "@/lib/vakto-admin.server";
import CompaniesScreen from "./companies-screen";

export const dynamic = "force-dynamic";

// Öll fyrirtæki sem eru skráð í VAKTO — leit, staða og flýtiaðgerðir.
export default async function AdminCompaniesPage() {
  if (!(await isVaktoAdmin())) redirect("/maelabord");
  return <CompaniesScreen data={await getAdminOverview()} />;
}
