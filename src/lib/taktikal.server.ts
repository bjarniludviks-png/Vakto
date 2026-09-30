import "server-only";

// Taktikal — fullgild rafræn undirritun (rafræn skilríki) gegnum Signing API.
// https://docs.taktikal.is/docs/api
//
// Umhverfisbreytur:
//   TAKTIKAL_COMPANY_KEY, TAKTIKAL_API_KEY  — Basic Auth (companyKey:apiKey)
//   TAKTIKAL_WEBHOOK_KEY                    — HMAC-SHA256 lykill til að sannreyna webhooks
//   TAKTIKAL_BASE_URL   (valkvætt)          — sjálfgefið https://onboarding.taktikal.is;
//                                             þróun: https://onboardingdev.taktikal.is
//   TAKTIKAL_FLOW_KEY   (valkvætt)          — annars fyrsta flæðið úr /api/management/flow
//   TAKTIKAL_ENABLED=1                      — sýnir valkostinn í Stillingum (öryggisrofi)

import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = (process.env.TAKTIKAL_BASE_URL || "https://onboarding.taktikal.is").replace(/\/$/, "");

export function taktikalConfigured(): boolean {
  return !!(process.env.TAKTIKAL_COMPANY_KEY && process.env.TAKTIKAL_API_KEY);
}
/** Valkosturinn birtist aðeins þegar lyklar eru til OG rofinn er á (svo ekkert kosti óvart). */
export function taktikalEnabled(): boolean {
  return taktikalConfigured() && process.env.TAKTIKAL_ENABLED === "1";
}

