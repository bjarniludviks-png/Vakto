import OverviewScreen from "./overview-screen";
import { listWorkOverviews } from "./actions";
import { getPayPeriodStart } from "@/lib/pay-period.server";
import { lastPayPeriod } from "@/lib/periods";

const okDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function VinnuyfirlitPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const startDay = await getPayPeriodStart();
  const def = lastPayPeriod(startDay);
  const custom = okDate(sp.from) && okDate(sp.to) && sp.to! >= sp.from!;
  const from = custom ? sp.from! : def.from;
  const to = custom ? sp.to! : def.to;
  const list = await listWorkOverviews(from, to);
  return <OverviewScreen key={`${from}_${to}`} from={from} to={to} startDay={startDay} list={list} />;
}
