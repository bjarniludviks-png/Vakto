import "server-only";

// Rafræn undirritun ráðningarsamninga án greiddrar þjónustu (migration 0058).
//
//   1. Vinnuveitandi sendir samning → employerSign(): fingrafar (SHA-256) af textanum
//      er fest á samninginn og undirskrift vinnuveitanda skráð (innskráð lota + IP/tæki).
//   2. Starfsmaður biður um kóða → requestSignCode(): 6 stafir á netfang hans, gildir
//      10 mín, aðeins hash af kóðanum er geymt, mest 5 tilraunir.
//   3. Starfsmaður slær inn kóða → signWithCode(): kóði + fingrafar staðfest, samningur
//      merktur undirritaður, undirskrift skráð, PDF með undirritunarskrá búið til,
//      vistað í skjalasafn starfsmannsins og sent báðum aðilum.
//
// Öll skrif fara gegnum þjónustulykil eftir að kallandinn hefur verið staðfestur —
// starfsmaður getur ekki merkt samning undirritaðan beint (0058 tók þá reglu út).

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { sendContractCodeEmail, sendSignedContractEmail, sendTaktikalSignEmail } from "@/lib/email";
import { notifyEmployee } from "@/lib/push";
import { buildContractPdf, type SignatureRecord } from "@/lib/contract-pdf";
import { createSigningProcess, fetchProcessState, fetchSignedPdf, taktikalConfigured, TAKTIKAL_EVENT, type TaktikalSigneeState, type TaktikalWebhook } from "@/lib/taktikal.server";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

export type SignerMeta = { ip: string | null; userAgent: string | null };

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** IP + tæki úr beiðnihausum (Vercel setur x-forwarded-for). */
export function metaFrom(h: Headers): SignerMeta {
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent");
  return { ip, userAgent: ua ? ua.slice(0, 400) : null };
}

const codeHash = (contractId: string, userId: string, code: string) =>
  sha256(`${contractId}:${userId}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`);

/** Kallað þegar stjórnandi sendir samning til undirritunar (eftir RLS-uppfærslu í „sent“). */
export async function employerSign(contractId: string, signer: { userId: string; name: string; email: string | null }, meta: SignerMeta): Promise<void> {
  const admin = createAdminClient();
  const { data: c } = await admin.from("contracts").select("id, company_id, content, status").eq("id", contractId).maybeSingle();
  if (!c || c.status !== "sent") return;
  const hash = sha256(c.content as string);
  const now = new Date().toISOString();
  await admin.from("contracts").update({ content_sha256: hash, employer_signed_at: now, employer_signed_by: signer.name }).eq("id", contractId);
  // Ný sending (t.d. eftir leiðréttingu) → fyrri undirskriftir eiga ekki lengur við.
  await admin.from("contract_signatures").delete().eq("contract_id", contractId);
  await admin.from("contract_signatures").insert({
    contract_id: contractId, company_id: c.company_id, signer_role: "employer", signer_name: signer.name,
    signer_email: signer.email, user_id: signer.userId, method: "session", doc_sha256: hash,
    ip: meta.ip, user_agent: meta.userAgent, signed_at: now,
  });
}

type Caller = { userId: string; email: string | null };

/** Heiti skjals út frá titli samnings: ráðningar-/verksamningur, eða t.d. „Uppsagnarbréf“ (starfslok, 0088). */
function docNames(title: string | null | undefined): { label: string; ascii: string; type: string } {
  const t = String(title ?? "").trim();
  const label = t.startsWith("Verksamningur") ? "Verksamningur" : !t || t.startsWith("Ráðningarsamningur") ? "Ráðningarsamningur" : t.split(" — ")[0].trim();
  const ascii = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ð/g, "d").replace(/Ð/g, "D").replace(/þ/g, "th").replace(/Þ/g, "Th")
    .replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Samningur";
  const type = label === "Verksamningur" || label === "Ráðningarsamningur" ? "Samningur" : "Starfslok";
  return { label, ascii, type };
}

/** Push til starfsmannsins um samning/bréf: „sign“ = bíður undirritunar (appið opnar /samningur?id=…),
 *  „stored“ = undirritað eintak komið í Skjöl. Opið demo sleppt; kastar aldrei (má ekki stöðva sendingu). */
