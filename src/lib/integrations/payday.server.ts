import "server-only";
import { assertNotDemo } from "@/lib/demo.server";

// Payday API (apidoc.payday.is): tímaskrá send beint í launakeyrslu.
//   POST /auth/token               { clientId, clientSecret } → accessToken (gildir í 24 klst)
//   POST /payroll/upload/timesheet [{ ssn, name, items: [{ name, quantity }] }]
// Heiti liða ("Dagvinna", "Yfirvinna", "Álag 33%" …) verða að stemma við launaliði fyrirtækisins í Payday.

const BASE = process.env.PAYDAY_API_URL || "https://api.payday.is";
const HEADERS = { "Content-Type": "application/json", "Api-Version": "alpha" };
export type PaydayCreds = { key?: string; secret?: string };
export type PaydayRow = { ssn: string; name: string; items: { name: string; quantity: number }[] };

async function call(path: string, init: RequestInit): Promise<Response> {
  await assertNotDemo();
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

// ---------- Reikningar verktaka (VAKTO Verk, 0104) ----------
//   GET  /customers/search/?query=<kt>   POST /customers   POST /invoices
export type PaydayInvoiceLine = { description: string; comment?: string; quantity: number; unitPriceExcludingVat: number; vatPercentage: number; discountPercentage: number };

/** Reikningur í Payday fyrirtækisins: viðskiptamaður fundinn eftir kennitölu (annars stofnaður), sendur í pósti. */
export async function paydayCreateInvoice(c: PaydayCreds, inv: {
  customer: { name: string; ssn?: string | null; email?: string | null; address?: string | null };
  description: string; reference: string; lines: PaydayInvoiceLine[]; dueDays?: number; sendEmail?: boolean;
}): Promise<{ id: string; number: number | null }> {
  const token = await paydayToken(c);
  const auth = { ...HEADERS, Authorization: `Bearer ${token}` };
  const ssn = (inv.customer.ssn ?? "").replace(/\D/g, "");
  let customerId: string | null = null;
  if (ssn.length === 10) {
    const r = await call(`/customers/search/?query=${ssn}`, { headers: auth });
    if (r.ok) {
      const list = (await r.json().catch(() => [])) as { id: string; ssn?: string }[] | { customers?: { id: string; ssn?: string }[] };
      customerId = (Array.isArray(list) ? list : (list.customers ?? [])).find((x) => (x.ssn ?? "").replace(/\D/g, "") === ssn)?.id ?? null;
    }
  }
  if (!customerId) {
    const r = await call("/customers", { method: "POST", headers: auth, body: JSON.stringify({ language: "is", ...(ssn.length === 10 ? { ssn } : {}), name: inv.customer.name, email: inv.customer.email ?? undefined, address: inv.customer.address ?? undefined }) });
    if (!r.ok) throw new Error(`Payday stofnaði ekki viðskiptamann: ${await reason(r)}`);
    customerId = ((await r.json()) as { id: string }).id;
  }
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + (inv.dueDays ?? 14) * 864e5).toISOString().slice(0, 10);
  const r = await call("/invoices", {
    method: "POST", headers: auth,
    body: JSON.stringify({ customer: { id: customerId }, description: inv.description, invoiceDate: today, dueDate: due, finalDueDate: due, currencyCode: "ISK", createClaim: false, sendEmail: inv.sendEmail !== false, reference: inv.reference, lines: inv.lines }),
  });
  if (!r.ok) throw new Error(`Payday tók ekki við reikningnum: ${await reason(r)}`);
  const out = (await r.json()) as { id: string; number?: number };
  return { id: out.id, number: out.number ?? null };
}
