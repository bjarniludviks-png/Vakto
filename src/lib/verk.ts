// VAKTO Verk (0102): tegundir og útreikningar sem vefur, samþykktarsíða og AI deila.
// Engin server-köll — öruggt í Client Components.

export const VSK = 0.24;
/** Endurgreiðsla VSK af vinnu manna á byggingarstað íbúðarhúsnæðis (frá 1.7.2023). */
export const VSK_REFUND_SHARE = 0.35;
/** Ökutækjastyrkur RSK 2026, fyrstu 1.000 km (kr/km). */
export const KM_RATE = 142;

export type JobStatus = "open" | "done" | "archived";
export type Client = { id: string; name: string; kennitala: string | null; email: string | null; phone: string | null; address: string | null };
export type JobListItem = {
  id: string; title: string; address: string | null; status: JobStatus; client: string | null; clientId: string | null;
  hourlyRate: number | null; hoursMonth: number; hoursTotal: number; lastAt: string | null; running: boolean;
};
export type JobEntry = {
  id: string; userId: string; who: string; startedAt: string; endedAt: string | null; hours: number;
  note: string | null; km: number; billable: boolean; onSite: boolean | null;
};
export type JobItem = { id: string; kind: "material" | "expense"; description: string; quantity: number; unitPrice: number; date: string; receiptUrl: string | null };
export type JobPhoto = { id: string; url: string; caption: string | null; createdAt: string };
export type JobReport = { id: string; token: string; from: string; to: string; status: "sent" | "approved" | "rejected"; signedName: string | null; comment: string | null; decidedAt: string | null; createdAt: string };
export type JobDetail = {
  id: string; title: string; address: string | null; lat: number | null; lng: number | null; status: JobStatus; notes: string | null;
  hourlyRate: number | null; client: Client | null;
  entries: JobEntry[]; items: JobItem[]; photos: JobPhoto[]; reports: JobReport[];
};

export type JobTotals = {
  hours: number; km: number; labor: number; materials: number; expenses: number; net: number; vsk: number; total: number;
  /** Endurgreiðsla til húseiganda: 35 % af VSK af vinnu (ef verkið er á íbúðarhúsnæði). */
  refund: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export const hoursOf = (startedAt: string, endedAt: string | null, now = Date.now()) =>
  Math.max(0, ((endedAt ? new Date(endedAt).getTime() : now) - new Date(startedAt).getTime()) / 3600000);

/** Upphæðir verks (eða skýrslutímabils): vinna = reikningshæfir tímar × tímagjald, efni og útlagt sér. */
export function jobTotals(entries: Pick<JobEntry, "hours" | "km" | "billable">[], items: Pick<JobItem, "kind" | "quantity" | "unitPrice">[], hourlyRate: number | null): JobTotals {
  const hours = r2(entries.filter((e) => e.billable).reduce((a, e) => a + e.hours, 0));
  const km = r2(entries.reduce((a, e) => a + e.km, 0));
  const labor = Math.round(hours * (hourlyRate ?? 0));
  const materials = Math.round(items.filter((i) => i.kind === "material").reduce((a, i) => a + i.quantity * i.unitPrice, 0));
  const expenses = Math.round(items.filter((i) => i.kind === "expense").reduce((a, i) => a + i.quantity * i.unitPrice, 0));
  const net = labor + materials + expenses;
  const vsk = Math.round(net * VSK);
  return { hours, km, labor, materials, expenses, net, vsk, total: net + vsk, refund: Math.round(labor * VSK * VSK_REFUND_SHARE) };
}

export const kr = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
export const hrs = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("is-IS")} klst.`;

/** Það sem viðskiptavinurinn sér og samþykkir — fryst þegar skýrslan er send. */
export type ReportSnapshot = {
  company: { name: string; kennitala: string | null };
  job: { title: string; address: string | null };
  client: { name: string; email: string | null } | null;
  from: string; to: string; hourlyRate: number | null;
  entries: { date: string; start: string; end: string; hours: number; who: string; note: string | null; km: number; onSite: boolean | null }[];
  items: { date: string; kind: "material" | "expense"; description: string; quantity: number; unitPrice: number }[];
  photos: { url: string; caption: string | null }[];
  totals: JobTotals;
};
