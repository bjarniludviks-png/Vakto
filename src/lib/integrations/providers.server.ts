import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { assertNotDemo } from "@/lib/demo.server";

// Tengingar við kerfi sem senda veltu. Hvert kerfi skilar heildarveltu á dag (án VSK) fyrir tímabil.
// Lyklar eru dulkóðaðir með AES-256-GCM; lykillinn er leiddur af leyndarmáli þjónsins.

export type Provider = "shopify" | "woocommerce" | "businesscentral" | "dk";
export type Creds = { token?: string; key?: string; secret?: string };

const encKey = () => createHash("sha256").update(`${process.env.INTEGRATIONS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "vakto"}:integrations`).digest();
export function encrypt(c: Creds): string {
  const iv = randomBytes(12);
  const ci = createCipheriv("aes-256-gcm", encKey(), iv);
  const body = Buffer.concat([ci.update(JSON.stringify(c), "utf8"), ci.final()]);
  return [iv, ci.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}
export function decrypt(s: string): Creds {
  const [iv, tag, body] = s.split(".").map((p) => Buffer.from(p, "base64"));
  const de = createDecipheriv("aes-256-gcm", encKey(), iv);
  de.setAuthTag(tag);
  return JSON.parse(Buffer.concat([de.update(body), de.final()]).toString("utf8"));
}

/** Slóð verslunar: aðeins https og opinber hýsilnöfn (engar IP-tölur eða innri net).
 *  Business Central: „tenant|umhverfi|fyrirtæki“ (hýsillinn er alltaf api.businesscentral.dynamics.com). */
export function normalizeSite(provider: Provider, raw: string): string | null {
  if (provider === "dk") return "dkplus.is"; // lykillinn ræður fyrirtækinu
  if (provider === "businesscentral") {
    const [tenant = "", env = "", company = ""] = raw.split("|").map((x) => x.trim());
    const okTenant = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(tenant);
    if (!okTenant || !/^[\w-]{1,30}$/.test(env || "Production") || company.length > 100) return null;
    return `${tenant.toLowerCase()}|${env || "Production"}|${company}`;
  }
  let s = raw.trim().toLowerCase().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const h = u.hostname;
  if (u.protocol !== "https:" || !h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|local|internal|lan)$/.test(h)) return null;
  if (provider === "shopify") return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(h) ? h : null;
  return `https://${h}${u.pathname === "/" ? "" : u.pathname}`;
}

const dayOf = (iso: string) => iso.slice(0, 10); // UTC-dagur (Ísland er UTC)

async function getJson(url: string, headers: Record<string, string>): Promise<{ data: unknown; link: string | null }> {
  await assertNotDemo();
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) }).catch((e: unknown) => { throw new Error(e instanceof Error && e.name === "TimeoutError" ? "Kerfið svaraði ekki í tæka tíð." : "Náði ekki sambandi við verslunina — athugaðu slóðina (án áframsendingar, t.d. með eða án www)."); });
  if (res.status === 401 || res.status === 403) throw new Error("Lykillinn var ekki samþykktur — athugaðu að hann sé réttur og hafi lesaðgang að pöntunum.");
  if (res.status === 404) throw new Error("Verslunin fannst ekki — athugaðu slóðina.");
  if (!res.ok) throw new Error(`Kerfið svaraði með villu (${res.status}).`);
  return { data: await res.json(), link: res.headers.get("link") };
}

/** Shopify Admin API: pantanir frá `fromISO`. Velta = current_subtotal_price (eftir afslátt, án VSK og sendingar). */
async function shopifyDaily(site: string, c: Creds, fromISO: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const h = { "X-Shopify-Access-Token": c.token ?? "" };
  let url: string | null = `https://${site}/admin/api/2025-01/orders.json?status=any&limit=250&created_at_min=${fromISO}T00:00:00Z&fields=created_at,current_subtotal_price,cancelled_at,test,financial_status`;
  for (let page = 0; url && page < 40; page++) {
    const { data, link }: { data: unknown; link: string | null } = await getJson(url, h);
    for (const o of ((data as { orders?: Record<string, unknown>[] }).orders ?? [])) {
      if (o.cancelled_at || o.test || o.financial_status === "voided" || o.financial_status === "refunded") continue;
      const d = dayOf(String(o.created_at)); out.set(d, (out.get(d) ?? 0) + Number(o.current_subtotal_price ?? 0));
    }
    const next: RegExpMatchArray | null = link?.match(/<([^>]+)>;\s*rel="next"/) ?? null;
    url = next ? next[1] : null;
  }
  return out;
}

