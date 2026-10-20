// Allar raðir fyrirspurnar, síða fyrir síðu.
//
// PostgREST (Supabase) skilar MEST 1.000 röðum per beiðni (`max_rows`) — líka með `.limit(20000)`.
// Án síðuskiptingar detta raðir út ÞEGJANDI: 60 manna fyrirtæki á yfir 1.000 stimplanir á mánuði,
// svo launakeyrsla, útflutningur og skýrslur yfir lengri tímabil vantaði tíma.
//
// Notkun — byggirinn fær [from, to] og verður að raða á EINKVÆMAN dálk (t.d. `.order("id")`, eða
// `.order("clock_in").order("id")`) svo síðurnar skarist hvorki né hoppi yfir raðir:
//
//   const { data, error } = await allRows((a, b) => supabase.from("punches").select("id, …")
//     .eq("company_id", c).gte("clock_in", from).order("id").range(a, b));
//
// Skilar sama formi og stök fyrirspurn ({ data, error }), svo villumeðhöndlun kallandans (t.d.
// fallback ef dálk vantar fyrir migration) helst óbreytt. Villa á HVAÐA síðu sem er → data = null
// (aldrei hálfur listi sem lítur út fyrir að vera heill — skiptir máli í launum).
//
// Engin "server-only"-merking: hreint fall án lykla, notað í .server.ts, server actions og route handlers.

/** Síðustærð = max_rows Supabase. Má ekki vera stærri en max_rows (þá stöðvast lykkjan of snemma). */
export const PAGE_SIZE = 1000;
/** Öryggisþak: 200 síður = 200.000 raðir. Fer yfir → villa frekar en þögul stytting. */
const MAX_PAGES = 200;

type PageRes = { data: unknown; error: unknown };
export type AllRowsResult<T> = { data: T[] | null; error: { message: string } | null };

export async function allRows<T = Record<string, unknown>>(
  page: (from: number, to: number) => PromiseLike<PageRes>,
): Promise<AllRowsResult<T>> {
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) return { data: null, error: error as { message: string } };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return { data: out, error: null };
  }
  return { data: null, error: { message: `allRows: fleiri en ${MAX_PAGES * PAGE_SIZE} raðir — þrengja fyrirspurn` } };
}

/** `.in(col, ids)` í bútum svo slóðin (GET) verði ekki of löng — ~36 stafir per uuid.
 *  Skilar sameinuðum röðum (hver bútur síðaður með allRows). */
export async function allRowsIn<T = Record<string, unknown>>(
  ids: string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<PageRes>,
  chunkSize = 150,
): Promise<AllRowsResult<T>> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const res = await allRows<T>((a, b) => page(chunk, a, b));
    if (res.error) return res;
    out.push(...(res.data ?? []));
  }
  return { data: out, error: null };
}
