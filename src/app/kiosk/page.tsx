import "./kiosk.css";
import KioskClient from "./kiosk-client";
import { getKioskData } from "./actions";

export const metadata = { title: "VAKTO — Stimpilklukka" };

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const data = company ? await getKioskData(company) : null;
  return <KioskClient companyId={company ?? null} data={data} />;
}