/** WooCommerce REST API (v3): kláraðar og pantanir í vinnslu. Velta = total − total_tax − shipping_total. */
async function wooDaily(site: string, c: Creds, fromISO: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const auth = "Basic " + Buffer.from(`${c.key}:${c.secret}`).toString("base64");
  for (let page = 1; page <= 50; page++) {
    const { data } = await getJson(`${site}/wp-json/wc/v3/orders?after=${fromISO}T00:00:00&per_page=100&page=${page}&status=completed,processing&dates_are_gmt=true`, { Authorization: auth });
    const arr = (data as Record<string, unknown>[]) ?? [];
    for (const o of arr) {
      const d = dayOf(String(o.date_created_gmt ?? o.date_created));
      const v = Number(o.total ?? 0) - Number(o.total_tax ?? 0) - Number(o.shipping_total ?? 0);
      out.set(d, (out.get(d) ?? 0) + v);
    }
    if (arr.length < 100) break;
  }
  return out;
}

// ---------- Microsoft Dynamics 365 Business Central (líka LS Central, sem er byggt á BC) ----------
// Viðskiptavinurinn skráir forrit í Microsoft Entra (client credentials) og gefur því lesheimild í BC
// („Microsoft Entra Applications“, heimildasett D365 READ). Velta = tekjufærslur í fjárhag:
// kredit − debet á reikningum í flokknum „Income“, eftir bókunardegi.
const BC_API = "https://api.businesscentral.dynamics.com/v2.0";

async function bcToken(tenant: string, c: Creds): Promise<string> {
  await assertNotDemo();
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store", signal: AbortSignal.timeout(20000),
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.key ?? "", client_secret: c.secret ?? "", scope: "https://api.businesscentral.dynamics.com/.default" }),
  }).catch(() => { throw new Error("Náði ekki sambandi við Microsoft — reyndu aftur."); });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !d.access_token) {
    if (d.error === "invalid_client") throw new Error("Client ID eða Client secret er rangt (eða leyndarmálið er útrunnið).");
    if (d.error === "unauthorized_client" || /AADSTS700016/.test(d.error_description ?? "")) throw new Error("Forritið fannst ekki í þessum tenant — athugaðu Tenant ID og Client ID.");
    if (/AADSTS90002/.test(d.error_description ?? "")) throw new Error("Tenant fannst ekki — athugaðu Tenant ID.");
    throw new Error("Microsoft samþykkti ekki innskráninguna — athugaðu Tenant ID, Client ID og Client secret.");
  }
  return d.access_token;
}

async function bcGet(url: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) })
    .catch((e: unknown) => { throw new Error(e instanceof Error && e.name === "TimeoutError" ? "Business Central svaraði ekki í tæka tíð." : "Náði ekki sambandi við Business Central."); });
  if (res.status === 401) throw new Error("Business Central hafnaði aðganginum — bættu forritinu við í BC (Microsoft Entra Applications), stilltu það á Enabled og gefðu því heimildasettið D365 READ.");
  if (res.status === 403) throw new Error("Forritið hefur ekki lesheimild í Business Central — gefðu því heimildasettið D365 READ.");
  if (res.status === 404) throw new Error("Umhverfið fannst ekki — athugaðu heiti umhverfis (oftast Production).");
  if (!res.ok) throw new Error(`Business Central svaraði með villu (${res.status}).`);
  return (await res.json()) as Record<string, unknown>;
}

/** Tengist og finnur fyrirtækið í BC (eftir nafni; ef nafn vantar og aðeins eitt er til, það). */
async function bcCompany(site: string, c: Creds): Promise<{ token: string; base: string }> {
  const [tenant, env, name] = site.split("|");
  const token = await bcToken(tenant, c);
  const root = `${BC_API}/${encodeURIComponent(tenant)}/${encodeURIComponent(env)}/api/v2.0`;
  const list = ((await bcGet(`${root}/companies?$select=id,name,displayName`, token)).value ?? []) as { id: string; name: string; displayName?: string }[];
  const want = name.trim().toLowerCase();
  const hit = want ? list.find((x) => x.name.toLowerCase() === want || (x.displayName ?? "").toLowerCase() === want) : list.length === 1 ? list[0] : undefined;
  if (!hit) throw new Error(want ? `Fyrirtækið „${name}“ fannst ekki í Business Central. Til eru: ${list.map((x) => x.name).join(", ") || "engin"}.` : `Fleiri en eitt fyrirtæki er í Business Central — sláðu inn heitið: ${list.map((x) => x.name).join(", ")}.`);
  return { token, base: `${root}/companies(${hit.id})` };
}

async function bcDaily(site: string, c: Creds, fromISO: string): Promise<Map<string, number>> {
  const { token, base } = await bcCompany(site, c);
  const income = new Set<string>();
  let url: string | null = `${base}/accounts?$filter=category eq 'Income' and accountType eq 'Posting'&$select=number`;
  for (let i = 0; url && i < 20; i++) {
    const d = await bcGet(url, token);
    for (const a of (d.value ?? []) as { number: string }[]) income.add(a.number);
    url = (d["@odata.nextLink"] as string | undefined) ?? null;
  }
  if (!income.size) throw new Error("Engir tekjureikningar (flokkur „Income“) fundust í bókhaldslyklinum.");
  const out = new Map<string, number>();
  url = `${base}/generalLedgerEntries?$filter=postingDate ge ${fromISO}&$select=postingDate,accountNumber,debitAmount,creditAmount`;
  for (let i = 0; url && i < 400; i++) {
    const d = await bcGet(url, token);
    for (const e of (d.value ?? []) as { postingDate: string; accountNumber: string; debitAmount: number; creditAmount: number }[]) {
      if (!income.has(e.accountNumber)) continue;
      const day = dayOf(e.postingDate);
      out.set(day, (out.get(day) ?? 0) + Number(e.creditAmount ?? 0) - Number(e.debitAmount ?? 0));
    }
    url = (d["@odata.nextLink"] as string | undefined) ?? null;
  }
  return out;
}

