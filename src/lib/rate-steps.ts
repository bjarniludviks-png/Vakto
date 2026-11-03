// Taxtahækkanir starfsmanns (employees.rate_steps, migration 0107).
//
// Stjórnandi skráir fyrirfram hvenær taxtinn á að breytast:
//   age     — þegar starfsmaðurinn verður `at` ára (fæðingardagur úr kennitölu)
//   service — eftir `at` mánuði í starfi (ráðningardagur mínus starfsaldur sem telst með)
//   date    — á tiltekinni dagsetningu
// og hvort kerfið hækki taxtann sjálft (auto) eða láti stjórnendur aðeins vita (notify).
// Dagleg keyrsla (lib/rate-steps.server.ts) framkvæmir. Hreinn kóði — vefur og þjónn.

import { addMonths, birthDateFromKennitala } from "@/lib/entitlements";

export type RateStepKind = "age" | "service" | "date";
export type RateStepMode = "auto" | "notify";
export type RateStep = {
  id: string;
  kind: RateStepKind;
  at?: number;            // ár (age) eða mánuðir (service)
  date?: string;          // YYYY-MM-DD (date)
  rate: number;           // nýr taxti (kr/klst eða kr/mán eftir launagerð); 0 = aðeins áminning
  mode: RateStepMode;
  label?: string;
  notifiedAt?: string;    // fyrirvari (7 dögum fyrr) sendur
  doneAt?: string;        // framkvæmt / tilkynnt á gildisdegi
};

export const MAX_RATE_STEPS = 12;
export const NOTICE_DAYS = 7;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type StepPerson = { kennitala?: string | null; hireDate?: string | null; priorServiceMonths?: number | null };

/** Gildisdagur þrepsins, eða null ef gögn vantar (kennitala / ráðningardagur). */
export function stepDueDate(s: RateStep, p: StepPerson): string | null {
  if (s.kind === "date") return s.date && ISO.test(s.date) ? s.date : null;
  const n = Math.round(Number(s.at));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (s.kind === "age") {
    const birth = birthDateFromKennitala(p.kennitala ?? null);
    return birth ? addMonths(birth, n * 12) : null;
  }
  if (!p.hireDate || !ISO.test(p.hireDate.slice(0, 10))) return null;
  const start = addMonths(p.hireDate.slice(0, 10), -Math.max(0, Math.round(Number(p.priorServiceMonths) || 0)));
  return addMonths(start, n);
}

/** Hvað kallar á breytinguna, á mannamáli: „verður 17 ára“, „12 mán. í starfi“, „frá 1.1.2027“. */
export function stepTrigger(s: RateStep): string {
  if (s.kind === "age") return `verður ${s.at} ára`;
  if (s.kind === "service") {
    const m = Number(s.at) || 0;
    return m % 12 === 0 ? `${m / 12} ár í starfi` : `${m} mán. í starfi`;
  }
  return s.date ? `frá ${isDisplay(s.date)}` : "dagsetning";
}

export function isDisplay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** Hreinsar inntak úr vafra/grunni — óþekkt eða gölluð þrep detta út. */
export function normalizeSteps(raw: unknown): RateStep[] {
  if (!Array.isArray(raw)) return [];
  const out: RateStep[] = [];
  for (const x of raw.slice(0, MAX_RATE_STEPS)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const kind = o.kind === "age" || o.kind === "service" || o.kind === "date" ? o.kind : null;
    if (!kind) continue;
    const rate = Math.max(0, Math.round(Number(o.rate) || 0));
    if (rate > 10_000_000) continue;
    const step: RateStep = {
      id: typeof o.id === "string" && o.id ? o.id.slice(0, 40) : Math.random().toString(36).slice(2, 10),
      kind, rate, mode: o.mode === "notify" ? "notify" : "auto",
    };
    if (kind === "date") {
      if (typeof o.date !== "string" || !ISO.test(o.date)) continue;
      step.date = o.date;
    } else {
      const at = Math.round(Number(o.at));
      if (!Number.isFinite(at) || at < 1 || at > (kind === "age" ? 80 : 600)) continue;
      step.at = at;
    }
    if (step.mode === "auto" && rate <= 0) step.mode = "notify"; // ekkert að hækka í → áminning
    if (typeof o.label === "string" && o.label.trim()) step.label = o.label.trim().slice(0, 80);
    if (typeof o.notifiedAt === "string") step.notifiedAt = o.notifiedAt;
    if (typeof o.doneAt === "string") step.doneAt = o.doneAt;
    out.push(step);
  }
  return out;
}
