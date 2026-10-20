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
import { assertNotDemo } from "@/lib/demo.server";

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

export type TaktikalPing = {
  ok: boolean; status: number | null; ms: number; base: string;
  flows: number | null; flowKeyFound: boolean | null; error?: string;
};

/** Prófar lyklana án kostnaðar: les flæðalistann (engin undirskrift stofnuð). Skilar aldrei lyklunum sjálfum. */
export async function pingTaktikal(): Promise<TaktikalPing> {
  const t0 = Date.now();
  if (!taktikalConfigured()) return { ok: false, status: null, ms: 0, base: BASE, flows: null, flowKeyFound: null, error: "TAKTIKAL_COMPANY_KEY eða TAKTIKAL_API_KEY vantar í þessu umhverfi" };
  try {
    const r = await fetch(`${BASE}/api/management/flow`, { headers: { Authorization: auth(), Accept: "application/json" }, cache: "no-store", redirect: "manual" });
    const ms = Date.now() - t0;
    if (!r.ok) {
      const error = r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400) ? "Taktikal hafnaði lyklunum" : `Taktikal svaraði ${r.status}`;
      return { ok: false, status: r.status, ms, base: BASE, flows: null, flowKeyFound: null, error };
    }
    const res: unknown = await r.json().catch(() => null);
    const list = (Array.isArray(res) ? res : ((res as { flows?: unknown[] })?.flows ?? [])) as { key?: string; flowKey?: string }[];
    const want = process.env.TAKTIKAL_FLOW_KEY;
    return {
      ok: true, status: r.status, ms, base: BASE, flows: list.length,
      flowKeyFound: want ? list.some((f) => (f.flowKey ?? f.key) === want) : null,
    };
  } catch (e) {
    return { ok: false, status: null, ms: Date.now() - t0, base: BASE, flows: null, flowKeyFound: null, error: e instanceof Error ? e.message : "Tenging mistókst" };
  }
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

/** Stofnar undirritunarferli: vinnuveitandi skrifar fyrst, síðan starfsmaður — báðir með rafrænum skilríkjum.
 *  Tenglar koma í svarinu; VAKTO afhendir þá (vinnuveitandi strax, starfsmaður í pósti eftir undirskrift vinnuveitanda). */
export async function createSigningProcess(input: {
  pdfBase64: string; fileName: string; ownerEmail: string; contractId: string;
  employer: TaktikalSigner; employee: TaktikalSigner;
}): Promise<TaktikalProcess> {
  await assertNotDemo();
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
      // Taktikal sendir engan póst (hann kæmi „frá VAKTO“ án nafns fyrirtækisins) — VAKTO sendir boðin sjálft.
      createSignees: [signee(input.employer, false), signee(input.employee, false)],
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
  if (!hmacMatches(key, sig.SignedData, sig.Signature)) return "HMAC mismatch";
  return null;
}

function hmacMatches(key: string, signedData: string, signature: string): boolean {
  const want = createHmac("sha256", key).update(signedData, "utf8").digest();
  const got = Buffer.from(signature, "base64");
  return got.length === want.length && timingSafeEqual(got, want);
}
export function verifyWebhook(p: TaktikalWebhook): boolean {
  return webhookRejectReason(p) === null;
}

/* ------------------------------------------------------------------------------------------
 * Staða ferlis sótt beint frá Taktikal (varaleið fyrir webhooks sem misfórust).
 *
 *   1. GET /api/signing/activity?ProcessKey=…  — virknilog fyrirtækisins (aðeins lestur, Basic Auth).
 *      Undirskrift = færsla með status „SigneeSigned“ og signeeKey; ferlið sjálft hefur status
 *      (Completed / Active / Canceled / Expired / Blocked).
 *   2. Varaleið: GET /api/signing/{ProcessKey}/signee/{SigneeKey} — SigningProcess með
 *      signees[].signed + signedAt.
 * ---------------------------------------------------------------------------------------- */

export type TaktikalSigneeState = { key: string; name: string; email: string | null; signed: boolean; signedAt: string | null };
export type TaktikalProcessState = {
  /** Staða ferlisins eins og Taktikal skilar henni (lágstafir), t.d. "completed", "active", "canceled". */
  status: string | null;
  signees: TaktikalSigneeState[];
  source: "activity" | "signee";
};

type ActivityEntry = { signeeKey?: string; status?: string; createdAt?: string };
type ActivitySignee = { signeeKey?: string; key?: string; name?: string; email?: string };
type ActivityWrapper = { processKey?: string; status?: string; activityLog?: ActivityEntry[]; signees?: ActivitySignee[] };
type ProcessSignee = { key?: string; name?: string; email?: string; signed?: boolean; signedAt?: string | null; status?: string };

const iso = (d: Date) => d.toISOString().slice(0, 19);

