import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Reikningar fyrir VAKTO-áskriftina, gefnir út í Payday BGL Ventures (seljandans) þegar
// greiðsla af korti hefur farið í gegn. Payday heldur númeraröðinni, bókar tekjurnar og
// VSK-inn og sendir kaupanda reikninginn í tölvupósti. VAKTO geymir númer og id reikningsins
// og sýnir hann á kvittuninni (/kvittun/[id]) með PDF-niðurhali.
//
//   VAKTO_PAYDAY_CLIENT_ID / VAKTO_PAYDAY_CLIENT_SECRET  — API-lyklar úr Payday BGL (ekki viðskiptavinar)
//   VAKTO_PAYDAY_PAYMENT_TYPE  — greiðslutegund (guid úr GET /sales/paymenttypes) sem reikningurinn
//                                merkist greiddur með, t.d. bankareikningurinn sem Straumur greiðir inn á
//   VAKTO_PAYDAY_SEND_EMAIL    — "0" til að láta Payday EKKI senda reikninginn í pósti (sjálfgefið sent)
// Keyrir aðeins í production (eða með VAKTO_PAYDAY_FORCE=1), svo preview á staging-gögnum
// stofni aldrei reikninga í raunbókhaldi BGL.

const BASE = process.env.PAYDAY_API_URL || "https://api.payday.is";
const HEADERS = { "Content-Type": "application/json", "Api-Version": "alpha" };
const VAT = 24;

export function paydayInvoicingConfigured(): boolean {
  const live = process.env.VERCEL_ENV === "production" || process.env.VAKTO_PAYDAY_FORCE === "1";
  return live && !!process.env.VAKTO_PAYDAY_CLIENT_ID && !!process.env.VAKTO_PAYDAY_CLIENT_SECRET;
}

async function call(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  return fetch(BASE + path, {
    ...init,
    headers: { ...HEADERS, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000),
  });
}

async function fail(res: Response, what: string): Promise<never> {
  const t = (await res.text().catch(() => "")).trim();
  throw new Error(`${what}: ${res.status} ${t.startsWith("<") ? "" : t.slice(0, 300)}`.trim());
}

let cached: { token: string; until: number } | null = null;
export async function bglToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await call("/auth/token", { method: "POST", body: JSON.stringify({ clientId: process.env.VAKTO_PAYDAY_CLIENT_ID, clientSecret: process.env.VAKTO_PAYDAY_CLIENT_SECRET }) });
  if (!res.ok) await fail(res, "Payday auth");
  const j = (await res.json()) as { accessToken?: string };
  if (!j.accessToken) throw new Error("Payday auth: enginn lykill");
  cached = { token: j.accessToken, until: Date.now() + 20 * 3600e3 };
  return j.accessToken;
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Viðskiptamaður í Payday BGL fyrir fyrirtækið — fundinn eftir kennitölu, annars stofnaður. */
async function customerFor(token: string, co: { id: string; name: string; kennitala: string | null; address: string | null; postal_code: string | null; city: string | null; email: string | null; payday_customer_id: string | null }): Promise<string> {
  if (co.payday_customer_id) return co.payday_customer_id;
  const ssn = digits(co.kennitala);
  let id: string | null = null;
  if (ssn.length === 10) {
    const res = await call(`/customers/search/?query=${ssn}`, {}, token);
    if (res.ok) {
      const list = (await res.json().catch(() => [])) as { id: string; ssn?: string }[] | { customers?: { id: string; ssn?: string }[] };
      const arr = Array.isArray(list) ? list : (list.customers ?? []);
      id = arr.find((c) => digits(c.ssn) === ssn)?.id ?? null;
    }
  }
  if (!id) {
    const body = {
      language: "is", ...(ssn.length === 10 ? { ssn } : {}), name: co.name,
      address: co.address ?? undefined, zipCode: co.postal_code ?? undefined, city: co.city ?? undefined,
      email: co.email ?? undefined, finalDueDateDefaultDaysAfter: 0,
    };
    const res = await call("/customers", { method: "POST", body: JSON.stringify(body) }, token);
    if (!res.ok) await fail(res, "Payday viðskiptamaður");
    id = ((await res.json()) as { id: string }).id;
  }
  await createAdminClient().from("companies").update({ payday_customer_id: id }).eq("id", co.id);
  return id;
}

