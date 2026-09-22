"use server";

// VAKTO super-admin actions — every action re-verifies the email allowlist
// before touching data with the service-role client, and every action is
// written BOTH to the target company's audit_log (admin.*-prefixed, visible to
// the tenant's owner) and to platform_audit (0047 — the owner's own trail).

import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isVaktoAdmin, isAdminEmail, logPlatform,
  IMPERSONATION_COOKIE, IMPERSONATION_UI_COOKIE, IMPERSONATION_MAX_AGE,
} from "@/lib/vakto-admin.server";
import { logAudit } from "@/lib/audit";
import { sendResetEmail, emailConfigured } from "@/lib/email";

export type AdminResult = { ok: boolean; error?: string };

const STATUSES = new Set(["paying", "unpaid", "free", "suspended", "auto"]);

async function adminIdentity(): Promise<{ id: string | null; email: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { id: user?.id ?? null, email: user?.email ?? "admin" };
  } catch {
    return { id: null, email: "admin" };
  }
}

/* ---------- host / cookie helpers ----------
   Production runs the platform on admin.vakto.is and the customer app on
   vakto.is (separate session cookies). Local/preview runs both on one host.
   Cookies that must be visible on both get domain=.vakto.is in production. */
async function hostInfo() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").toLowerCase().split(",")[0].trim();
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const onAdminHost = host.startsWith("admin.");
  const bare = host.replace(/^(www|admin)\./, "");
  const isVakto = bare === "vakto.is";
  // Where the customer app lives / where the platform lives, as seen from here.
  const appOrigin = onAdminHost ? `${proto}://${bare}` : origin;
  const adminOrigin = isVakto ? `${proto}://admin.vakto.is` : origin;
  return { origin, appOrigin, adminOrigin, cookieDomain: isVakto ? ".vakto.is" : undefined, secure: proto === "https" };
}

function signingKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VAKTO_ADMIN_EMAILS || "vakto";
}
function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}
type ImpersonationState = { adminEmail: string; companyName: string; companyId: string; userEmail: string; at: string };
function encodeState(s: ImpersonationState): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body)}`;
}
function decodeState(raw: string | undefined): ImpersonationState | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = sign(body);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ImpersonationState;
    if (!s?.adminEmail || !s.at) return null;
    if (Date.now() - new Date(s.at).getTime() > IMPERSONATION_MAX_AGE * 1000) return null;
    return s;
  } catch {
    return null;
  }
}
async function setImpersonationCookies(s: ImpersonationState) {
  const { cookieDomain, secure } = await hostInfo();
  const jar = await cookies();
  const base = { path: "/", maxAge: IMPERSONATION_MAX_AGE, sameSite: "lax" as const, secure, domain: cookieDomain };
  jar.set(IMPERSONATION_COOKIE, encodeState(s), { ...base, httpOnly: true });
  jar.set(IMPERSONATION_UI_COOKIE, `1|${s.companyName}`, { ...base, httpOnly: false });
}
async function clearImpersonationCookies() {
  const { cookieDomain, secure } = await hostInfo();
  const jar = await cookies();
  // Same domain/path they were set with (ResponseCookies keys by name — one clear per cookie).
  for (const name of [IMPERSONATION_COOKIE, IMPERSONATION_UI_COOKIE]) {
    jar.set(name, "", { path: "/", maxAge: 0, sameSite: "lax", secure, domain: cookieDomain });
  }
}

/* ---------- billing ---------- */

/** Set a company's manual billing status ('auto' clears the override → trial
 *  logic; 'suspended' locks every user of the company out at the proxy). */
export async function setBillingStatus(companyId: string, status: string): Promise<AdminResult> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId || !STATUSES.has(status)) return { ok: false, error: "Ógild staða" };
  try {
    const db = createAdminClient();
    const { data: before } = await db.from("companies").select("name, billing_status").eq("id", companyId).maybeSingle();
    const { error } = await db.from("companies")
      .update({ billing_status: status === "auto" ? null : status, ...(status === "auto" ? {} : { card_required: false }) })
      .eq("id", companyId);
    if (error) return { ok: false, error: error.message.includes("billing_status") ? "Keyrðu migration 0027" : error.message };
    const me = await adminIdentity();
    const wasSuspended = before?.billing_status === "suspended";
    const action = status === "suspended" ? "suspend" : wasSuspended ? "unsuspend" : "billing.set";
    await logAudit(db, companyId, me.id, {
      action: status === "suspended" ? "admin.suspend" : "admin.billing",
      entity: "company", entityId: companyId,
      detail: `VAKTO admin (${me.email}) setti greiðslustöðu: ${status}`,
    });
    await logPlatform(db, {
      adminEmail: me.email, action, companyId, target: before?.name ?? null,
      detail: `Greiðslustaða: ${before?.billing_status ?? "sjálfvirkt"} → ${status === "auto" ? "sjálfvirkt" : status}`,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Extend (or start) a company's trial by N days from now. */
export async function extendTrial(companyId: string, days = 14): Promise<AdminResult> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId) return { ok: false, error: "Fyrirtæki vantar" };
  try {
    const db = createAdminClient();
    const ends = new Date(Date.now() + days * 86400000).toISOString();
    let { error } = await db.from("companies")
      .update({ trial_ends_at: ends, billing_status: null })
      .eq("id", companyId);
    // billing_status column arrives with 0027 — extend the trial regardless.
    if (error && error.message.includes("billing_status")) {
      ({ error } = await db.from("companies").update({ trial_ends_at: ends }).eq("id", companyId));
    }
    if (error) return { ok: false, error: error.message };
    const me = await adminIdentity();
    const { data: co } = await db.from("companies").select("name").eq("id", companyId).maybeSingle();
    await logAudit(db, companyId, me.id, {
      action: "admin.trial_extend", entity: "company", entityId: companyId,
      detail: `VAKTO admin (${me.email}) framlengdi prufu um ${days} daga`,
    });
    await logPlatform(db, {
      adminEmail: me.email, action: "trial.extend", companyId, target: co?.name ?? null,
      detail: `Prufa framlengd um ${days} daga — til ${ends.slice(0, 10)}`,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Save the admin's free-text note on a company (companies.admin_note, 0047). */
export async function saveAdminNote(companyId: string, note: string): Promise<AdminResult> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId) return { ok: false, error: "Fyrirtæki vantar" };
  const text = (note ?? "").trim().slice(0, 4000);
  try {
    const db = createAdminClient();
    const { error } = await db.from("companies").update({ admin_note: text || null }).eq("id", companyId);
    if (error) return { ok: false, error: error.message.includes("admin_note") ? "Keyrðu migration 0047" : error.message };
    const me = await adminIdentity();
    const { data: co } = await db.from("companies").select("name").eq("id", companyId).maybeSingle();
    await logPlatform(db, {
      adminEmail: me.email, action: "note.save", companyId, target: co?.name ?? null,
      detail: text ? text.slice(0, 200) : "(athugasemd hreinsuð)",
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/* ---------- getting people into their system ---------- */

/** Email a one-time sign-in link to a user (magic link → /nytt-lykilord, which
 *  verifies the token_hash and lets them choose a password). Returns the link
 *  too, so the admin can copy it when email isn't configured or didn't arrive. */
export async function sendLoginLink(companyId: string, userId: string): Promise<AdminResult & { link?: string; emailed?: boolean; email?: string }> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId || !userId) return { ok: false, error: "Notanda vantar" };
  try {
    const db = createAdminClient();
    const { data: u } = await db.from("users").select("email, company_id").eq("id", userId).maybeSingle();
    if (!u?.email || u.company_id !== companyId) return { ok: false, error: "Notandi fannst ekki í þessu fyrirtæki" };
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: u.email as string });
    const hash = data?.properties?.hashed_token;
    if (error || !hash) return { ok: false, error: error?.message ?? "Gat ekki búið til hlekk" };
    const { appOrigin } = await hostInfo();
    const link = `${appOrigin}/nytt-lykilord?token_hash=${encodeURIComponent(hash)}&type=magiclink`;
    let emailed = false;
    if (emailConfigured()) {
      const r = await sendResetEmail(u.email as string, link);
      emailed = r.ok && !r.skipped;
    }
    const me = await adminIdentity();
    const { data: co } = await db.from("companies").select("name").eq("id", companyId).maybeSingle();
    await logAudit(db, companyId, me.id, {
      action: "admin.login_link", entity: "user", entityId: userId,
      detail: `VAKTO admin (${me.email}) sendi innskráningarhlekk á ${u.email}`,
    });
    await logPlatform(db, {
      adminEmail: me.email, action: "login_link.send", companyId, target: u.email as string,
      detail: `${co?.name ?? ""} — innskráningarhlekkur ${emailed ? "sendur með tölvupósti" : "búinn til (ekki sendur — afritaðu)"}`,
    });
    return { ok: true, link, emailed, email: u.email as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/* ---------- impersonation (support sign-in) ----------
   generateLink's action_link lands with an implicit "#access_token" fragment,
   which the app's PKCE browser client rejects — so we use the hashed_token and
   verify it ourselves (verifyOtp), exactly like /nytt-lykilord does:
   - same host (local/preview): /admin/enter?token_hash=…  (page in this folder)
   - cross host (admin.vakto.is → vakto.is): /auth/callback?token_hash=… — the
     callback must accept token_hash (server-side verifyOtp) for this to work.
   The signed httpOnly cookie remembers who the admin is so the orange bar in
   the customer app can bring them back with endImpersonation(). */
export async function impersonateUser(companyId: string, userId: string): Promise<AdminResult & { link?: string; email?: string }> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId || !userId) return { ok: false, error: "Notanda vantar" };
  try {
    const db = createAdminClient();
    const [{ data: u }, { data: co }] = await Promise.all([
      db.from("users").select("email, company_id").eq("id", userId).maybeSingle(),
      db.from("companies").select("name").eq("id", companyId).maybeSingle(),
    ]);
    if (!u?.email || u.company_id !== companyId) return { ok: false, error: "Notandi fannst ekki í þessu fyrirtæki" };
    const me = await adminIdentity();
    if (!isAdminEmail(me.email)) return { ok: false, error: "Aðgangi hafnað" };
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: u.email as string });
    const hash = data?.properties?.hashed_token;
    if (error || !hash) return { ok: false, error: error?.message ?? "Gat ekki búið til hlekk" };

    const { origin, appOrigin } = await hostInfo();
    const q = `token_hash=${encodeURIComponent(hash)}&type=magiclink&next=${encodeURIComponent("/maelabord")}`;
    const link = appOrigin === origin ? `${origin}/admin/enter?${q}` : `${appOrigin}/auth/callback?${q}`;

    await setImpersonationCookies({
      adminEmail: me.email, companyName: co?.name ?? "fyrirtæki", companyId,
      userEmail: u.email as string, at: new Date().toISOString(),
    });
    await logAudit(db, companyId, me.id, {
      action: "admin.impersonate", entity: "user", entityId: userId,
      detail: `VAKTO admin (${me.email}) skráði sig inn sem ${u.email} (stuðningur)`,
    });
    await logPlatform(db, {
      adminEmail: me.email, action: "impersonate.start", companyId, target: u.email as string,
      detail: `Skráði sig inn sem ${u.email} hjá ${co?.name ?? "fyrirtæki"}`,
    });
    return { ok: true, link, email: u.email as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Convenience: impersonate the company's owner (first owner-role user). */
export async function impersonateCompanyOwner(companyId: string): Promise<AdminResult & { link?: string; email?: string }> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  try {
    const db = createAdminClient();
    const { data: owner } = await db.from("users")
      .select("id").eq("company_id", companyId).eq("role", "owner").order("created_at").limit(1).maybeSingle();
    if (!owner) return { ok: false, error: "Enginn eigandi fannst" };
    return impersonateUser(companyId, owner.id as string);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** "Aftur í VAKTO Admin" — called from the customer app while impersonating.
 *  Trusts ONLY the signed httpOnly cookie (the current session is the
 *  customer's), mints a magic link for the admin email (must be allowlisted),
 *  clears both cookies and redirects to /admin/return which verifies it. */
export async function endImpersonation(): Promise<AdminResult> {
  const jar = await cookies();
  const state = decodeState(jar.get(IMPERSONATION_COOKIE)?.value);
  if (!state || !isAdminEmail(state.adminEmail)) {
    await clearImpersonationCookies();
    return { ok: false, error: "Engin virk stuðningsinnskráning fannst — skráðu þig inn á admin.vakto.is" };
  }
  let target: string;
  try {
    const db = createAdminClient();
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: state.adminEmail });
    const hash = data?.properties?.hashed_token;
    if (error || !hash) return { ok: false, error: error?.message ?? "Gat ekki búið til hlekk til baka" };

    await logPlatform(db, {
      adminEmail: state.adminEmail, action: "impersonate.end", companyId: state.companyId, target: state.userEmail,
      detail: `Aftur í VAKTO Admin úr ${state.companyName}`,
    });
    if (state.companyId) {
      await logAudit(db, state.companyId, null, {
        action: "admin.impersonate_end", entity: "user",
        detail: `VAKTO admin (${state.adminEmail}) lauk stuðningsinnskráningu sem ${state.userEmail}`,
      });
    }

    const { origin, adminOrigin } = await hostInfo();
    if (adminOrigin !== origin) {
      // Separate hosts: the admin session on admin.vakto.is is untouched — end
      // the customer session here so it doesn't linger in the admin's browser.
      try { const supabase = await createClient(); await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    await clearImpersonationCookies();
    target = `${adminOrigin}/admin/return?token_hash=${encodeURIComponent(hash)}`;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
  redirect(target);
}

/** Company drill-down for the support panel (server-fetch from the client). */
export async function fetchCompanyDetail(companyId: string) {
  const { getCompanyDetail } = await import("@/lib/vakto-admin.server");
  return getCompanyDetail(companyId);
}
