// Aðgangur stjórnenda per notanda (migration 0095, users.permissions).
// Hrein föll án innflutnings — nav.ts, access.ts (middleware) og Client Components nota þau öll.
// SAMA regla og SQL-fallið public.has_perm() — breytið báðum saman.
//   owner   → alltaf allt (permissions hunsað)
//   manager → MANAGER_DEFAULTS nema eigandinn hafi vistað annað per svæði
//   employee/contractor → aldrei stjórnendasvæði

/** Stjórnendasvæði appsins = slóð í hliðarstikunni (/maelabord → "maelabord"). Röðin = röð í stikunni. */
export type Area = "maelabord" | "vaktaplan" | "timaskraning" | "launakeyrslur" | "starfsfolk" | "innsyn" | "stillingar";
export type UserPerms = Partial<Record<Area, boolean>>;

export const AREAS: { key: Area; label: string; hint: string }[] = [
  { key: "maelabord", label: "Mælaborð", hint: "laun % af veltu og yfirlit dagsins" },
  { key: "vaktaplan", label: "Vaktaplan", hint: "búa til og birta vaktir" },
  { key: "timaskraning", label: "Tímaskráning", hint: "stimplanir og samþykkt tíma" },
  { key: "launakeyrslur", label: "Launakeyrslur", hint: "laun allra, launakeyrslur og útflutningur" },
  { key: "starfsfolk", label: "Starfsfólk", hint: "prófílar, samningar og skjöl" },
  { key: "innsyn", label: "Innsýn", hint: "skýrslur og frammistaða" },
  { key: "stillingar", label: "Stillingar", hint: "staðir, reglur og tengingar (ekki áskrift)" },
];

/** Óbreytt frá fasta hlutverkafylkinu: stjórnandi sér allt nema laun. */
export const MANAGER_DEFAULTS: Record<Area, boolean> = {
  maelabord: true, vaktaplan: true, timaskraning: true, launakeyrslur: false, starfsfolk: true, innsyn: true, stillingar: true,
};

/** „Fullur aðgangur" — eins og eigandi nema áskrift/greiðslur og stjórnun eigenda (þær aðgerðir eru alltaf aðeins eiganda). */
export const FULL_ACCESS: Record<Area, boolean> = {
  maelabord: true, vaktaplan: true, timaskraning: true, launakeyrslur: true, starfsfolk: true, innsyn: true, stillingar: true,
};

const NONE: Record<Area, boolean> = {
  maelabord: false, vaktaplan: false, timaskraning: false, launakeyrslur: false, starfsfolk: false, innsyn: false, stillingar: false,
};

export function isArea(s: string): s is Area {
  return AREAS.some((a) => a.key === s);
}

/** Svæðið sem slóð tilheyrir (/timaskraning/vinnuyfirlit → "timaskraning"), annars null. */
export function areaOf(pathname: string): Area | null {
  const seg = pathname.split("/")[1] ?? "";
  return isArea(seg) ? seg : null;
}

/** Aðeins þekktir lyklar með boolean-gildi — allt annað er hunsað (vistun og lestur). */
export function sanitizePerms(input: unknown): UserPerms {
  const out: UserPerms = {};
  if (!input || typeof input !== "object") return out;
  for (const a of AREAS) {
    const v = (input as Record<string, unknown>)[a.key];
    if (typeof v === "boolean") out[a.key] = v;
  }
  return out;
}

/** Endanlegur aðgangur per svæði fyrir hlutverk + vistaðar heimildir. */
export function resolveAccess(role: string, perms?: unknown): Record<Area, boolean> {
  if (role === "owner") return { ...FULL_ACCESS };
  if (role === "manager") return { ...MANAGER_DEFAULTS, ...sanitizePerms(perms) };
  return { ...NONE };
}