const isDate = (iso: string | null | undefined) => (iso ?? "").slice(0, 10);
const isIs = (iso: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? ""); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : ""; };

type InvRow = Record<string, unknown>;
type Line = { description: string; comment?: string; quantity: number; unitPriceExcludingVat: number; vatPercentage: number; discountPercentage: number };
const INV_COLS = "id, company_id, status, period_start, period_end, base_amount, extra_amount, esign_amount, esign_count, active_employees, users_count, total_amount, ai_amount, paid_at, reference, billing_interval, usage_start, usage_end, payday_invoice_id, payday_invoice_number, payday_attempts, payment_method, due_date";

/** Línur reikningsins (án VSK) — sameiginlegt fyrir kortagreiðslu og kröfu. */
function invoiceLines(inv: InvRow): Line[] {
  const yearly = inv.billing_interval === "year";
  const active = (inv.active_employees as number | null) ?? (inv.users_count as number) ?? 0;
  const lines: Line[] = [];
  const line = (description: string, amount: number, comment?: string) => { if (amount > 0) lines.push({ description, ...(comment ? { comment } : {}), quantity: 1, unitPriceExcludingVat: amount, vatPercentage: VAT, discountPercentage: 0 }); };
  line(yearly ? "VAKTO áskrift, árgjald" : "VAKTO áskrift, grunngjald", inv.base_amount as number, `${isIs(inv.period_start as string)} – ${isIs(inv.period_end as string)}`);
  line(`Virkir starfsmenn umfram 5 (${Math.max(0, active - 5)})`, inv.extra_amount as number, inv.usage_start ? `${isIs(inv.usage_start as string)} – ${isIs(inv.usage_end as string)}` : undefined);
  line(`Undirritanir með rafrænum skilríkjum (${inv.esign_count})`, inv.esign_amount as number);
  line("VAKTO AI, viðbót", (inv.ai_amount as number | null) ?? 0, `${isIs(inv.period_start as string)} – ${isIs(inv.period_end as string)}`);
  return lines;
}

/** Gefur út reikning í Payday BGL fyrir greidda VAKTO-færslu. Örugg endurkeyrsla: gerir
 *  ekkert ef reikningur er þegar til. Skilar Payday-númerinu eða kastar villu (sem er skráð). */
