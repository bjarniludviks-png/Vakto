// Vaktir vikunnar → reitir gridsins (starfsmaður × dagur). Notað bæði við fyrstu hleðslu (schedule.server)
// og þegar skipt er um viku (getWeekShifts), svo báðar leiðir raði eins.
//
// 0110: starfsmaður getur verið á fleiri en einni vakt sama dag (morgunmatur 7–10 + þrif 10–15).
// Fyrsta vaktin (lægsta slot, svo fyrri byrjun) er „aðalvaktin“ í gridinu eins og áður. Hinar fara í
// `extras` með sínu slot-númeri. Deild vaktarinnar fylgir með (tómt = aðaldeild starfsmanns).

export type ExtraShift = { slot: number; start: string; end: string; type?: string; loc?: string; dept?: string; draft?: boolean };
export type WeekCells = {
  grid: string[][];
  times: Record<string, { start: string; end: string }>;
  cellTypes: Record<string, string>;
  cellLocs: Record<string, string>;
  cellDepts: Record<string, string>;
  extras: Record<string, ExtraShift[]>;
  drafts: string[];
};

// employee_id, date, start_time, end_time, published, location_id, slot, shift_types(name), departments(name)
type Row = Record<string, unknown>;

export function codeForStart(start: string | null): string {
  const h = parseInt((start ?? "").slice(0, 2), 10);
  if (h === 7) return "M";
  if (h === 11) return "Mi";
  if (h === 14) return "E";
  if (h === 16) return "L";
  return "D";
}

const hm = (t: unknown) => String(t ?? "").slice(0, 5);
const nameOf = (x: unknown) => ((Array.isArray(x) ? x[0] : x) as { name?: string } | null)?.name ?? undefined;

export function buildWeekCells(rows: Row[], empIndex: Map<string, number>, dates: string[], empCount: number): WeekCells {
  const out: WeekCells = { grid: Array.from({ length: empCount }, () => Array(7).fill("off")), times: {}, cellTypes: {}, cellLocs: {}, cellDepts: {}, extras: {}, drafts: [] };
  const byCell = new Map<string, Row[]>();
  for (const s of rows) {
    const r = empIndex.get(s.employee_id as string);
    const c = dates.indexOf(s.date as string);
    if (r === undefined || c < 0) continue;
    const k = `${r}:${c}`;
    (byCell.get(k) ?? byCell.set(k, []).get(k)!).push(s);
  }
  for (const [k, list] of byCell) {
    list.sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0) || hm(a.start_time).localeCompare(hm(b.start_time)));
    const [r, c] = k.split(":").map(Number);
    const [p, ...rest] = list;
    if (p.published === false) out.drafts.push(k);
    out.grid[r][c] = codeForStart(p.start_time as string);
    out.times[k] = { start: hm(p.start_time), end: hm(p.end_time) };
    const tn = nameOf(p.shift_types); if (tn) out.cellTypes[k] = tn;
    if (p.location_id) out.cellLocs[k] = p.location_id as string;
    const dn = nameOf(p.departments); if (dn) out.cellDepts[k] = dn;
    if (rest.length) {
      out.extras[k] = rest.map((s, i) => ({
        // Sæti eftir röð — þjónninn heldur númerunum samfelldum (0, 1, …), en eldri gögn gætu verið tvítekin.
        slot: Math.max(Number(s.slot) || 0, i + 1),
        start: hm(s.start_time), end: hm(s.end_time),
        type: nameOf(s.shift_types), loc: (s.location_id as string | null) ?? undefined, dept: nameOf(s.departments),
        draft: s.published === false,
      }));
      if (rest.some((s) => s.published === false) && !out.drafts.includes(k)) out.drafts.push(k);
    }
  }
  return out;
}
