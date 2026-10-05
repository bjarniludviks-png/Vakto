import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Tengingar við kerfi sem senda veltu. Hvert kerfi skilar heildarveltu á dag (án VSK) fyrir tímabil.
// Lyklar eru dulkóðaðir með AES-256-GCM; lykillinn er leiddur af leyndarmáli þjónsins.

export type Provider = "shopify" | "woocommerce";
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

/** Slóð verslunar: aðeins https og opinber hýsilnöfn (engar IP-tölur eða innri net). */
export function normalizeSite(provider: Provider, raw: string): string | null {
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

export async function fetchDaily(provider: Provider, site: string, c: Creds, fromISO: string): Promise<Map<string, number>> {
  return provider === "shopify" ? shopifyDaily(site, c, fromISO) : wooDaily(site, c, fromISO);
}

/** Prófar tenginguna (ein lítil fyrirspurn) — kastar villu með skýrum skilaboðum ef hún virkar ekki. */
export async function testConnection(provider: Provider, site: string, c: Creds): Promise<void> {
  if (provider === "shopify") await getJson(`https://${site}/admin/api/2025-01/shop.json`, { "X-Shopify-Access-Token": c.token ?? "" });
  else await getJson(`${site}/wp-json/wc/v3/orders?per_page=1`, { Authorization: "Basic " + Buffer.from(`${c.key}:${c.secret}`).toString("base64") });
}