export async function notifyContractEmployee(contractId: string, kind: "sign" | "stored"): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: c } = await admin.from("contracts").select("employee_id, company_id, title, companies(name)").eq("id", contractId).maybeSingle();
    if (!c?.employee_id || (await demoBlocked(c.company_id as string))) return;
    const co = ((Array.isArray(c.companies) ? c.companies[0] : c.companies) as { name?: string } | null)?.name || "Vinnuveitandinn þinn";
    const dn = docNames(c.title as string);
    const letter = dn.type === "Starfslok"; // t.d. uppsagnarbréf: lesið og móttaka staðfest
    const payload = kind === "sign"
      ? letter
        ? { title: `${dn.label} til lestrar`, body: `${co} sendi þér bréf. Opnaðu til að lesa og staðfesta móttöku.` }
        : { title: `${dn.label} til undirritunar`, body: `${co} sendi þér samning. Opnaðu til að lesa og undirrita.` }
      : letter
        ? { title: `${dn.label} — undirritað`, body: "Undirritað eintak er komið í Skjöl." }
        : { title: "Samningurinn er undirritaður", body: "Undirritaður samningur er kominn í Skjöl." };
    await notifyEmployee(c.employee_id as string, {
      ...payload, url: "/mitt-svaedi", appUrl: kind === "sign" ? `/samningur?id=${contractId}` : "/skjol", tag: `contract-${contractId}`,
    });
  } catch (e) { console.error("notifyContractEmployee", e); }
}

/** Finnur samning sem kallandinn (starfsmaður) á og er í undirritunarferli. */
async function ownContract(caller: Caller, contractId: string) {
  const admin = createAdminClient();
  const { data: emp } = await admin.from("employees").select("id, full_name, email, company_id").eq("user_id", caller.userId).maybeSingle();
  if (!emp) return { error: "Starfsmannaprófíll fannst ekki" as const };
  const { data: c } = await admin.from("contracts")
    .select("id, company_id, employee_id, title, content, status, content_sha256, companies(name)")
    .eq("id", contractId).maybeSingle();
  if (!c || c.employee_id !== emp.id) return { error: "Samningur fannst ekki" as const };
  if (c.status !== "sent") return { error: c.status === "signed" ? "Samningurinn er þegar undirritaður" as const : "Samningurinn er ekki í undirritunarferli" as const };
  const co = (Array.isArray(c.companies) ? c.companies[0] : c.companies) as { name?: string } | null;
  return { admin, emp, c, company: co?.name ?? "Vinnuveitandi" };
}

export async function requestSignCode(caller: Caller, contractId: string): Promise<{ ok: boolean; sentTo?: string; error?: string }> {
  const r = await ownContract(caller, contractId);
  if ("error" in r) return { ok: false, error: r.error };
  if (await demoBlocked(r.c.company_id as string)) return demoResult();
  const to = caller.email ?? (r.emp.email as string | null);
  if (!to) return { ok: false, error: "Ekkert netfang skráð — talaðu við vinnuveitandann" };
  // Hóf: nýr kóði í fyrsta lagi á 45 sek. fresti.
  const { data: prev } = await r.admin.from("contract_sign_codes").select("created_at").eq("contract_id", contractId).eq("user_id", caller.userId).maybeSingle();
  if (prev && Date.now() - new Date(prev.created_at as string).getTime() < 45_000) return { ok: false, error: "Bíddu smástund áður en þú biður um nýjan kóða" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await r.admin.from("contract_sign_codes").upsert({
    contract_id: contractId, user_id: caller.userId, code_hash: codeHash(contractId, caller.userId, code),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(), attempts: 0, created_at: new Date().toISOString(),
  });
  if (error) { console.error("requestSignCode", error); return { ok: false, error: "Tókst ekki að búa til kóða" }; }
  const sent = await sendContractCodeEmail(to, code, r.company);
  if (!sent.ok) return { ok: false, error: "Tókst ekki að senda kóðann" };
  const [u, d] = to.split("@");
  return { ok: true, sentTo: `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}` };
}

export async function signWithCode(caller: Caller, contractId: string, code: string, meta: SignerMeta): Promise<{ ok: boolean; error?: string }> {
  const r = await ownContract(caller, contractId);
  if ("error" in r) return { ok: false, error: r.error };
  const { admin, emp, c } = r;
  const { data: row } = await admin.from("contract_sign_codes").select("code_hash, expires_at, attempts").eq("contract_id", contractId).eq("user_id", caller.userId).maybeSingle();
  if (!row) return { ok: false, error: "Biddu um kóða fyrst" };
  if (new Date(row.expires_at as string).getTime() < Date.now()) return { ok: false, error: "Kóðinn er útrunninn — biddu um nýjan" };
  if ((row.attempts as number) >= MAX_ATTEMPTS) return { ok: false, error: "Of margar tilraunir — biddu um nýjan kóða" };
  const want = Buffer.from(row.code_hash as string, "hex");
  const got = Buffer.from(codeHash(contractId, caller.userId, code.replace(/\D/g, "")), "hex");
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    await admin.from("contract_sign_codes").update({ attempts: (row.attempts as number) + 1 }).eq("contract_id", contractId).eq("user_id", caller.userId);
    return { ok: false, error: "Rangur kóði" };
  }

  // Fingrafarið verður að stemma við það sem vinnuveitandinn sendi.
  const hash = sha256(c.content as string);
  if (c.content_sha256 && c.content_sha256 !== hash) return { ok: false, error: "Samningnum var breytt eftir að hann var sendur — biddu vinnuveitandann að senda hann aftur" };

  const now = new Date().toISOString();
  const name = (emp.full_name as string) || caller.email || "Starfsmaður";
  const { error: upErr } = await admin.from("contracts")
    .update({ status: "signed", signed_at: now, signed_by_name: name, signed_via: "email_otp", content_sha256: hash })
    .eq("id", contractId).eq("status", "sent");
  if (upErr) { console.error("signWithCode", upErr); return { ok: false, error: "Tókst ekki að vista undirritunina" }; }
  await admin.from("contract_signatures").insert({
    contract_id: contractId, company_id: c.company_id, signer_role: "employee", signer_name: name,
    signer_email: caller.email ?? emp.email, user_id: caller.userId, method: "email_otp", doc_sha256: hash,
    ip: meta.ip, user_agent: meta.userAgent, signed_at: now,
  });
  await admin.from("contract_sign_codes").delete().eq("contract_id", contractId).eq("user_id", caller.userId);
  await admin.from("audit_log").insert({
    company_id: c.company_id, user_id: caller.userId, action: "contract.sign", entity: "contract", entity_id: contractId,
    detail: `Samningur undirritaður rafrænt (kóði á netfang) — ${name}`,
  }).then(() => {}, () => {});

  try { await deliverSignedCopy(contractId); } catch (e) { console.error("deliverSignedCopy", e); }
  return { ok: true };
}

