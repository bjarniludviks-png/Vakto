// Launalyklar: hvaða launalið (heiti í Payday, númer í DK) hver tímaflokkur fer á.
// Hreint — vefur og þjónn. Röð: lykill reglunnar (Band.key / CustomRules.keys) → lykill fyrirtækisins
// (companies.pay_keys, 0113) → sjálfgefið heiti („Dagvinna“, „Yfirvinna“, „Álag 33%“). Án lykla er
// útkoman nákvæmlega sú sama og fyrir 0113, svo enginn útflutningur breytist nema stjórnandi setji lykla.

import type { CustomRules, PayKeyComp, PayKeys } from "@/lib/payrules";
import type { Buckets } from "@/lib/payroll";

export const PAY_KEY_COMPONENTS: { comp: PayKeyComp; label: string; hint: string }[] = [
  { comp: "dagvinna", label: "Dagvinnutímar", hint: "allir unnir tímar utan yfirvinnu" },
  { comp: "yfirvinna", label: "Yfirvinna", hint: "tímar umfram viku-/mánaðarmörk (yfirvinna 2 þar sem hún er)" },
  { comp: "yfirvinna1", label: "Yfirvinna 1", hint: "lægra yfirvinnuþrep (Matvís, RSÍ, Samiðn)" },
  { comp: "eve", label: "Kvöld-/eftirvinnuálag", hint: "virka daga utan dagvinnu" },
  { comp: "night", label: "Næturálag", hint: "virka daga snemma morguns" },
  { comp: "weekend", label: "Helgar- og frídagaálag", hint: "laugardaga, sunnudaga og almenna frídaga" },
  { comp: "holiday", label: "Stórhátíðarálag", hint: "stórhátíðardaga" },
];

const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 40) : "");

/** Hreinsa lykla úr gagnagrunni/innslætti — tómir lyklar detta út. */
export function normalizePayKeys(v: unknown): PayKeys {
  const out: PayKeys = {};
  if (!v || typeof v !== "object") return out;
  for (const { comp } of PAY_KEY_COMPONENTS) {
    const k = clean((v as Record<string, unknown>)[comp]);
    if (k) out[comp] = k;
  }
  return out;
}

export const alagName = (pct: number) => `Álag ${String(pct).replace(".", ",")}%`;

/** Lykill fyrir álagsþátt (`eve@33`, `b2@45` …) — null = enginn lykill skilgreindur (nota sjálfgefið/prósentu). */
export function partKey(partId: string, rules: Pick<CustomRules, "bands" | "keys"> | null | undefined, company: PayKeys | null | undefined): string | null {
  const comp = partId.split("@")[0];
  if (/^b\d+$/.test(comp)) {
    const band = rules?.bands?.[Number(comp.slice(1))];
    return clean(band?.key) || null;
  }
  const c = comp as PayKeyComp;
  return clean(rules?.keys?.[c]) || clean(company?.[c]) || null;
}

export type PayItem = { name: string; quantity: number };

/** Tímar starfsmanns sem launaliðir (heiti = launalykill). Álagstímar ÁN lykils halda „Álag x%“ heitinu,
 *  eða `alagFallback(pct)` (t.d. DK-númer eftir prósentu). Skilar aðeins línum með tíma > 0. */
export function payItems(
  h: Buckets,
  rules: Pick<CustomRules, "bands" | "keys"> | null | undefined,
  company: PayKeys | null | undefined,
  opts: { dagvinna?: string; yfirvinna?: string; yfirvinna1?: string; alagFallback?: (pct: number) => string | null } = {},
): PayItem[] {
  const out = new Map<string, number>();
  const put = (name: string | null | undefined, q: number) => { if (name && q > 0) out.set(name, Math.round(((out.get(name) ?? 0) + q) * 100) / 100); };
  put(clean(rules?.keys?.dagvinna) || clean(company?.dagvinna) || opts.dagvinna || "Dagvinna", h.dagvinna);
  put(clean(rules?.keys?.yfirvinna) || clean(company?.yfirvinna) || opts.yfirvinna || "Yfirvinna", h.yfirvinna);
  put(clean(rules?.keys?.yfirvinna1) || clean(company?.yfirvinna1) || opts.yfirvinna1 || "Yfirvinna 1", h.yfirvinna1 ?? 0);
  const fallback = (pct: number) => (opts.alagFallback ? opts.alagFallback(pct) : alagName(pct));
  // Álagstímar með launalykil fara á lykilinn; afgangurinn per prósentu reiknast af `alag` (sömu námundun
  // og röð og fyrir 0113) — svo útflutningur án lykla er bæti fyrir bæti sá sami og áður.
  const keyedByPct = new Map<number, number>();
  for (const [id, p] of Object.entries(h.parts ?? {})) {
    const k = partKey(id, rules, company);
    if (k && p.hours > 0) { put(k, p.hours); keyedByPct.set(p.pct, (keyedByPct.get(p.pct) ?? 0) + p.hours); }
  }
  for (const [pct, q] of Object.entries(h.alag)) {
    const rest = Math.round((q - (keyedByPct.get(Number(pct)) ?? 0)) * 100) / 100;
    if (rest > 0) put(fallback(Number(pct)), rest);
  }
  return [...out].map(([name, quantity]) => ({ name, quantity }));
}
