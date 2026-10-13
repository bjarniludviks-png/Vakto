import { notFound, redirect } from "next/navigation";
import { isVaktoAdmin, getAdminOverview, getCompanyDetail, getCompanyBilling } from "@/lib/vakto-admin.server";
import CompanyScreen from "./company-screen";

export const dynamic = "force-dynamic";

// Síða eins fyrirtækis: notendur og stjórnendur, kort á skrá, reikningar, athugasemd,
// aðgerðaskrá og „Skrá inn sem“ til að sjá kerfið með þeirra augum.
export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isVaktoAdmin())) redirect("/maelabord");
  const { id } = await params;
  const [overview, detail, billing] = await Promise.all([getAdminOverview(), getCompanyDetail(id), getCompanyBilling(id)]);
  const company = overview.companies.find((c) => c.id === id);
  if (!company) notFound();
  return <CompanyScreen company={company} detail={detail} billing={billing} />;
}