export async function getSignatures(contractId: string): Promise<SignatureRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("contract_signatures")
    .select("signer_role, signer_name, signer_email, method, signed_at, ip, user_agent, doc_sha256")
    .eq("contract_id", contractId).order("signed_at");
  return (data ?? []).map((s) => ({
    role: s.signer_role as "employer" | "employee", name: s.signer_name as string, email: (s.signer_email as string | null) ?? null,
    method: s.method as string, signedAt: s.signed_at as string, ip: (s.ip as string | null) ?? null,
    userAgent: (s.user_agent as string | null) ?? null, sha256: s.doc_sha256 as string,
  }));
}

/** PDF með undirritunarskrá → skjalasafn starfsmanns + tölvupóstur til beggja. */
async function deliverSignedCopy(contractId: string) {
  const admin = createAdminClient();
  const { data: c } = await admin.from("contracts")
    .select("id, company_id, employee_id, title, content, employees(full_name, email), companies(name)")
    .eq("id", contractId).maybeSingle();
  if (!c) return;
  const emp = (Array.isArray(c.employees) ? c.employees[0] : c.employees) as { full_name?: string; email?: string } | null;
  const co = (Array.isArray(c.companies) ? c.companies[0] : c.companies) as { name?: string } | null;
  const sigs = await getSignatures(contractId);
  const doc = await buildContractPdf(c.content as string, sigs);
  const bytes = Buffer.from(doc.output("arraybuffer"));
  const safeName = (emp?.full_name ?? "starfsmadur").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_");
  const dn = docNames(c.title as string);
  const filename = `${dn.ascii}_${safeName}_undirritadur.pdf`;

  const path = `${c.company_id}/${c.employee_id}/${signedPdfPrefix(contractId)}${filename}`;
  const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (!upErr) {
    await admin.from("documents").insert({
      company_id: c.company_id, employee_id: c.employee_id, name: `${dn.label} — undirritaður (kóði í tölvupósti).pdf`, type: dn.type, url: path,
    });
  } else console.error("signed pdf upload", upErr);

  const b64 = bytes.toString("base64");
  const employeeName = emp?.full_name ?? "Starfsmaður";
  const company = co?.name ?? "Vinnuveitandi";
  const employeeEmail = sigs.find((s) => s.role === "employee")?.email ?? emp?.email ?? null;
  if (employeeEmail) await sendSignedContractEmail(employeeEmail, { employeeName, company, pdfBase64: b64, filename, forEmployer: false });
  const { data: owners } = await admin.from("users").select("email").eq("company_id", c.company_id).eq("role", "owner");
  const employerEmail = sigs.find((s) => s.role === "employer")?.email;
  const to = new Set([...(owners ?? []).map((o) => o.email as string | null), employerEmail].filter(Boolean) as string[]);
  for (const addr of to) await sendSignedContractEmail(addr, { employeeName, company, pdfBase64: b64, filename, forEmployer: true });
}

/* ------------------------------------------------------------------------------------------
 * Taktikal (0062): fullgild undirskrift beggja aðila með rafrænum skilríkjum.
 * Vinnuveitandi „Undirrita & senda“ → ferli stofnað hjá Taktikal, vinnuveitandi skrifar
 * fyrst (tengill opnast), starfsmaður fær tölvupóst frá Taktikal og tengil í Mitt svæði.
 * Webhook (/api/taktikal/webhook) skráir hverja undirskrift; við AllSigned er undirritaða
 * PDF-ið frá Taktikal (lagalega skjalið) vistað í skjalasafn og sent báðum.
 * ---------------------------------------------------------------------------------------- */