export async function issuePaydayInvoice(invoiceId: string, ownerEmail?: string | null): Promise<number | null> {
  if (!paydayInvoicingConfigured()) return null;
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices")
    .select("id, company_id, status, period_start, period_end, base_amount, extra_amount, esign_amount, esign_count, active_employees, users_count, total_amount, ai_amount, paid_at, reference, billing_interval, usage_start, usage_end, payday_invoice_id, payday_invoice_number, payday_attempts")
    .eq("id", invoiceId).maybeSingle();
  if (!inv || inv.status !== "paid" || (inv.total_amount as number) <= 0) return null;
  if (inv.payday_invoice_id) return (inv.payday_invoice_number as number | null) ?? null;
  const paymentType = process.env.VAKTO_PAYDAY_PAYMENT_TYPE;
  try {
    if (!paymentType) throw new Error("VAKTO_PAYDAY_PAYMENT_TYPE vantar — reikningur yrði skráður ógreiddur");
    const { data: co } = await admin.from("companies").select("id, name, kennitala, address, postal_code, city, email, country, payday_customer_id").eq("id", inv.company_id).maybeSingle();
    if (!co) throw new Error("fyrirtæki fannst ekki");
    // Íslenskur kaupandi án kennitölu fær ekki reikning (kennitala kaupanda á að vera á honum).
    // Telst ekki til tilrauna: reikningurinn er gefinn út í næstu keyrslu eftir að kennitalan er skráð.
    if (digits(co.kennitala as string).length !== 10 && (!co.country || co.country === "IS")) {
      await admin.from("invoices").update({ payday_error: "Kennitölu kaupanda vantar (Stillingar → Fyrirtæki)" }).eq("id", inv.id);
      return null;
    }
    const token = await bglToken();
    const customerId = await customerFor(token, { ...co, email: ownerEmail ?? (co.email as string | null) } as Parameters<typeof customerFor>[1]);

    const lines = invoiceLines(inv);
    if (!lines.length) return null;

    const paid = isDate((inv.paid_at as string) ?? new Date().toISOString());
    const ref = String(inv.reference).replace(/^inv:/, "").slice(0, 8).toUpperCase();
    const res = await call("/invoices", {
      method: "POST",
      body: JSON.stringify({
        customer: { id: customerId },
        description: `VAKTO áskrift ${isIs(inv.period_start as string)} – ${isIs(inv.period_end as string)}. Greitt með greiðslukorti.`,
        invoiceDate: paid, dueDate: paid, finalDueDate: paid, currencyCode: "ISK",
        createClaim: false, sendEmail: process.env.VAKTO_PAYDAY_SEND_EMAIL !== "0",
        reference: `VAKTO ${ref}`, paidDate: paid, paymentType, lines,
      }),
    }, token);
    if (!res.ok) await fail(res, "Payday reikningur");
    const out = (await res.json()) as { id: string; number?: number };
    await admin.from("invoices").update({ payday_invoice_id: out.id, payday_invoice_number: out.number ?? null, payday_error: null }).eq("id", inv.id);
    return out.number ?? null;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("[payday-invoice]", inv.id, msg);
    await admin.from("invoices").update({ payday_error: msg, payday_attempts: ((inv.payday_attempts as number) ?? 0) + 1 }).eq("id", inv.id);
    return null;
  }
}

/** Greiddar færslur sem eiga enn eftir að fá reikning (t.d. greitt gegnum webhook eða Payday var niðri). */
export async function issueMissingPaydayInvoices(emailOf: (companyId: string) => Promise<string | null>): Promise<number> {
  if (!paydayInvoicingConfigured()) return 0;
  const { data } = await createAdminClient().from("invoices").select("id, company_id")
    .eq("status", "paid").gt("total_amount", 0).is("payday_invoice_id", null).lt("payday_attempts", 5)
    .order("paid_at").limit(50);
  let n = 0;
  for (const r of data ?? []) if ((await issuePaydayInvoice(r.id as string, await emailOf(r.company_id as string))) !== null) n++;
  return n;
}

/** PDF reikningsins úr Payday BGL (fyrir niðurhal á kvittunarsíðunni). */
export async function paydayInvoicePdf(paydayInvoiceId: string): Promise<Response> {
  const token = await bglToken();
  return call(`/invoices/${encodeURIComponent(paydayInvoiceId)}/pdf`, { headers: { Accept: "application/pdf" } }, token);
}

/* ---------- Krafa í heimabanka ----------
 * Áskrift án korts er innheimt með reikningi í Payday BGL sem stofnar kröfu á kennitölu kaupanda
 * (createClaim: true). FORSENDA: kröfusamningur (innheimtusamningur við banka) virkur í Payday BGL.
 * Payday API (apidoc.payday.is, Sales → Invoices):
 *   POST /invoices { customer:{id}, invoiceDate, dueDate (gjalddagi), finalDueDate (eindagi), currencyCode,
 *                    createClaim, sendEmail, reference, lines } → { id, number, status: "SENT", createClaim, … }
 *   GET  /invoices/:id → { status: DRAFT|SENT|PAID|CANCELLED|CREDIT|DELETED, paidDate, claimCancelled, … }
 * Fail safe: villa → skráð í payday_error, reikningurinn helst 'pending' og er reyndur aftur (≤ 5 sinnum);
 * fyrirtæki er aldrei lokað vegna kröfu sem tókst ekki að stofna. */

/** Dagar frá útgáfu kröfu að eindaga. */
export const KRAFA_DUE_DAYS = 14;

