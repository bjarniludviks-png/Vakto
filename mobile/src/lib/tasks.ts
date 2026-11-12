// Verkefni og ábyrgð (migration 0111) — sameiginlegar tegundir og hrein hjálparföll.
// Gögnin „hver á að gera hvað í dag“ koma úr SQL-föllunum tasks_day / tasks_board (sama regla í vef og appi).
// AFRIT af src/lib/tasks.ts í vefnum — breyttu báðum saman.

export type RoleVia = "fast" | "vara" | "faert" | "vakt";

export type DayRole = {
  id: string; name: string; color: string | null; responsibilities: string[];
  via: RoleVia; from_id: string | null; from_name: string | null;
};
export type DayItem = {
  id: string; title: string; needs_photo: boolean; done: boolean;
  done_at: string | null; done_by_name: string | null; photo_url: string | null; note: string | null;
};
export type DayList = {
  id: string; name: string; category: ListCategory; shared: boolean; target: ListTarget; remind?: boolean;
  due_time: string | null; role_id: string | null; role_name: string | null; from_name: string | null;
  items: DayItem[];
};
export type DayAdhoc = {
  id: string; title: string; due_time: string | null; done: boolean; done_at: string | null; done_by_name: string | null;
  needs_photo: boolean; photo_url: string | null; note: string | null; shared: boolean;
  role_name: string | null; from_name: string | null; created_by_name: string | null;
  /** Aðeins í appinu: gamall grunnur án 0111 (shift_tasks hakað beint). */
  legacy?: boolean;
};
export type DayTasks = {
  date: string; employee_id: string; on_shift: boolean;
  roles: DayRole[]; lists: DayList[]; adhoc: DayAdhoc[];
  boss: { id: string; name: string } | null;
};
export type BoardRow = DayTasks & { name: string; color: string | null; photo_url: string | null; reports_to: string | null };

export type ListCategory = "opnun" | "lokun" | "thrif" | "vikulegt" | "manadarlegt" | "annad";
export type ListTarget = "role" | "employee" | "everyone";

export const CATEGORY_LABEL: Record<ListCategory, string> = {
  opnun: "Opnun", lokun: "Lokun", thrif: "Þrif", vikulegt: "Vikulegt", manadarlegt: "Mánaðarlegt", annad: "Annað",
};
export const VIA_LABEL: Record<RoleVia, string> = {
  fast: "Fast hlutverk", vara: "Sem varamaður", faert: "Fært til þín", vakt: "Fylgir vaktinni",
};
/** ISO-vikudagar: 1 = mánudagur … 7 = sunnudagur. */
export const WEEKDAYS: { n: number; short: string; long: string }[] = [
  { n: 1, short: "Mán", long: "mánudaga" }, { n: 2, short: "Þri", long: "þriðjudaga" }, { n: 3, short: "Mið", long: "miðvikudaga" },
  { n: 4, short: "Fim", long: "fimmtudaga" }, { n: 5, short: "Fös", long: "föstudaga" }, { n: 6, short: "Lau", long: "laugardaga" },
  { n: 7, short: "Sun", long: "sunnudaga" },
];

/** „Alla daga“, „Mánudaga“, „Virka daga“, „Síðasta dag mánaðar“ … */
export function recurrenceText(weekdays: number[] | null | undefined, monthDay: number | null | undefined): string {
  if (monthDay === -1) return "Síðasta dag mánaðar";
  if (monthDay) return `${monthDay}. hvers mánaðar`;
  const w = [...new Set(weekdays ?? [])].sort();
  if (w.length === 0 || w.length === 7) return "Alla daga";
  if (w.join() === "1,2,3,4,5") return "Virka daga";
  if (w.join() === "6,7") return "Um helgar";
  const names = w.map((n) => WEEKDAYS[n - 1]?.long ?? "");
  const s = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " og " + names[names.length - 1];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function counts(d: Pick<DayTasks, "lists" | "adhoc">): { done: number; total: number } {
  let done = 0, total = 0;
  for (const l of d.lists) for (const i of l.items) { total++; if (i.done) done++; }
  for (const a of d.adhoc) { total++; if (a.done) done++; }
  return { done, total };
}

/** Er verkefnið of seint? (tími liðinn og ekki búið). `now` = "HH:MM" í dag. */
export function isLate(due: string | null, done: boolean, now: string, today: boolean): boolean {
  return !!due && !done && today && due < now;
}

export function emptyDay(empId: string, date: string): DayTasks {
  return { date, employee_id: empId, on_shift: false, roles: [], lists: [], adhoc: [], boss: null };
}