export async function startTaktikalSigning(
  contractId: string,
  employer: { userId: string; name: string; email: string; ssn: string; phone?: string | null },
): Promise<{ ok: boolean; employerUrl?: string; error?: string }> {
  const admin = createAdminClient();
  const { data: c } = await admin.from("contracts")
    .select("id, company_id, title, content, status, employees(full_name, kennitala, email, phone), companies(name)")
    .eq("id", contractId).maybeSingle();
  if (await demoBlocked(c?.company_id as string | undefined)) return demoResult();
  if (!c || c.status !== "sent") return { ok: false, error: "Samningurinn er ekki í undirritunarferli" };
  const company = ((Array.isArray(c.companies) ? c.companies[0] : c.companies) as { name?: string } | null)?.name?.trim() || "vinnuveitanda";
  const emp = (Array.isArray(c.employees) ? c.employees[0] : c.employees) as { full_name?: string; kennitala?: string; email?: string; phone?: string } | null;
  if (!emp?.kennitala || emp.kennitala.replace(/\D/g, "").length !== 10) return { ok: false, error: "Kennitölu starfsmanns vantar — hún þarf fyrir rafræn skilríki" };
  if (!emp.email) return { ok: false, error: "Netfang starfsmanns vantar — undirritunartengillinn er sendur þangað" };
  if (employer.ssn.replace(/\D/g, "").length !== 10) return { ok: false, error: "Sláðu inn þína kennitölu (10 stafir)" };

  const { data: existing } = await admin.from("contract_taktikal").select("employer_url, status").eq("contract_id", contractId).maybeSingle();
  if (existing && existing.status !== "canceled" && existing.status !== "expired" && existing.status !== "failed") {
    return { ok: true, employerUrl: existing.employer_url as string };
  }

  const doc = await buildContractPdf(c.content as string, [], { stampStrip: true });
  const pdfBase64 = Buffer.from(doc.output("arraybuffer")).toString("base64");
  const safe = (emp.full_name ?? "starfsmadur").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_");
  const proc = await createSigningProcess({
    pdfBase64, fileName: `${docNames(c.title as string).ascii}_${safe}.pdf`, ownerEmail: employer.email, contractId,
    employer: { name: employer.name, ssn: employer.ssn, email: employer.email, phone: employer.phone, reason: `Fyrir hönd: ${company}` },
    employee: { name: emp.full_name ?? "Starfsmaður", ssn: emp.kennitala, email: emp.email, phone: emp.phone },
  });
  await admin.from("contract_taktikal").upsert({
    contract_id: contractId, company_id: c.company_id, process_key: proc.processKey,
    employer_signee_key: proc.employer.key, employee_signee_key: proc.employee.key,
    employer_url: proc.employer.url, employee_url: proc.employee.url, status: "created", updated_at: new Date().toISOString(),
  });
  await admin.from("contracts").update({ content_sha256: sha256(c.content as string), signed_via: "taktikal" }).eq("id", contractId);
  return { ok: true, employerUrl: proc.employer.url };
}

/** Undirritunartengill starfsmanns (aðeins eigin samningur, aðeins þegar vinnuveitandi hefur skrifað undir). */
export async function taktikalEmployeeLink(caller: { userId: string }, contractId: string): Promise<{ ok: boolean; url?: string; waiting?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: emp } = await admin.from("employees").select("id").eq("user_id", caller.userId).maybeSingle();
  const { data: c } = await admin.from("contracts").select("employee_id, status").eq("id", contractId).maybeSingle();
  if (!emp || !c || c.employee_id !== emp.id) return { ok: false, error: "Samningur fannst ekki" };
  const { data: t } = await admin.from("contract_taktikal").select("employee_url, status").eq("contract_id", contractId).maybeSingle();
  if (!t) return { ok: false, error: "Samningurinn er ekki í rafrænni undirritun" };
  if (t.status === "created") return { ok: true, waiting: true };
  if (t.status === "canceled" || t.status === "expired" || t.status === "failed") return { ok: false, error: "Undirritunarferlið rann út — biddu vinnuveitandann að senda samninginn aftur" };
  return { ok: true, url: t.employee_url as string };
}

