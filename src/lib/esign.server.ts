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
import { sendContractCodeEmail, sendSignedContractEmail, sendTaktikalSignEmail } from "@/lib/email";
import { buildContractPdf, type SignatureRecord } from "@/lib/contract-pdf";
import { createSigningProcess, fetchSignedPdf, TAKTIKAL_EVENT, type TaktikalWebhook } from "@/lib/taktikal.server";

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
    detail: `Ráðningarsamningur undirritaður rafrænt (kóði á netfang) — ${name}`,
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
  const filename = `Radningarsamningur_${safeName}_undirritadur.pdf`;

  const path = `${c.company_id}/${c.employee_id}/${Date.now()}-${filename}`;
  const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (!upErr) {
    await admin.from("documents").insert({
      company_id: c.company_id, employee_id: c.employee_id, name: "Ráðningarsamningur (undirritaður).pdf", type: "Samningur", url: path,
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
    pdfBase64, fileName: `Radningarsamningur_${safe}.pdf`, ownerEmail: employer.email, contractId,
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
  const admin = createAdminClient();
  const ev = p.EventData;
  const { data: t } = await admin.from("contract_taktikal")
    .select("contract_id, company_id, process_key, employer_signee_key, employee_signee_key, status, last_event_id")
    .eq("process_key", ev.ProcessKey).maybeSingle();
  if (!t) return false;
  if (t.last_event_id === p.Id) return true; // sama webhook tvisvar
  const now = new Date().toISOString();
  const { data: c } = await admin.from("contracts").select("content, content_sha256, status").eq("id", t.contract_id).maybeSingle();
  const hash = (c?.content_sha256 as string | null) ?? sha256((c?.content as string) ?? "");

  if (ev.EventType === TAKTIKAL_EVENT.Canceled || ev.EventType === TAKTIKAL_EVENT.Expired) {
    await admin.from("contract_taktikal").update({ status: ev.EventType === TAKTIKAL_EVENT.Canceled ? "canceled" : "expired", last_event_id: p.Id, updated_at: now }).eq("contract_id", t.contract_id);
    return true;
  }

  // Skrá hverja nýja undirskrift (einu sinni per hlutverk).
  const { data: existing } = await admin.from("contract_signatures").select("signer_role").eq("contract_id", t.contract_id).eq("method", "taktikal_qes");
  const have = new Set((existing ?? []).map((r) => r.signer_role as string));
  for (const s of ev.Signees ?? []) {
    if (!s.Signed) continue;
    const role = s.Key === t.employer_signee_key ? "employer" : s.Key === t.employee_signee_key ? "employee" : null;
    if (!role || have.has(role)) continue;
    await admin.from("contract_signatures").insert({
      contract_id: t.contract_id, company_id: t.company_id, signer_role: role, signer_name: s.Name,
      signer_email: s.Email ?? null, method: "taktikal_qes", doc_sha256: hash, signed_at: s.SignedAt || now,
    });
    have.add(role);
    if (role === "employer") {
      await admin.from("contracts").update({ employer_signed_at: s.SignedAt || now, employer_signed_by: s.Name }).eq("id", t.contract_id);
      if (!have.has("employee")) { try { await inviteTaktikalEmployee(t.contract_id as string); } catch (e) { console.error("taktikal invite", e); } }
    }
  }

  const allSigned = have.has("employer") && have.has("employee");
  const status = allSigned ? "all_signed" : have.has("employer") ? "employer_signed" : have.has("employee") ? "employee_signed" : t.status;
  await admin.from("contract_taktikal").update({ status, last_event_id: p.Id, updated_at: now }).eq("contract_id", t.contract_id);

  if (allSigned && c?.status !== "signed") {
    const empSig = (ev.Signees ?? []).find((s) => s.Key === t.employee_signee_key);
    await admin.from("contracts").update({ status: "signed", signed_at: empSig?.SignedAt || now, signed_by_name: empSig?.Name ?? null, signed_via: "taktikal" }).eq("id", t.contract_id);
    // Lagalega skjalið er PDF-ið frá Taktikal (með þeirra undirskriftum). Sótt beint frá API,
    // ekki tekið úr webhook-sendingunni.
    let pdf: Buffer | null = null;
    try { pdf = await fetchSignedPdf(t.process_key as string, t.employee_signee_key as string); }
    catch (e) {
      console.error("taktikal fetch pdf", e);
      // Varaleið: skjalið sem fylgir sannreyndu AllSigned-webhooki (svo samningurinn glatist ekki).
      if (ev.SignedDocument) pdf = Buffer.from(ev.SignedDocument, "base64");
    }
    if (pdf && pdf.subarray(0, 5).toString() === "%PDF-") {
      try { await deliverTaktikalCopy(t.contract_id as string, pdf); } catch (e) { console.error("taktikal deliver", e); }
    }
  }
  return true;
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
}

async function deliverTaktikalCopy(contractId: string, pdf: Buffer) {
  const admin = createAdminClient();
  const { data: c } = await admin.from("contracts")
    .select("company_id, employee_id, employees(full_name, email), companies(name)").eq("id", contractId).maybeSingle();
  if (!c) return;
  const emp = (Array.isArray(c.employees) ? c.employees[0] : c.employees) as { full_name?: string; email?: string } | null;
  const co = (Array.isArray(c.companies) ? c.companies[0] : c.companies) as { name?: string } | null;
  const safe = (emp?.full_name ?? "starfsmadur").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_");
  const filename = `Radningarsamningur_${safe}_undirritadur.pdf`;
  const path = `${c.company_id}/${c.employee_id}/${Date.now()}-${filename}`;
  const { error: upErr } = await admin.storage.from("documents").upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (!upErr) {
    await admin.from("documents").insert({ company_id: c.company_id, employee_id: c.employee_id, name: "Ráðningarsamningur (undirritaður með rafrænum skilríkjum).pdf", type: "Samningur", url: path });
  } else console.error("taktikal pdf upload", upErr);
  const b64 = pdf.toString("base64");
  const employeeName = emp?.full_name ?? "Starfsmaður";
  const company = co?.name ?? "Vinnuveitandi";
  if (emp?.email) await sendSignedContractEmail(emp.email, { employeeName, company, pdfBase64: b64, filename, forEmployer: false });
  const { data: owners } = await admin.from("users").select("email").eq("company_id", c.company_id).eq("role", "owner");
  for (const o of owners ?? []) if (o.email) await sendSignedContractEmail(o.email as string, { employeeName, company, pdfBase64: b64, filename, forEmployer: true });
}
