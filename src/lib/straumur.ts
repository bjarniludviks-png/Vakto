import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Straumur (Kvika) greiðslugátt — sjá docs.straumur.is.
// Kort er skráð með 0 kr greiðslusíðu (tokenization) og mánaðargjaldið síðan
// tekið með tokeninu (merchant-initiated). Allir lyklar koma úr env.

const BASE = (process.env.STRAUMUR_BASE_URL || "https://checkout-api.staging.straumur.is/api/v1").replace(/\/$/, "");
const KEY = process.env.STRAUMUR_API_KEY || "";
const TERMINAL_PAGE = process.env.STRAUMUR_TERMINAL_PAGE || "";      // greiðslusíða (hosted checkout)
const TERMINAL_GATEWAY = process.env.STRAUMUR_TERMINAL_GATEWAY || TERMINAL_PAGE; // token-greiðslur (API)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";

export const PRICE_BASE = 5990;          // kr/mán án VSK, 5 notendur innifaldir
export const PRICE_INCLUDED_USERS = 5;
export const PRICE_EXTRA_USER = 590;     // kr/mán án VSK
export const VAT_RATE = 0.24;

export function straumurConfigured(): boolean {
  return !!(KEY && TERMINAL_PAGE);
}

async function call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "X-API-Key": KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await r.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  if (!r.ok) {
    const msg = (json as { message?: string; error?: string } | null)?.message ?? (json as { error?: string } | null)?.error ?? text.slice(0, 300);
    throw new Error(`Straumur ${method} ${path} → ${r.status}: ${msg}`);
  }
  return json as T;
}

/** 0 kr greiðslusíða sem geymir kortið. merchantReference = card:<companyId>:<ts>. */
export async function createCardSetupCheckout(companyId: string, opts: { returnUrl: string; culture?: "is" | "en"; email?: string }): Promise<{ url: string; checkoutReference: string; reference: string }> {
  const reference = `card:${companyId}:${Date.now()}`;
  const res = await call<{ url: string; checkoutReference: string }>("/hostedcheckout", "POST", {
    amount: 0,
    currency: "ISK",
    returnUrl: opts.returnUrl,
    abandonUrl: opts.returnUrl.replace(/([?&])ok=1/, "$1ok=0"),
    reference,
    terminalIdentifier: TERMINAL_PAGE,
    recurringProcessingModel: "Subscription",
    merchantShopperReference: companyId,
    culture: opts.culture ?? "is",
    ...(opts.email ? { shopperContact: { email: opts.email } } : {}),
  });
  return { url: res.url, checkoutReference: res.checkoutReference, reference };
}

export async function checkoutStatus(checkoutReference: string): Promise<{ status: "New" | "Completed" | "Expired"; payfacReference: string | null }> {
  return call(`/hostedcheckout/status/${encodeURIComponent(checkoutReference)}`, "GET");
}

export type ChargeResult = { resultCode: string; payfacReference: string | null; checkoutReference: string | null; action?: { method: string; url: string } | null; raw: unknown };

/** Mánaðargjald tekið af skráðu korti (merchant-initiated). amount í heilum krónum. */
export async function chargeToken(opts: { token: string; amountISK: number; reference: string }): Promise<ChargeResult> {
  const res = await call<{ resultCode: string; payfacReference: string | null; checkoutReference: string | null; action?: { method: string; url: string } | null }>("/payment", "POST", {
    terminalIdentifier: TERMINAL_GATEWAY,
    amount: Math.round(opts.amountISK) * 100,   // minor units — ISK verður að enda á 00
    currency: "ISK",
    reference: opts.reference,
    origin: APP_URL,
    channel: "Web",
    returnUrl: `${APP_URL}/stillingar?tab=askrift`,
    tokenDetails: { tokenValue: opts.token, recurringProcessingModel: "Subscription" },
  });
  return { resultCode: res.resultCode, payfacReference: res.payfacReference ?? null, checkoutReference: res.checkoutReference ?? null, action: res.action ?? null, raw: res };
}

export async function disableToken(token: string): Promise<void> {
  await call("/payment/disable-token", "POST", { tokenValue: token });
}

/** Verð fyrir fjölda notenda: grunnur + auka notendur, VSK ofan á. Allt í heilum krónum. */
export function priceFor(users: number): { base: number; extra: number; vat: number; total: number; extraUsers: number } {
  const extraUsers = Math.max(0, users - PRICE_INCLUDED_USERS);
  const base = PRICE_BASE, extra = extraUsers * PRICE_EXTRA_USER;
  const net = base + extra;
  const vat = Math.round(net * VAT_RATE);
  return { base, extra, vat, total: net + vat, extraUsers };
}

/** HMAC-SHA256 yfir CheckoutReference:PayfacReference:MerchantReference:Amount:Currency:Reason:Success, lykill hex, úttak base64. */
export function verifyWebhookSignature(p: { checkoutReference?: string | null; payfacReference?: string | null; merchantReference?: string | null; amount?: string | number | null; currency?: string | null; reason?: string | null; success?: string | boolean | null; hmacSignature?: string | null }): boolean {
  const hmacKey = process.env.STRAUMUR_WEBHOOK_HMAC || "";
  if (!hmacKey || !p.hmacSignature) return false;
  const payload = [p.checkoutReference, p.payfacReference, p.merchantReference, p.amount, p.currency, p.reason, p.success]
    .map((v) => (v === null || v === undefined ? "" : String(v))).join(":");
  const expected = createHmac("sha256", Buffer.from(hmacKey, "hex")).update(payload, "utf8").digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(p.hmacSignature);
  return a.length === b.length && timingSafeEqual(a, b);
}