const auth = () => "Basic " + Buffer.from(`${process.env.TAKTIKAL_COMPANY_KEY}:${process.env.TAKTIKAL_API_KEY}`).toString("base64");

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: auth(), "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = JSON.parse(text); msg += ` ${j?.responseStatus?.errorCode ?? ""} ${j?.responseStatus?.message ?? ""}`.trim(); } catch { msg += ` ${text.slice(0, 200)}`; }
    throw new Error(`Taktikal ${path}: ${msg}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

let flowKeyCache: string | null = null;
async function flowKey(): Promise<string> {
  if (process.env.TAKTIKAL_FLOW_KEY) return process.env.TAKTIKAL_FLOW_KEY;
  if (flowKeyCache) return flowKeyCache;
  const res = await call<unknown>("/api/management/flow", { method: "GET" });
  const list = (Array.isArray(res) ? res : ((res as { flows?: unknown[] })?.flows ?? [])) as { key?: string; flowKey?: string }[];
  const key = list[0]?.flowKey ?? list[0]?.key;
  if (!key) throw new Error("Taktikal: ekkert flæði fannst — stofnaðu flæði í Taktikal eða settu TAKTIKAL_FLOW_KEY");
  flowKeyCache = key;
  return key;
}

export type TaktikalSigner = { name: string; ssn: string; email: string; phone?: string | null; reason?: string };

/** Íslensk sími: 7 stafir, annars +landsnúmer. Tómt ef ógilt (þá sendir Taktikal ekki SMS). */
function phoneFor(p?: string | null): string | undefined {
  const d = (p ?? "").replace(/[^\d+]/g, "");
  if (/^\d{7}$/.test(d)) return d;
  if (/^\+354\d{7}$/.test(d)) return d.slice(4);
  if (/^\+\d{8,15}$/.test(d)) return d;
  return undefined;
}

export type TaktikalProcess = { processKey: string; employer: { key: string; url: string }; employee: { key: string; url: string } };

/** Stofnar undirritunarferli: vinnuveitandi skrifar fyrst, síðan starfsmaður — báðir með rafrænum skilríkjum. */
export async function createSigningProcess(input: {
  pdfBase64: string; fileName: string; ownerEmail: string; contractId: string;
  employer: TaktikalSigner; employee: TaktikalSigner;
}): Promise<TaktikalProcess> {
  const signee = (s: TaktikalSigner, notify: boolean) => ({
    name: s.name,
    ssn: s.ssn.replace(/\D/g, ""),
    email: s.email,
    phoneNumber: phoneFor(s.phone),
    communicationDeliveryType: notify ? "Email" : "None",
    signatureType: "Qualified",
    hidePersonalCode: true,
    reason: s.reason,
    language: "Is",
  });
  const res = await call<{ key: string; signees: { key: string; ssn?: string; email?: string; url: string }[] }>("/api/management/signing", {
    method: "POST",
    body: JSON.stringify({
      pdfDocument: input.pdfBase64,
      pdfFileName: input.fileName,
      flowKey: await flowKey(),
      user: input.ownerEmail,
      meta: { vaktoContractId: input.contractId },
      signInOrder: true,
      signatureLocation: "BottomLastPage",
      createSignees: [signee(input.employer, false), signee(input.employee, true)],
    }),
  });
  const digits = (x?: string) => (x ?? "").replace(/\D/g, "");
  const list = res.signees ?? [];
  const a = list.find((x) => digits(x.ssn) === digits(input.employer.ssn)) ?? list[0];
  const b = list.find((x) => x !== a && digits(x.ssn) === digits(input.employee.ssn)) ?? list.find((x) => x !== a);
  if (!res.key || !a?.url || !b?.url) throw new Error("Taktikal: ófullnægjandi svar við stofnun ferlis");
  return { processKey: res.key, employer: { key: a.key, url: a.url }, employee: { key: b.key, url: b.url } };
}

/** Sækir PDF-ið eins og það er núna (undirritað þegar ferlinu er lokið). */
export async function fetchSignedPdf(processKey: string, signeeKey: string): Promise<Buffer> {
  const r = await fetch(`${BASE}/api/pdf/${encodeURIComponent(processKey)}/${encodeURIComponent(signeeKey)}.pdf`, {
    headers: { Authorization: auth() }, cache: "no-store",
  });
  if (!r.ok) throw new Error(`Taktikal pdf: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export type TaktikalWebhook = {
  Id: string;
  EventData: {
    ProcessKey: string; CompanyKey: string; FlowKey?: string; EventType: number; SignedDocument?: string;
    Signees: { Name: string; Ssn?: string; Email?: string; Key: string; Signed: boolean; SignedAt?: string }[];
  };
  EventSignature: { TimeStamp: string; Guid: string; Signature: string; SignedData: string };
};

/** EventType: 1 SignedDocument · 2 AllSigned · 5 Canceled · 6 Expired · 10 Completed · 11 Created. */
export const TAKTIKAL_EVENT = { SignedDocument: 1, AllSigned: 2, Canceled: 5, Expired: 6, Completed: 10, Created: 11 } as const;

/** Sannreynir að Taktikal hafi sent webhookið: HMAC-SHA256(webhookKey, SignedData) = Signature,
 *  SignedData = TimeStamp + Guid, og CompanyKey passar við okkar. Skilar ástæðu höfnunar eða null.
 *  TimeStamp kemur sem 18 stafa JSON-tala sem JS getur ekki lesið nákvæmlega — því er tíminn
 *  lesinn úr SignedData (strengur) en ekki borinn saman við TimeStamp-svæðið. */
export function webhookRejectReason(p: TaktikalWebhook): string | null {
  const key = process.env.TAKTIKAL_WEBHOOK_KEY;
  const sig = p?.EventSignature;
  if (!key) return "no key configured";
  if (!sig?.Signature || !sig.SignedData || !sig.Guid) return "missing signature fields";
  const guid = String(sig.Guid);
  if (!sig.SignedData.endsWith(guid)) return "SignedData does not end with Guid";
  const ticks = sig.SignedData.slice(0, -guid.length);
  if (!/^\d{15,20}$/.test(ticks)) return "SignedData has no timestamp";
  // .NET ticks (100 ns frá árinu 1) — hafnað ef meira en 24 klst frá (endurspilun).
  const ms = (Number(ticks) - 621355968000000000) / 10000;
  if (!Number.isFinite(ms) || Math.abs(Date.now() - ms) > 24 * 3600e3) return "stale timestamp";
  if (process.env.TAKTIKAL_COMPANY_KEY && p.EventData?.CompanyKey !== process.env.TAKTIKAL_COMPANY_KEY) return "CompanyKey mismatch";
  const want = createHmac("sha256", key).update(sig.SignedData, "utf8").digest();
  const got = Buffer.from(sig.Signature, "base64");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return "HMAC mismatch";
  return null;
}
export function verifyWebhook(p: TaktikalWebhook): boolean {
  return webhookRejectReason(p) === null;
}
