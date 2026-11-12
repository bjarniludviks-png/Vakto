import VerkefniScreen from "./verkefni-screen";
import { getTasksOverview } from "./actions";

// Verkefni og ábyrgð (0111): hlutverk, grunnlistar, stök verkefni, ábyrgðarfærslur, skipurit og frávik.
export default async function VerkefniPage({ searchParams }: { searchParams: Promise<{ tab?: string; d?: string }> }) {
  const { tab, d } = await searchParams;
  const initial = await getTasksOverview(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  return <VerkefniScreen initial={initial} initialTab={tab} />;
}
