// Lokaðir dagar (closed_days, migration 0107) — fyrirtækið allt (locationId null) eða einn staður.
// Triggerinn shifts_closed_day_guard í grunninum er öryggisnetið; þessi hjálparföll láta skjái og
// aðgerðir sleppa lokuðum dögum fyrirfram (og segja frá því) í stað þess að heil runa falli.

export type ClosedDay = { id: string; locationId: string | null; location?: string | null; from: string; to: string; label: string | null };

/** Lokun sem á við dag `date` fyrir vakt á staðnum `loc` (null = staður óþekktur → aðeins lokun á fyrirtækið gildir). */
export function closedOn(list: ClosedDay[], date: string, loc: string | null | undefined): ClosedDay | null {
  for (const c of list) {
    if (date < c.from || date > c.to) continue;
    if (c.locationId == null || (loc != null && c.locationId === loc)) return c;
  }
  return null;
}

/** Lokanir sem snerta dag, óháð stað (til að merkja dálka í vaktaplani). */
export function closuresOn(list: ClosedDay[], date: string): ClosedDay[] {
  return list.filter((c) => date >= c.from && date <= c.to);
}

export function closedText(c: ClosedDay): string {
  return [c.label || "Lokað", c.location].filter(Boolean).join(" · ");
}
