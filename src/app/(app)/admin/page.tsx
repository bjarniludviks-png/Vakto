import { redirect } from "next/navigation";
import AdminScreen from "./admin-screen";
import { isVaktoAdmin, getAdminOverview } from "@/lib/vakto-admin.server";

// VAKTO super-admin — only the SaaS owner's account(s) get in; everyone else
// is bounced to their dashboard without a trace of the route existing.
export default async function AdminPage() {
  if (!(await isVaktoAdmin())) redirect("/maelabord");
  const data = await getAdminOverview();
  return <AdminScreen data={data} />;
}
