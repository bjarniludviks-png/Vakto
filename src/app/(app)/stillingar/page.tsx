import SettingsScreen from "./settings-screen";
import { getAuditLog } from "@/lib/audit";
import { getSettingsData } from "./settings.server";

export default async function StillingarPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ entries }, data] = await Promise.all([getAuditLog(), getSettingsData()]);
  const sp = await searchParams;
  const initial = (["location", "position", "invite", "revenue"] as const).find((m) => m === sp.new) ?? null;
  return <SettingsScreen audit={entries} initialModal={initial} data={data} />;
}
