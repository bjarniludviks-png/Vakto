import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVerificationCodeEmail } from "@/lib/email";

// Staðfesting netfangs við nýskráningu: 6 stafa kóði í pósti (Resend), hakkaður í
// email_verifications (0053). Kóðinn gildir í 15 mín, 5 tilraunir, hámark 3 sendingar
// á 10 mín per netfang. Rétt kóði → „proof“-token sem createOwnerAccount framvísar.

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_10MIN = 3;
const PROOF_TTL_MIN = 30;

const norm = (e: string) => e.trim().toLowerCase();
const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");

export type CodeResult = { ok: boolean; error?: string; retryAfterSec?: number };

export async function requestEmailCode(emailRaw: string): Promise<CodeResult> {
  const email = norm(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Netfangið lítur ekki rétt út" };
  const admin = createAdminClient();

  // Þegar skráð netfang → segjum það beint (nýskráning, ekki innskráning, svo þetta lekur engu sem skiptir máli).
  const { data: existing } = await admin.from("users").select("id").ilike("email", email).limit(1).maybeSingle();
  if (existing) return { ok: false, error: "Netfangið er þegar skráð — skráðu þig inn eða notaðu „Gleymt lykilorð?“" };

  const since = new Date(Date.now() - 10 * 60000).toISOString();
  const { count } = await admin.from("email_verifications").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= MAX_SENDS_PER_10MIN) return { ok: false, error: "Of margir kóðar sendir — reyndu aftur eftir nokkrar mínútur.", retryAfterSec: 600 };

  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const { error } = await admin.from("email_verifications").insert({
    email, code_hash: hashCode(email, code),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  const sent = await sendVerificationCodeEmail(email, code);
  if (!sent.ok) return { ok: false, error: "Tókst ekki að senda póstinn — reyndu aftur." };
  return { ok: true };
}

export type VerifyResult = { ok: boolean; proof?: string; error?: string };

export async function verifyEmailCode(emailRaw: string, codeRaw: string): Promise<VerifyResult> {
  const email = norm(emailRaw);
  const code = (codeRaw ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Kóðinn er 6 tölustafir" };
  const admin = createAdminClient();
  const { data: row } = await admin.from("email_verifications")
    .select("id, code_hash, attempts, expires_at, verified_at")
    .eq("email", email).is("verified_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row) return { ok: false, error: "Enginn kóði í gildi — sendu nýjan." };
  if (new Date(row.expires_at as string) < new Date()) return { ok: false, error: "Kóðinn er útrunninn — sendu nýjan." };
  if ((row.attempts as number) >= MAX_ATTEMPTS) return { ok: false, error: "Of margar tilraunir — sendu nýjan kóða." };

  const a = Buffer.from(row.code_hash as string, "hex"), b = Buffer.from(hashCode(email, code), "hex");
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    await admin.from("email_verifications").update({ attempts: (row.attempts as number) + 1 }).eq("id", row.id);
    const left = MAX_ATTEMPTS - (row.attempts as number) - 1;
    return { ok: false, error: left > 0 ? `Rangur kóði — ${left} tilraun${left === 1 ? "" : "ir"} eftir.` : "Rangur kóði — sendu nýjan." };
  }
  const proof = randomBytes(24).toString("base64url");
  await admin.from("email_verifications").update({ verified_at: new Date().toISOString(), proof }).eq("id", row.id);
  return { ok: true, proof };
}

/** Notar sönnunina (einu sinni). Skilar true ef netfangið var staðfest fyrir < 30 mín. */
export async function consumeProof(emailRaw: string, proof: string | undefined): Promise<boolean> {
  if (!proof) return false;
  const email = norm(emailRaw);
  const admin = createAdminClient();
  const since = new Date(Date.now() - PROOF_TTL_MIN * 60000).toISOString();
  const { data: row } = await admin.from("email_verifications")
    .select("id").eq("email", email).eq("proof", proof).gte("verified_at", since).limit(1).maybeSingle();
  if (!row) return false;
  // Þrif: allar raðir fyrir netfangið (sönnunin er einnota).
  await admin.from("email_verifications").delete().eq("email", email);
  return true;
}
