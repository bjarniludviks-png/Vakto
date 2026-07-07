import SettingsScreen from "./settings-screen";
import { getSettingsData } from "./settings.server";
import { getPayRules } from "@/lib/payrules.server";

export default async function StillingarPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [data, { rules }] = await Promise.all([getSettingsData(), getPayRules()]);
  const sp = await searchParams;
  const initial = (["location", "position", "invite", "revenue", "avgrevenue"] as const).find((m) => m === sp.new) ?? null;
  return <SettingsScreen initialModal={initial} data={data} payRules={rules} />;
}