/** Úrvinnsla sannreynds webhooks frá Taktikal. Skilar false ef ferlið er okkur óþekkt. */
export async function handleTaktikalEvent(p: TaktikalWebhook): Promise<boolean> {
  const ev = p.EventData;
  const terminal = ev.EventType === TAKTIKAL_EVENT.Canceled ? "canceled" : ev.EventType === TAKTIKAL_EVENT.Expired ? "expired" : null;
  const r = await applyTaktikalState(
    { processKey: ev.ProcessKey },
    {
      eventId: p.Id,
      terminal,
      signees: (ev.Signees ?? []).map((s) => ({ key: s.Key, name: s.Name, email: s.Email ?? null, signed: !!s.Signed, signedAt: s.SignedAt || null })),
      signedDocument: ev.SignedDocument ?? null,
    },
  );
  return r.known;
}

type TaktikalChange = "employer_signed" | "employee_signed" | "employee_invited" | "contract_signed" | "pdf_stored" | "canceled" | "expired";

export type TaktikalSyncResult = {
  ok: boolean;
  /** Staða contract_taktikal eftir keyrslu. */
  status?: string;
  /** Hvað breyttist í þessari keyrslu (fyrir skilaboð í viðmóti). */
  changes?: TaktikalChange[];
  skipped?: "throttled" | "final" | "not_taktikal" | "not_configured";
  error?: string;
};

/** Staða sem webhook eða Taktikal-API skilar, á sameiginlegu formi. */
type TaktikalObserved = {
  eventId?: string | null;
  terminal: "canceled" | "expired" | null;
  signees: TaktikalSigneeState[];
  signedDocument?: string | null;
};

const TAKTIKAL_OPEN = ["created", "employer_signed", "employee_signed"];
/** Hlutverk sem staða contract_taktikal segir að séu skráð. */
const rolesOfStatus = (s: string): ("employer" | "employee")[] =>
  s === "all_signed" ? ["employer", "employee"] : s === "employer_signed" ? ["employer"] : s === "employee_signed" ? ["employee"] : [];
/** Viðgerð (skrá sem vantar eftir hrun, PDF sem mistókst) bíður þar til staðan hefur verið kyrr svona lengi. */
const REPAIR_AFTER_MS = 90_000;

/** Sameiginleg stöðuvél fyrir webhook OG samstillingu (sync). Idempotent og örugg við samhliða keyrslur:
 *  - Hver ný undirskrift er STÖÐUBREYTING á contract_taktikal (created → employer_signed → all_signed …),
 *    krafin með compare-and-swap á (status, updated_at). Aðeins sú keyrsla sem vinnur breytinguna skráir
 *    undirskriftina (contract_signatures — reikningsfært per röð), býður starfsmanni og sækir PDF.
 *  - Viðgerð: ef staðan segir „skráð“ en röð/PDF vantar (keyrsla dó á miðri leið eða Taktikal svaraði ekki)
 *    og staðan hefur verið kyrr í REPAIR_AFTER_MS, krefst næsta keyrsla verksins og klárar það. */
