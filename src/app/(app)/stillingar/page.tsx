import SettingsScreen from "./settings-screen";
import { getAuditLog } from "@/lib/audit";
import { getSettingsData } from "./settings.server";
import { getPayRules } from "@/lib/payrules.server";

export default async function StillingarPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ entries }, data, { rules }] = await Promise.all([getAuditLog(), getSettingsData(), getPayRules()]);
  const sp = await searchParams;
  const initial = (["location", "position", "invite", "revenue", "avgrevenue"] as const).find((m) => m === sp.new) ?? null;
  return <SettingsScreen audit={entries} initialModal={initial} data={data} payRules={rules} />;
}
