import { redirect } from "next/navigation";
import { getPlatformIdentity, getPlatformTeam, getAdminOverview } from "@/lib/vakto-admin.server";
import SettingsScreen from "./settings-screen";

export const dynamic = "force-dynamic";

// Stillingar VAKTO-teymisins: minn aðgangur, útlit, teymið (boð) og öll aðgerðaskráin.
export default async function AdminSettingsPage() {
  const me = await getPlatformIdentity();
  if (!me) redirect("/maelabord");
  const [team, overview] = await Promise.all([getPlatformTeam(), getAdminOverview()]);
  return <SettingsScreen me={me} team={team} audit={overview.platformAudit} />;
}