async function applyTaktikalState(
  where: { processKey?: string; contractId?: string },
  obs: TaktikalObserved,
  attempt = 0,
): Promise<{ known: boolean; status?: string; changes: TaktikalChange[] }> {
  const admin = createAdminClient();
  const changes: TaktikalChange[] = [];
  const sel = admin.from("contract_taktikal")
    .select("contract_id, company_id, process_key, employer_signee_key, employee_signee_key, status, last_event_id, updated_at");
  const { data: t } = await (where.contractId ? sel.eq("contract_id", where.contractId) : sel.eq("process_key", where.processKey ?? "")).maybeSingle();
  if (!t) return { known: false, changes };
  if (obs.eventId && t.last_event_id === obs.eventId) return { known: true, status: t.status as string, changes }; // sama webhook tvisvar
  const contractId = t.contract_id as string;
  const cur = t.status as string;
  const now = new Date().toISOString();

  const roleOf = (key: string): "employer" | "employee" | null =>
    key && key === t.employer_signee_key ? "employer" : key && key === t.employee_signee_key ? "employee" : null;
  const observed = new Map<"employer" | "employee", TaktikalSigneeState>();
  for (const s of obs.signees) { const r = s.signed ? roleOf(s.key) : null; if (r && !observed.has(r)) observed.set(r, s); }

  const claim = async (patch: Record<string, unknown>) => {
    const { data } = await admin.from("contract_taktikal")
      .update({ ...patch, last_event_id: obs.eventId ?? t.last_event_id, updated_at: now })
      .eq("contract_id", contractId).eq("status", cur).eq("updated_at", t.updated_at as string).select("contract_id");
    return !!data?.length;
  };
  const retry = () => (attempt < 3 ? applyTaktikalState(where, obs, attempt + 1) : Promise.resolve({ known: true, status: cur, changes }));

  // Lokað ferli (afturkallað / útrunnið / mistókst) breytist ekki meir.
  if (!TAKTIKAL_OPEN.includes(cur) && cur !== "all_signed") {
    await claim({});
    return { known: true, status: cur, changes };
  }

  const before = new Set(rolesOfStatus(cur));
  const newRoles = [...observed.keys()].filter((r) => !before.has(r));
  const after = new Set([...before, ...newRoles]);
  const allSigned = after.has("employer") && after.has("employee");
  const terminal = !allSigned && obs.terminal && TAKTIKAL_OPEN.includes(cur) ? obs.terminal : null;

  let toRecord: ("employer" | "employee")[] = [];
  if (terminal) {
    if (!(await claim({ status: terminal }))) return retry();
    changes.push(terminal);
    return { known: true, status: terminal, changes };
  }
  const { data: c } = await admin.from("contracts").select("content, content_sha256, status").eq("id", contractId).maybeSingle();
  const { data: rows } = await admin.from("contract_signatures").select("signer_role").eq("contract_id", contractId).eq("method", "taktikal_qes");
  const have = new Set((rows ?? []).map((r) => r.signer_role as string));
  const status = allSigned ? "all_signed" : after.has("employer") ? "employer_signed" : after.has("employee") ? "employee_signed" : cur;

  if (newRoles.length) {
    // Stöðubreyting: sú keyrsla sem vinnur hana skráir nýju undirskriftirnar.
    if (!(await claim({ status }))) return retry();
    toRecord = newRoles.filter((r) => !have.has(r));
  } else {
    const missingRows = [...before].filter((r) => !have.has(r));
    const pdfMissing = allSigned && !(await signedPdfPath(contractId));
    const contractOpen = allSigned && c?.status !== "signed";
    const stale = Date.now() - new Date(t.updated_at as string).getTime() > REPAIR_AFTER_MS;
    if (!(missingRows.length || pdfMissing || contractOpen) || !stale) {
      // Ekkert að gera (eða önnur keyrsla nýbúin að vinna) — merkja „síðast athugað“.
      if (!(missingRows.length || pdfMissing || contractOpen)) await claim({});
      return { known: true, status: cur, changes };
    }
    if (!(await claim({}))) return retry();
    toRecord = missingRows;
  }

  const hash = (c?.content_sha256 as string | null) ?? sha256((c?.content as string) ?? "");
  for (const role of toRecord) {
    const s = observed.get(role);
    const { error } = await admin.from("contract_signatures").insert({
      contract_id: contractId, company_id: t.company_id, signer_role: role,
      signer_name: s?.name || (role === "employer" ? "Vinnuveitandi" : "Starfsmaður"),
      signer_email: s?.email ?? null, method: "taktikal_qes", doc_sha256: hash, signed_at: s?.signedAt || now,
    });
    if (error) { console.error("taktikal signature insert", error); continue; }
    changes.push(role === "employer" ? "employer_signed" : "employee_signed");
    if (role === "employer") {
      await admin.from("contracts").update({ employer_signed_at: s?.signedAt || now, employer_signed_by: s?.name || null }).eq("id", contractId);
      if (!after.has("employee")) {
        try { await inviteTaktikalEmployee(contractId); changes.push("employee_invited"); } catch (e) { console.error("taktikal invite", e); }
      }
    }
  }

  if (allSigned && c?.status !== "signed") {
    const empSig = observed.get("employee");
    const { data: up } = await admin.from("contracts")
      .update({ status: "signed", signed_at: empSig?.signedAt || now, signed_by_name: empSig?.name || null, signed_via: "taktikal" })
      .eq("id", contractId).neq("status", "signed").select("id");
    if (up?.length) {
      changes.push("contract_signed");
      await admin.from("audit_log").insert({
        company_id: t.company_id, user_id: null, action: "contract.sign", entity: "contract", entity_id: contractId,
        detail: `Samningur undirritaður með rafrænum skilríkjum (Taktikal)${empSig?.name ? ` — ${empSig.name}` : ""}`,
      }).then(() => {}, () => {});
    }
  }

  if (allSigned && !(await signedPdfPath(contractId))) {
    // Lagalega skjalið er PDF-ið frá Taktikal (með þeirra undirskriftum), sótt beint frá API.
    // Varaleið: skjalið sem fylgir sannreyndu AllSigned-webhooki (svo samningurinn glatist ekki).
    let pdf: Buffer | null = null;
    try { pdf = await fetchSignedPdf(t.process_key as string, t.employee_signee_key as string); }
    catch (e) {
      console.error("taktikal fetch pdf", e);
      if (obs.signedDocument) pdf = Buffer.from(obs.signedDocument, "base64");
    }
    if (pdf && pdf.subarray(0, 5).toString() === "%PDF-") {
      try {
        if (await deliverTaktikalCopy(contractId, pdf)) {
          changes.push("pdf_stored");
          await notifyContractEmployee(contractId, "stored"); // aðeins sú keyrsla sem vistaði PDF-ið
        }
      } catch (e) { console.error("taktikal deliver", e); }
    }
  }
  return { known: true, status, changes };
}