/** Les stöðu eins ferlis frá Taktikal. Kostar ekkert (engin ný undirskrift); kastar ef hvorug leiðin svarar. */
export async function fetchProcessState(processKey: string, opts: { createdAt?: string | null; signeeKey?: string | null } = {}): Promise<TaktikalProcessState> {
  if (!taktikalConfigured()) throw new Error("Taktikal er ekki tengt í þessu umhverfi");
  let activityErr: unknown = null;
  try {
    const from = new Date((opts.createdAt ? new Date(opts.createdAt).getTime() : Date.now()) - 3 * 86400e3);
    const to = new Date(Date.now() + 86400e3);
    const q = new URLSearchParams({ StartDate: iso(from), EndDate: iso(to), ProcessKey: processKey, Take: "5", StatusFilter: "All" });
    const res = await call<ActivityWrapper[] | { results?: ActivityWrapper[] }>(`/api/signing/activity?${q}`, { method: "GET" });
    const list = Array.isArray(res) ? res : (res?.results ?? []);
    const w = list.find((x) => x?.processKey === processKey) ?? (list.length === 1 ? list[0] : undefined);
    if (w) {
      const log = w.activityLog ?? [];
      const signedAt = new Map<string, string>();
      for (const e of log) {
        if (!e?.signeeKey || String(e.status ?? "").toLowerCase() !== "signeesigned") continue;
        const prev = signedAt.get(e.signeeKey);
        if (!prev || (e.createdAt ?? "") < prev) signedAt.set(e.signeeKey, e.createdAt ?? new Date().toISOString());
      }
      const signees = (w.signees ?? []).map((s) => {
        const key = s.signeeKey ?? s.key ?? "";
        return { key, name: s.name ?? "", email: s.email ?? null, signed: signedAt.has(key), signedAt: signedAt.get(key) ?? null };
      });
      // Signee sem birtist aðeins í loginu (ef signees-listinn er tómur).
      for (const [key, at] of signedAt) if (!signees.some((s) => s.key === key)) signees.push({ key, name: "", email: null, signed: true, signedAt: at });
      return { status: w.status ? String(w.status).toLowerCase() : null, signees, source: "activity" };
    }
    activityErr = new Error("Taktikal: ferlið fannst ekki í virknilogginu");
  } catch (e) { activityErr = e; }

  if (opts.signeeKey) {
    const p = await call<{ key?: string; status?: string; signees?: ProcessSignee[] }>(
      `/api/signing/${encodeURIComponent(processKey)}/signee/${encodeURIComponent(opts.signeeKey)}?UserAgent=${encodeURIComponent("VAKTO status sync")}`,
      { method: "GET" },
    );
    return {
      status: p.status ? String(p.status).toLowerCase() : null,
      signees: (p.signees ?? []).map((s) => ({
        key: s.key ?? "", name: s.name ?? "", email: s.email ?? null,
        signed: !!s.signed || String(s.status ?? "").toLowerCase() === "signed",
        signedAt: s.signedAt ?? null,
      })),
      source: "signee",
    };
  }
  throw activityErr instanceof Error ? activityErr : new Error("Taktikal: staða fékkst ekki");
}

export type TaktikalWebhookCheck = {
  /** Webhook-slóðir sem Taktikal hefur skráðar á flæðið. null = tókst ekki að lesa. */
  urls: string[] | null;
  /** Bendir einhver þeirra á /api/taktikal/webhook? */
  pointsHere: boolean | null;
  keySet: boolean;
  /** Passar TAKTIKAL_WEBHOOK_KEY við undirskrift sýnidæmisins frá Taktikal? null = ekki hægt að meta. */
  keyMatches: boolean | null;
  error?: string;
};

/** Sjálfsprófun webhooks: les skráð webhook flæðisins (GET /api/management/webhook/flowKey/{FlowKey})
 *  og ber webhook-lykilinn saman við undirritað sýnidæmi ef Taktikal skilar því. Breytir engu. */
export async function checkTaktikalWebhook(): Promise<TaktikalWebhookCheck> {
  const keySet = !!process.env.TAKTIKAL_WEBHOOK_KEY;
  if (!taktikalConfigured()) return { urls: null, pointsHere: null, keySet, keyMatches: null, error: "Lyklar vantar" };
  try {
    const fk = await flowKey();
    const res = await call<unknown>(`/api/management/webhook/flowKey/${encodeURIComponent(fk)}`, { method: "GET" });
    type Hook = { url?: unknown; sampleData?: { eventSignature?: { signedData?: string; signature?: string } } };
    const list = (Array.isArray(res) ? res : []) as Hook[];
    const urls = list.map((h) => (typeof h.url === "string" ? h.url : String((h.url as { absoluteUri?: string } | null)?.absoluteUri ?? h.url ?? ""))).filter(Boolean);
    const pointsHere = urls.some((u) => /\/api\/taktikal\/webhook\/?$/.test(u));
    let keyMatches: boolean | null = null;
    const key = process.env.TAKTIKAL_WEBHOOK_KEY;
    const sample = list.map((h) => h.sampleData?.eventSignature).find((x) => x?.signedData && x?.signature);
    if (key && sample?.signedData && sample.signature) keyMatches = hmacMatches(key, sample.signedData, sample.signature);
    return { urls, pointsHere, keySet, keyMatches };
  } catch (e) {
    return { urls: null, pointsHere: null, keySet, keyMatches: null, error: e instanceof Error ? e.message : "Tókst ekki að lesa webhook" };
  }
}
