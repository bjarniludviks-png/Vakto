// Veikindahlutfall — gerðir og hrein föll (vefur, útflutningur og AI). Útreikningur: sickrate.server.ts.
import type { Gran } from "@/lib/periods";

export type SickRow = { id: string; name: string; dept: string; planned: number; sick: number; sickDays: number; occurrences: number };
export type SickBucket = { key: string; label: string; short: string; from: string; to: string; planned: number; sick: number; rate: number | null; sickDays: number; occurrences: number; rows: SickRow[] };
export type SickRate = { live: boolean; gran: Gran; startDay: number; company: string; buckets: SickBucket[] };

export const SICK_COUNT: Record<Gran, number> = { period: 12, month: 12, quarter: 8, year: 4 };
const r1 = (n: number) => Math.round(n * 10) / 10;
export const pctOf = (sick: number, planned: number) => (planned > 0 ? Math.round((sick / planned) * 1000) / 10 : null);

/** Skilgreiningin sem birtist í viðmóti og AI. */
export const SICK_DEFINITION = "Veikindahlutfall = veikindatímar ÷ áætlaðir vinnutímar. Veikindatímar eru tímar birtra vakta á samþykktum veikindadögum; ef engin vakt var á plani telst virkur dagur 8 klst. × starfshlutfall. Áætlaðir tímar = allar birtar vaktir tímabilsins + þeir tímar. Tilvik = samfelld veikindi (ein beiðni). Aðeins liðnir dagar.";

/** Deildaskipting úr röðum eins tímabils. */
export type SickDept = { dept: string; planned: number; sick: number; rate: number | null; sickDays: number; occurrences: number; people: number };
export function byDept(rows: SickRow[]): SickDept[] {
  const m = new Map<string, SickDept>();
  for (const r of rows) {
    const d = m.get(r.dept) ?? { dept: r.dept, planned: 0, sick: 0, rate: null, sickDays: 0, occurrences: 0, people: 0 };
    d.planned += r.planned; d.sick += r.sick; d.sickDays += r.sickDays; d.occurrences += r.occurrences; d.people++;
    m.set(r.dept, d);
  }
  return [...m.values()].map((d) => ({ ...d, planned: r1(d.planned), sick: r1(d.sick), rate: d.planned > 0 ? Math.round((d.sick / d.planned) * 1000) / 10 : null }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}
