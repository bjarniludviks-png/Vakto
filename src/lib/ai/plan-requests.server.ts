import "server-only";
import type { createClient } from "@/lib/supabase/server";

// Beiðnir, frí og framboð starfsfólks fyrir eina viku — fyrir AI-vaktaplanið.
// Samþykkt frí er HÖRÐ regla (aldrei vakt) og er líka varið hér í kóða (guardLeaveShifts),
// svo reglan hvílir ekki á líkaninu. Allt annað er mjúkt: forðast/virða ef hægt er.

type Db = Awaited<ReturnType<typeof createClient>>;

export type LeaveSpan = { name: string; days: number[]; type: string };
export type PlanRequests = {
  dates: string[];
  /** Samþykkt frí (leave_requests.status = approved) — dagar 0=mán … 6=sun innan vikunnar. */
  approvedLeave: LeaveSpan[];
  /** Frí-beiðnir í bið. */
  pendingLeave: LeaveSpan[];
  /** Skráð óframboð (availability.available = false). */
  unavailable: { name: string; days: number[]; reason: string | null }[];
  /** Nýjasta framboð hvers starfsmanns (availability.available = true): dagar sem henta best. */
  preferred: { name: string; days: number[] }[];
  /** Vaktaskipti í bið (frjáls texti frá starfsmanni). */
  pendingSwaps: { from: string; to: string | null; note: string }[];
};

const DAY_IS = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];
const LEAVE_IS: Record<string, string> = { orlof: "orlof", veikindi: "veikindi", olaunad: "ólaunað" };

const okISO = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Sjö dagsetningar frá mánudegi, eða null ef `mon` er ekki mánudagur á forminu YYYY-MM-DD. */
export function weekDatesFrom(mon: unknown): string[] | null {
  if (!okISO(mon)) return null;
  const [y, m, d] = mon.split("-").map(Number);
  if (new Date(y, m - 1, d).getDay() !== 1) return null;
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(y, m - 1, d + i);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  });
}

const firstName = (v: unknown): string => {
  const e = Array.isArray(v) ? v[0] : v;
  return ((e as { full_name?: string } | null)?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
};
/** Frjáls texti starfsmanns: ein lína, stutt — gögn, ekki fyrirmæli. */
const clip = (s: unknown, n = 80): string => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const daysIn = (dates: string[], from: string | null, to: string | null) =>
  dates.map((d, i) => ((!from || d >= from) && (!to || d <= to) ? i : -1)).filter((i) => i >= 0);

/** Sækir beiðnir/frí/framboð fyrir dagana `dates` (venjulega vikan mán–sun; má vera einn dagur). Þolið: tómt svið ef fyrirspurn bregst. */
export async function getPlanRequests(supabase: Db, companyId: string, dates: string[]): Promise<PlanRequests> {
  const out: PlanRequests = { dates, approvedLeave: [], pendingLeave: [], unavailable: [], preferred: [], pendingSwaps: [] };
  const [leave, avail, swaps] = await Promise.all([
    supabase.from("leave_requests")
      .select("type, status, from_date, to_date, employees(full_name)")
      .eq("company_id", companyId).in("status", ["approved", "pending"])
      .lte("from_date", dates[dates.length - 1]).gte("to_date", dates[0]).limit(200),
    supabase.from("availability")
      .select("available, weekdays, from_date, to_date, reason, created_at, employees(full_name)")
      .eq("company_id", companyId).order("created_at", { ascending: false }).limit(300),
    supabase.from("shift_swaps")
      .select("note, requester:requester_id(full_name), requestee:requestee_id(full_name)")
      .eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }).limit(10),
  ]).catch(() => [{ data: null }, { data: null }, { data: null }] as const);

  for (const r of leave.data ?? []) {
    const name = firstName(r.employees);
    const days = daysIn(dates, r.from_date as string, r.to_date as string);
    if (!name || !days.length) continue;
    const span = { name, days, type: LEAVE_IS[r.type as string] ?? String(r.type) };
    (r.status === "approved" ? out.approvedLeave : out.pendingLeave).push(span);
  }

  const seenPref = new Set<string>();
  for (const a of avail.data ?? []) {
    const name = firstName(a.employees);
    if (!name) continue;
    const inWeek = daysIn(dates, (a.from_date as string | null) ?? null, (a.to_date as string | null) ?? null);
    if (!inWeek.length) continue;
    const wd = ((a.weekdays ?? []) as number[]).filter((n) => n >= 0 && n <= 6);
    if (a.available === false) {
      const days = wd.length ? inWeek.filter((i) => wd.includes(i)) : inWeek;
      if (days.length) out.unavailable.push({ name, days, reason: clip(a.reason) || null });
    } else if (!seenPref.has(name.toLowerCase()) && wd.length) {
      // Raðað nýjast fyrst: aðeins nýjasta framboðsskráning hvers starfsmanns gildir.
      seenPref.add(name.toLowerCase());
      out.preferred.push({ name, days: [...wd].sort() });
    }
  }

  for (const s of swaps.data ?? []) {
    const from = firstName(s.requester);
    if (!from) continue;
    out.pendingSwaps.push({ from, to: firstName(s.requestee) || null, note: clip(s.note) });
  }
  return out;
}