/** Sækir stöðu ferlisins frá Taktikal og keyrir sömu stöðuvél og webhookið.
 *  minIntervalMs: sleppt ef athugað var nýlega (sjálfvirk samstilling við opnun). Kallandi athugar aðgang. */
export async function syncTaktikalContract(contractId: string, opts: { minIntervalMs?: number } = {}): Promise<TaktikalSyncResult> {
  const admin = createAdminClient();
  const { data: t } = await admin.from("contract_taktikal")
    .select("contract_id, process_key, employer_signee_key, employee_signee_key, status, created_at, updated_at").eq("contract_id", contractId).maybeSingle();
  if (!t) return { ok: false, skipped: "not_taktikal", error: "Samningurinn er ekki í rafrænni undirritun" };
  const isOpen = TAKTIKAL_OPEN.includes(t.status as string);
  if (!isOpen && !(t.status === "all_signed" && !(await signedPdfPath(contractId)))) return { ok: true, status: t.status as string, skipped: "final", changes: [] };
  if (opts.minIntervalMs && Date.now() - new Date(t.updated_at as string).getTime() < opts.minIntervalMs) return { ok: true, status: t.status as string, skipped: "throttled", changes: [] };
  if (!taktikalConfigured()) return { ok: false, status: t.status as string, skipped: "not_configured", error: "Taktikal er ekki tengt í þessu umhverfi" };
  let state;
  try {
    state = await fetchProcessState(t.process_key as string, {
      createdAt: t.created_at as string,
      signeeKey: (t.employer_signee_key as string | null) ?? (t.employee_signee_key as string | null),
    });
  } catch (e) {
    console.error("taktikal sync", contractId, e);
    // Snerta updated_at svo sjálfvirk samstilling hamri ekki á Taktikal meðan það svarar ekki.
    await admin.from("contract_taktikal").update({ updated_at: new Date().toISOString() }).eq("contract_id", contractId).eq("updated_at", t.updated_at as string);
    return { ok: false, status: t.status as string, error: "Taktikal svaraði ekki — reyndu aftur eftir smástund" };
  }
  const st = state.status ?? "";
  const terminal = st === "canceled" || st === "cancelled" || st === "blocked" ? "canceled" : st === "expired" ? "expired" : null;
  const r = await applyTaktikalState({ contractId }, { terminal, signees: state.signees });
  return { ok: true, status: r.status, changes: r.changes };
}

/** Öll opin Taktikal-ferli (daglegt öryggisnet fyrir webhooks sem misfórust). */
export async function syncOpenTaktikalContracts(limit = 50): Promise<{ checked: number; changed: number; failed: number }> {
  if (!taktikalConfigured()) return { checked: 0, changed: 0, failed: 0 };
  const admin = createAdminClient();
  const since = new Date(Date.now() - 120 * 86400e3).toISOString();
  const { data } = await admin.from("contract_taktikal").select("contract_id, status")
    .in("status", [...TAKTIKAL_OPEN, "all_signed"]).gte("created_at", since).order("updated_at").limit(limit * 4);
  let checked = 0, changed = 0, failed = 0;
  for (const row of data ?? []) {
    if (checked >= limit) break;
    if (row.status === "all_signed" && (await signedPdfPath(row.contract_id as string))) continue;
    checked++;
    const r = await syncTaktikalContract(row.contract_id as string);
    if (!r.ok) failed++;
    else if (r.changes?.length) changed++;
  }
  return { checked, changed, failed };
}

/** Sendir starfsmanni undirritunarboð Taktikal aftur (sama ferli, engin ný undirskrift → enginn nýr kostnaður).
 *  Aðeins þegar vinnuveitandi hefur skrifað undir og ferlið er enn opið. Kallandi athugar aðgang (RLS) fyrst. */
export async function resendTaktikalInvite(contractId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: t } = await createAdminClient().from("contract_taktikal").select("status").eq("contract_id", contractId).maybeSingle();
  if (!t) return { ok: false, error: "Samningurinn er ekki í rafrænni undirritun" };
  if (t.status === "created") return { ok: false, error: "Þú átt eftir að skrifa undir fyrir hönd fyrirtækisins — opnaðu samninginn í Starfsfólk → Samningar." };
  if (t.status === "canceled" || t.status === "expired" || t.status === "failed") return { ok: false, error: "Undirritunarferlið rann út — gerðu nýjan samning í Starfsfólk → Samningar." };
  await inviteTaktikalEmployee(contractId);
  return { ok: true };
}