/** Stofnar reikning með kröfu í heimabanka fyrir VAKTO-reikning (invoices.payment_method = 'krafa').
 *  Örugg endurkeyrsla: gerir ekkert ef krafa er þegar til. Skilar eindaga (YYYY-MM-DD) eða null. */
export async function issuePaydayClaimInvoice(invoiceId: string, ownerEmail?: string | null, now = new Date()): Promise<string | null> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select(INV_COLS).eq("id", invoiceId).maybeSingle();
  if (!inv || inv.status !== "pending" || inv.payment_method !== "krafa" || (inv.total_amount as number) <= 0) return null;
  if (inv.payday_invoice_id) return (inv.due_date as string | null) ?? null;
  const note = async (msg: string, attempt: boolean) => {
    console.error("[payday-krafa]", inv.id, msg);
    await admin.from("invoices").update({ payday_error: msg.slice(0, 300), ...(attempt ? { payday_attempts: ((inv.payday_attempts as number) ?? 0) + 1 } : {}) }).eq("id", inv.id);
    return null;
  };
  if (!paydayInvoicingConfigured()) return note("Payday BGL ekki tengt (VAKTO_PAYDAY_* / production): krafa ekki stofnuð", false);
  try {
    const { data: co } = await admin.from("companies").select("id, name, kennitala, address, postal_code, city, email, country, payday_customer_id").eq("id", inv.company_id).maybeSingle();
    if (!co) throw new Error("fyrirtæki fannst ekki");
    // Krafan fer á kennitöluna. Án hennar er ekkert stofnað (telst ekki tilraun; reynt aftur þegar hún er skráð).
    if (digits(co.kennitala as string).length !== 10) return note("Kennitölu kaupanda vantar: krafa ekki stofnuð", false);
    const token = await bglToken();
    const customerId = await customerFor(token, { ...co, email: ownerEmail ?? (co.email as string | null) } as Parameters<typeof customerFor>[1]);
    const lines = invoiceLines(inv);
    if (!lines.length) return null;
    const today = isDate(now.toISOString());
    const due = isDate(new Date(now.getTime() + KRAFA_DUE_DAYS * 86400000).toISOString());
    const ref = String(inv.reference).replace(/^inv:/, "").slice(0, 8).toUpperCase();
    const res = await call("/invoices", {
      method: "POST",
      body: JSON.stringify({
        customer: { id: customerId },
        description: `VAKTO áskrift ${isIs(inv.period_start as string)} – ${isIs(inv.period_end as string)}. Greitt með kröfu í heimabanka.`,
        invoiceDate: today, dueDate: today, finalDueDate: due, currencyCode: "ISK",
        createClaim: true, sendEmail: process.env.VAKTO_PAYDAY_SEND_EMAIL !== "0",
        reference: `VAKTO ${ref}`, lines,
      }),
    }, token);
    if (!res.ok) await fail(res, "Payday krafa");
    const out = (await res.json()) as { id: string; number?: number; createClaim?: boolean };
    await admin.from("invoices").update({
      payday_invoice_id: out.id, payday_invoice_number: out.number ?? null, due_date: due,
      payday_error: out.createClaim === false ? "Payday stofnaði reikning en enga kröfu (kröfusamningur?)" : null,
    }).eq("id", inv.id);
    return due;
  } catch (e) {
    return note(e instanceof Error ? e.message : String(e), true);
  }
}

export type PaydayInvoiceState = { status: string; paidDate: string | null; claimCancelled: boolean };

/** Staða reiknings/kröfu í Payday BGL (greidd, felld niður …). */
export async function paydayInvoiceState(paydayInvoiceId: string): Promise<PaydayInvoiceState> {
  const token = await bglToken();
  const res = await call(`/invoices/${encodeURIComponent(paydayInvoiceId)}`, {}, token);
  if (!res.ok) await fail(res, "Payday staða");
  const j = (await res.json()) as { status?: string; paidDate?: string | null; claimCancelled?: boolean };
  return { status: String(j.status ?? "").toUpperCase(), paidDate: j.paidDate ?? null, claimCancelled: !!j.claimCancelled };
}
