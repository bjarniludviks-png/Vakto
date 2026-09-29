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
import { sendContractCodeEmail, sendSignedContractEmail } from "@/lib/email";
import { buildContractPdf, type SignatureRecord } from "@/lib/contract-pdf";

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
