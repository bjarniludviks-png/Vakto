// Vinnuyfirlit (0084) — gerðir og hrein hjálparföll sem vefur, PDF og þjónn deila.
// Snapshot er fryst þegar yfirlitið er búið til: launaliðir koma úr periodPayLine/hourBuckets
// (sami útreikningur og launakeyrslan), dagarnir úr birtum vöktum og samþykktum stimplunum.

export type WoStatus = "draft" | "sent" | "employee_approved" | "employee_flagged" | "final";

export type WoDay = {
  date: string;
  planned: number;                 // klst. á birtum vöktum
  plannedText: string | null;      // „08:00–16:00, 18:00–22:00“
  worked: number;                  // klst. úr samþykktum stimplunum (inn þennan dag)
  punches: { in: string; out: string }[];
  breakMin: number;                // hlé = bil milli stimplana sama dag
  leave: "orlof" | "veikindi" | "olaunad" | null;
};

export type WoPay = {
  monthly: boolean;
  rate: number;
  hours: number;                   // reiknaðir tímar (fastlaun: umsamdir tímar)
  dagvinnaH: number;
  yfirvinnaH: number;
  alag: { pct: number; h: number }[];
  dayPay: number;                  // tímakaup × allir tímar (eða mánaðarlaun)
  premiums: number;                // álag ofan á tímakaup
  overtime: number;                // yfirvinnuálag ofan á tímakaup
  uppbot: number;
  orlof: number;
  benefits: number;
  gross: number;
};

export type WoSnapshot = {
  v: 1;
  employee: { id: string; name: string; kennitala: string | null; title: string | null; dept: string | null; union: string | null };
  company: { name: string; kennitala: string | null };
  from: string;
  to: string;
  days: WoDay[];                   // aðeins dagar með vakt, vinnu eða fríi
  totals: { planned: number; worked: number; breakMin: number; diff: number; sickDays: number; leaveDays: number; shifts: number };
  pay: WoPay;
  pendingPunches: number;          // óyfirfarnar stimplanir — ekki með í yfirlitinu
  generatedAt: string;
};

export type WoLogEntry = { at: string; by: string | null; name: string | null; action: string; note?: string | null };

export type WoRow = {
  id: string;
  employeeId: string;
  name: string;
  dept: string | null;
  from: string;
  to: string;
  status: WoStatus;
  snapshot: WoSnapshot;
  employeeComment: string | null;
  managerComment: string | null;
  sentAt: string | null;
  employeeAt: string | null;
  finalAt: string | null;
  documentId: string | null;
  fingerprint: string | null;
  log: WoLogEntry[];
};

export const WO_STATUS: Record<WoStatus, { label: string; tone: "muted" | "info" | "good" | "warn" | "brand" }> = {
  draft: { label: "Drög", tone: "muted" },
  sent: { label: "Bíður starfsmanns", tone: "info" },
  employee_approved: { label: "Starfsmaður staðfesti", tone: "brand" },
  employee_flagged: { label: "Athugasemd", tone: "warn" },
  final: { label: "Lokið", tone: "good" },
};

export const WO_ACTION: Record<string, string> = {
  created: "Yfirlit búið til",
  regenerated: "Endurreiknað",
  sent: "Sent til staðfestingar",
  employee_approved: "Starfsmaður staðfesti",
  employee_flagged: "Starfsmaður gerði athugasemd",
  final: "Stjórnandi staðfesti — lokið",
};

/** JSON með röðuðum lyklum — jsonb geymir ekki lyklaröð, svo fingrafarið verður að vera óháð henni. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

/** Það sem fingrafarið (SHA-256) nær yfir: allt efni yfirlitsins + staðfestingarskráin. */
export function fingerprintSource(snapshot: WoSnapshot, log: WoLogEntry[]): string {
  return canonical({ snapshot, log: log.map((l) => ({ at: l.at, name: l.name, action: l.action, note: l.note ?? null })) });
}
