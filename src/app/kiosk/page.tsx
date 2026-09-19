import "./kiosk.css";
import KioskClient from "./kiosk-client";
import { getKioskData } from "./actions";

export const metadata = { title: "VAKTO — Stimpilklukka" };

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  // The kiosk is addressed by the company's secret kiosk token (Stillingar → afrita slóð).
  const { k } = await searchParams;
  const data = k ? await getKioskData(k) : null;
  return <KioskClient kioskKey={k ?? null} data={data} />;
}
