"use server";

// VAKTO super-admin actions — every action re-verifies the email allowlist
// before touching data with the service-role client, and every action is
// written to the target company's audit_log (admin.*-prefixed).

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isVaktoAdmin } from "@/lib/vakto-admin.server";
import { logAudit } from "@/lib/audit";

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

/** Set a company's manual billing status ('auto' clears the override → trial
 *  logic; 'suspended' locks every user of the company out at the proxy). */
export async function setBillingStatus(companyId: string, status: string): Promise<AdminResult> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId || !STATUSES.has(status)) return { ok: false, error: "Ógild staða" };
  try {
    const db = createAdminClient();
    const { error } = await db.from("companies")
      .update({ billing_status: status === "auto" ? null : status })
      .eq("id", companyId);
    if (error) return { ok: false, error: error.message.includes("billing_status") ? "Keyrðu migration 0027" : error.message };
    const me = await adminIdentity();
    await logAudit(db, companyId, me.id, {
      action: status === "suspended" ? "admin.suspend" : "admin.billing",
      entity: "company", entityId: companyId,
      detail: `VAKTO admin (${me.email}) setti greiðslustöðu: ${status}`,
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
    await logAudit(db, companyId, me.id, {
      action: "admin.trial_extend", entity: "company", entityId: companyId,
      detail: `VAKTO admin (${me.email}) framlengdi prufu um ${days} daga`,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Support sign-in: a one-time magic link for a specific user of a company.
 *  Opening it REPLACES the admin's session with the target user's session
 *  (log out and back in to return). Always audit-logged on the company. */
export async function impersonateUser(companyId: string, userId: string): Promise<AdminResult & { link?: string; email?: string }> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId || !userId) return { ok: false, error: "Notanda vantar" };
  try {
    const db = createAdminClient();
    const { data: u } = await db.from("users").select("email, company_id").eq("id", userId).maybeSingle();
    if (!u?.email || u.company_id !== companyId) return { ok: false, error: "Notandi fannst ekki í þessu fyrirtæki" };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: u.email as string,
      options: { redirectTo: appUrl },
    });
    const link = data?.properties?.action_link;
    if (error || !link) return { ok: false, error: error?.message ?? "Gat ekki búið til hlekk" };
    const me = await adminIdentity();
    await logAudit(db, companyId, me.id, {
      action: "admin.impersonate", entity: "user", entityId: userId,
      detail: `VAKTO admin (${me.email}) skráði sig inn sem ${u.email} (stuðningur)`,
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

/** Company drill-down for the support panel (server-fetch from the client). */
export async function fetchCompanyDetail(companyId: string) {
  const { getCompanyDetail } = await import("@/lib/vakto-admin.server");
  return getCompanyDetail(companyId);
}