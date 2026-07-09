import SettingsScreen from "./settings-screen";
import { getSettingsData } from "./settings.server";
import { getPayRules } from "@/lib/payrules.server";
import { listRuleTemplates } from "./actions";

export default async function StillingarPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [data, { rules }, { templates }] = await Promise.all([
    getSettingsData(),
    getPayRules(),
    listRuleTemplates(),
  ]);
  const sp = await searchParams;
  const initial = (["location", "position", "invite", "revenue", "avgrevenue"] as const).find((m) => m === sp.new) ?? null;
  return <SettingsScreen initialModal={initial} data={data} payRules={rules} ruleTemplates={templates} />;
}
