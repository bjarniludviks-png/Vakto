// Hvíldarmat: á hverju 24 klst. tímabili, talið frá byrjun vinnudags, skal starfsmaður fá a.m.k. 11 klst. samfellda
// hvíld (kjarasamningar SA, t.d. SGS/Efling gr. 2.3, Matvís gr. 2.3.1, RSÍ gr. 2.8.1). Frávik veita frítökurétt:
// 1½ klst. í dagvinnu fyrir hverja klst. sem vantar. Hreint — vefur og þjónn.

export const DEFAULT_REST_HOURS = 11;
const H = 3600000;

export type RestShift = { who: string; name: string; start: number; end: number; label?: string };
export type RestGap = { who: string; name: string; hours: number; label: string; frituka: number };

/** Vinnudagar (24 klst. frá upphafi vinnudags) þar sem lengsta samfellda hvíld er styttri en `minHours`. */
export function restGaps(shifts: RestShift[], minHours = DEFAULT_REST_HOURS): RestGap[] {
  const by = new Map<string, RestShift[]>();
  for (const s of shifts) if (s.end > s.start) (by.get(s.who) ?? by.set(s.who, []).get(s.who)!).push(s);
  const out: RestGap[] = [];
  for (const list of by.values()) {
    list.sort((a, b) => a.start - b.start);
    let dayStart = -Infinity;
    for (let i = 0; i < list.length; i++) {
      // Nýr vinnudagur hefst þegar vakt byrjar eftir að 24 klst. tímabili fyrri vinnudags lýkur.
      if (list[i].start < dayStart + 24 * H) continue;
      dayStart = list[i].start;
      const w0 = dayStart, w1 = dayStart + 24 * H;
      const busy = list.filter((s) => s.end > w0 && s.start < w1).map((s) => [Math.max(s.start, w0), Math.min(s.end, w1)] as const);
      let cursor = w0, best = 0;
      for (const [a, b] of busy) { best = Math.max(best, a - cursor); cursor = Math.max(cursor, b); }
      best = Math.max(best, w1 - cursor) / H;
      if (best < minHours) {
        const h = Math.round(best * 10) / 10;
        out.push({ who: list[i].who, name: list[i].name, hours: h, label: list[i].label ?? "", frituka: Math.round((minHours - best) * 1.5 * 10) / 10 });
      }
    }
  }
  return out.sort((a, b) => a.hours - b.hours);
}
