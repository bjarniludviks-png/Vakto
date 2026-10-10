import "server-only";

// Payday API (apidoc.payday.is): tímaskrá send beint í launakeyrslu.
//   POST /auth/token               { clientId, clientSecret } → accessToken (gildir í 24 klst)
//   POST /payroll/upload/timesheet [{ ssn, name, items: [{ name, quantity }] }]
// Heiti liða ("Dagvinna", "Yfirvinna", "Álag 33%" …) verða að stemma við launaliði fyrirtækisins í Payday.

const BASE = process.env.PAYDAY_API_URL || "https://api.payday.is";
const HEADERS = { "Content-Type": "application/json", "Api-Version": "alpha" };
export type PaydayCreds = { key?: string; secret?: string };
export type PaydayRow = { ssn: string; name: string; items: { name: string; quantity: number }[] };

async function call(path: string, init: RequestInit): Promise<Response> {
  return fetch(BASE + path, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000) }).catch(() => { throw new Error("Náði ekki sambandi við Payday — reyndu aftur."); });
}
/** Stutt, læsileg skilaboð úr villusvari Payday (aldrei hrár HTML eða langur texti). */
async function reason(res: Response): Promise<string> {
  const t = (await res.text().catch(() => "")).trim();
  try { const j = JSON.parse(t) as { message?: string; error?: string; errors?: unknown }; const m = j.message || j.error || (j.errors ? JSON.stringify(j.errors) : ""); if (m) return String(m).slice(0, 240); } catch { /* ekki JSON */ }
  return t && !t.startsWith("<") ? t.slice(0, 240) : `villa ${res.status}`;
}

export async function paydayToken(c: PaydayCreds): Promise<string> {
  const res = await call("/auth/token", { method: "POST", headers: HEADERS, body: JSON.stringify({ clientId: c.key, clientSecret: c.secret }) });
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error("Payday samþykkti ekki lyklana — athugaðu Client ID og Client Secret.");
  if (!res.ok) throw new Error(`Payday svaraði ekki rétt (${await reason(res)}).`);
  const j = (await res.json().catch(() => null)) as { accessToken?: string } | null;
  if (!j?.accessToken) throw new Error("Payday skilaði engum aðgangslykli.");
  return j.accessToken;
}

export async function paydayUploadTimesheet(c: PaydayCreds, rows: PaydayRow[]): Promise<void> {
  const token = await paydayToken(c);
  const res = await call("/payroll/upload/timesheet", { method: "POST", headers: { ...HEADERS, Authorization: `Bearer ${token}` }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`Payday tók ekki við tímaskránni: ${await reason(res)}`);
}