/** Sama og getPlanRequests fyrir fyrirtæki innskráðs notanda (null ef enginn notandi/fyrirtæki). */
export async function getPlanRequestsForMe(supabase: Db, dates: string[]): Promise<PlanRequests | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  return u?.company_id ? getPlanRequests(supabase, u.company_id as string, dates) : null;
}

const dayList = (days: number[]) => days.map((d) => DAY_IS[d]).join(", ");

/** Þjappað samhengi fyrir líkanið (fornöfn, dagar, tegund). */
export function formatPlanRequests(r: PlanRequests): string {
  const lines: string[] = [];
  if (r.approvedLeave.length)
    lines.push(`SAMÞYKKT FRÍ — HÖRÐ REGLA, aldrei vakt þessa daga: ${r.approvedLeave.map((l) => `${l.name} ${dayList(l.days)} (${l.type})`).join("; ")}.`);
  if (r.pendingLeave.length)
    lines.push(`Frí-beiðnir í bið (ekki samþykktar — forðastu vaktir þessa daga ef hægt er): ${r.pendingLeave.map((l) => `${l.name} ${dayList(l.days)} (${l.type})`).join("; ")}.`);
  if (r.unavailable.length)
    lines.push(`Skráð óframboð (forðastu þessa daga): ${r.unavailable.map((u) => `${u.name} ${dayList(u.days)}${u.reason ? ` („${u.reason}“)` : ""}`).join("; ")}.`);
  if (r.preferred.length)
    lines.push(`Framboð — dagar sem henta starfsmanni best (mjúk ósk): ${r.preferred.map((p) => `${p.name} ${dayList(p.days)}`).join("; ")}.`);
  if (r.pendingSwaps.length)
    lines.push(`Vaktaskipti í bið (ósk starfsmanns, frjáls texti): ${r.pendingSwaps.map((s) => `${s.from}${s.to ? ` ↔ ${s.to}` : ""}: „${s.note || "vaktaskipti"}“`).join("; ")}.`);
  return lines.length ? lines.join("\n") : "Engar beiðnir, frí eða framboð skráð fyrir vikuna.";
}

/** Fornafn (fyrsta orð, lágstafir) eins og gridið og líkanið nota. */
const key = (name: string) => name.trim().toLowerCase().split(/\s+/)[0] ?? "";

/** Dagar með samþykkt frí per fornafn (lágstafir). */
export function approvedLeaveDays(r: PlanRequests): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>();
  for (const l of r.approvedLeave) {
    const k = key(l.name);
    const set = m.get(k) ?? new Set<number>();
    l.days.forEach((d) => set.add(d));
    m.set(k, set);
  }
  return m;
}

/** Varnagli óháður líkaninu: sleppir vöktum sem lenda á samþykktu fríi. `dayOf` gefur 0–6 (eða -1). */
export function guardLeaveShifts<T extends { employee: string }>(
  shifts: T[], r: PlanRequests, dayOf: (s: T) => number,
): { kept: T[]; dropped: T[] } {
  const leave = approvedLeaveDays(r);
  const kept: T[] = [], dropped: T[] = [];
  for (const s of shifts) (leave.get(key(s.employee))?.has(dayOf(s)) ? dropped : kept).push(s);
  return { kept, dropped };
}

export const dayShortIS = (d: number) => DAY_IS[d] ?? "";