/** Vinnuveitandi hefur skrifað undir → VAKTO sendir starfsmanni boð (með nafni fyrirtækisins) á undirritunarsíðu Taktikal. */
async function inviteTaktikalEmployee(contractId: string) {
  const admin = createAdminClient();
  const { data: c } = await admin.from("contracts")
    .select("employees(full_name, email), companies(name), contract_taktikal(employee_url)").eq("id", contractId).maybeSingle();
  if (!c) return;
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const emp = one(c.employees as { full_name?: string; email?: string } | null);
  const co = one(c.companies as { name?: string } | null);
  const tk = one(c.contract_taktikal as { employee_url?: string } | null);
  if (emp?.email && tk?.employee_url) await sendTaktikalSignEmail(emp.email, emp.full_name ?? "", co?.name ?? "Vinnuveitandinn þinn", tk.employee_url);
  // Röðin komin að starfsmanni → líka push í appið (kallað aðeins á stöðubreytingunni eða við handvirka endursendingu).
  if (tk?.employee_url) await notifyContractEmployee(contractId, "sign");
}

/** Undirritað PDF fær fast geymslunafn per samning (`<company>/<employee>/<contractId>-…`) svo hægt
 *  sé að finna það aftur út frá samningnum og það vistist aldrei tvisvar. */
const signedPdfPrefix = (contractId: string) => `${contractId}-`;

/** Slóð undirritaðs PDF samnings í skjalasafninu (documents), eða null ef það hefur ekki verið vistað. */
export async function signedPdfPath(contractId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: c } = await admin.from("contracts").select("company_id, employee_id, created_at, status").eq("id", contractId).maybeSingle();
  if (!c) return null;
  const { data } = await admin.from("documents").select("url")
    .eq("company_id", c.company_id).eq("employee_id", c.employee_id)
    .like("url", `${c.company_id}/${c.employee_id}/${signedPdfPrefix(contractId)}%`).limit(1);
  if (data?.[0]?.url) return data[0].url as string;
  // Eldri vistanir (fyrir fast geymslunafn): undirritað samningsskjal starfsmannsins sem varð til eftir samninginn.
  if (c.status !== "signed") return null;
  const { data: legacy } = await admin.from("documents").select("url")
    .eq("company_id", c.company_id).eq("employee_id", c.employee_id).eq("type", "Samningur")
    .ilike("name", "%undirrit%").gte("created_at", c.created_at as string)
    .order("created_at", { ascending: true }).limit(1);
  return (legacy?.[0]?.url as string | undefined) ?? null;
}

/** Vistar undirritaða PDF-ið frá Taktikal í skjalasafn starfsmannsins (einka-fatan `documents` +
 *  documents-röð → Skjöl-flipi stjórnenda, Mitt svæði og appið) og sendir báðum aðilum afrit.
 *  true = vistað núna; false = var þegar til. Kastar ef vistun mistókst (þá reynt aftur í næstu samstillingu). */
async function deliverTaktikalCopy(contractId: string, pdf: Buffer): Promise<boolean> {
  const admin = createAdminClient();
  const { data: c } = await admin.from("contracts")
    .select("company_id, employee_id, title, employees(full_name, email), companies(name)").eq("id", contractId).maybeSingle();
  if (!c) return false;
  if (await signedPdfPath(contractId)) return false;
  const emp = (Array.isArray(c.employees) ? c.employees[0] : c.employees) as { full_name?: string; email?: string } | null;
  const co = (Array.isArray(c.companies) ? c.companies[0] : c.companies) as { name?: string } | null;
  const safe = (emp?.full_name ?? "starfsmadur").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_");
  const dn = docNames(c.title as string);
  const filename = `${dn.ascii}_${safe}_undirritadur.pdf`;
  const path = `${c.company_id}/${c.employee_id}/${signedPdfPrefix(contractId)}${filename}`;
  const { error: upErr } = await admin.storage.from("documents").upload(path, pdf, { contentType: "application/pdf", upsert: false });
  // „Already exists“ = önnur keyrsla vistaði skrána; documents-röðin er þá skráð hér ef hana vantar.
  if (upErr && !/exist|duplicate/i.test(upErr.message)) throw new Error(`taktikal pdf upload: ${upErr.message}`);
  if (await signedPdfPath(contractId)) return false;
  const { error: docErr } = await admin.from("documents").insert({
    company_id: c.company_id, employee_id: c.employee_id, type: dn.type, url: path,
    name: `${dn.label} — undirritaður (Taktikal).pdf`,
  });
  if (docErr) throw new Error(`taktikal pdf document row: ${docErr.message}`);
  const b64 = pdf.toString("base64");
  const employeeName = emp?.full_name ?? "Starfsmaður";
  const company = co?.name ?? "Vinnuveitandi";
  if (emp?.email) await sendSignedContractEmail(emp.email, { employeeName, company, pdfBase64: b64, filename, forEmployer: false });
  const { data: owners } = await admin.from("users").select("email").eq("company_id", c.company_id).eq("role", "owner");
  for (const o of owners ?? []) if (o.email) await sendSignedContractEmail(o.email as string, { employeeName, company, pdfBase64: b64, filename, forEmployer: true });
  return true;
}