// ---------- DK (dkPlus REST API) ----------
// Viðskiptavinurinn býr til aðgangslykil í dkPlus (Notandastillingar → stofna lykil, eitt fyrirtæki per lykil).
// Velta = tekjufærslur í fjárhag: reikningar á bilinu sem samtölureikningurinn „REKSTRARTEKJUR“ vísar á
// (íslenskur bókhaldslykill, oftast 1000..1990). Upphæðir án VSK; kredit er neikvætt í DK.
const DK_API = "https://api.dkplus.is/api/v1";

async function dkGet(path: string, token: string): Promise<{ data: unknown; next: string | null }> {
  await assertNotDemo();
  const res = await fetch(path.startsWith("http") ? path : `${DK_API}${path}`, { headers: { Authorization: `bearer ${token}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) })
    .catch((e: unknown) => { throw new Error(e instanceof Error && e.name === "TimeoutError" ? "DK svaraði ekki í tæka tíð." : "Náði ekki sambandi við DK."); });
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error("DK samþykkti ekki lykilinn — athugaðu að hann sé réttur og tengdur réttu fyrirtæki í dkPlus.");
  if (!res.ok) throw new Error(`DK svaraði með villu (${res.status}).`);
  const next = res.headers.get("link")?.match(/<([^>]+)>;\s*rel=next/)?.[1] ?? null;
  return { data: await res.json(), next };
}

/** Heiti fyrirtækisins sem lykillinn tilheyrir (prófar tenginguna). */
export async function dkCompanyName(token: string): Promise<string> {
  const { data } = await dkGet("/company", token);
  return (data as { Information?: { Company?: { Name?: string } } }).Information?.Company?.Name ?? "";
}

async function dkDaily(c: Creds, fromISO: string): Promise<Map<string, number>> {
  const token = c.token ?? "";
  const { data: accData } = await dkGet("/generalledger/account", token);
  const accounts = (accData as { Number: string; Name?: string; AccountType?: number; SumReference?: string }[]) ?? [];
  const sum = accounts.find((a) => a.AccountType === 1 && /REKSTRARTEKJUR/i.test(a.Name ?? "") && /\d+\.\.\d+/.test(a.SumReference ?? ""));
  const [lo, hi] = (sum?.SumReference ?? "1000..1999").split("..").map(Number);
  const income = new Set(accounts.filter((a) => a.AccountType !== 1 && /^\d+$/.test(a.Number) && Number(a.Number) >= lo && Number(a.Number) <= hi).map((a) => a.Number));
  if (!income.size) throw new Error("Engir tekjureikningar fundust í bókhaldslyklinum í DK.");
  const out = new Map<string, number>();
  let url: string | null = `/generalledger/transaction/page/1/1000?createdAfter=${fromISO}&include=Account,Amount,JournalDate`;
  for (let i = 0; url && i < 200; i++) {
    const { data, next } = await dkGet(url, token);
    for (const t of (data as { Account: string; Amount: number; JournalDate: string }[]) ?? []) {
      if (!income.has(t.Account)) continue;
      const day = dayOf(t.JournalDate);
      if (day < fromISO) continue;
      out.set(day, (out.get(day) ?? 0) - Number(t.Amount ?? 0));
    }
    url = next;
  }
  return out;
}

export async function fetchDaily(provider: Provider, site: string, c: Creds, fromISO: string): Promise<Map<string, number>> {
  if (provider === "dk") return dkDaily(c, fromISO);
  if (provider === "businesscentral") return bcDaily(site, c, fromISO);
  return provider === "shopify" ? shopifyDaily(site, c, fromISO) : wooDaily(site, c, fromISO);
}

/** Prófar tenginguna (ein lítil fyrirspurn) — kastar villu með skýrum skilaboðum ef hún virkar ekki. */
export async function testConnection(provider: Provider, site: string, c: Creds): Promise<void> {
  if (provider === "businesscentral") { await bcCompany(site, c); return; }
  if (provider === "dk") { await dkCompanyName(c.token ?? ""); return; }
  if (provider === "shopify") await getJson(`https://${site}/admin/api/2025-01/shop.json`, { "X-Shopify-Access-Token": c.token ?? "" });
  else await getJson(`${site}/wp-json/wc/v3/orders?per_page=1`, { Authorization: "Basic " + Buffer.from(`${c.key}:${c.secret}`).toString("base64") });
}
