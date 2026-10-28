import OverviewScreen from "./overview-screen";
import { listWorkOverviews } from "./actions";
import { getPayPeriod } from "@/lib/pay-period.server";
import { lastPayPeriod } from "@/lib/periods";
import { currentPlan } from "@/lib/plan.server";
import { planAllows } from "@/lib/plan-features";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";

const okDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function VinnuyfirlitPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const plan = await currentPlan(); // áskriftarleið (0089)
  if (plan && !planAllows(plan, "work_overview")) return <UpgradePrompt feature="work_overview" />;
  const sp = await searchParams;
  const startDay = await getPayPeriod();
  const def = lastPayPeriod(startDay);
  const custom = okDate(sp.from) && okDate(sp.to) && sp.to! >= sp.from!;
  const from = custom ? sp.from! : def.from;
  const to = custom ? sp.to! : def.to;
  const list = await listWorkOverviews(from, to);
  return <OverviewScreen key={`${from}_${to}`} from={from} to={to} startDay={startDay} list={list} />;
}
