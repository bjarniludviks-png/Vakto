import "server-only";
// VAKTO super-admin (the SaaS owner's view over ALL companies) — strictly
// gated by email allowlist, then reads with the service-role client since the
// data spans every tenant. Never expose any of this through normal RLS paths.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Comma-separated allowlist; defaults to the founder's account.
const ADMIN_EMAILS = (process.env.VAKTO_ADMIN_EMAILS || "bjarniludviks@icloud.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Is this email on the VAKTO admin allowlist? (pure check — no session) */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Impersonation cookies (set by impersonateUser, cleared by endImpersonation).
 *  The httpOnly one is HMAC-signed and verified server-side; the "-ui" one is
 *  readable by the app shell's ImpersonationBar only for display. */
export const IMPERSONATION_COOKIE = "vakto-impersonating";
export const IMPERSONATION_UI_COOKIE = "vakto-impersonating-ui";
export const IMPERSONATION_MAX_AGE = 8 * 3600; // seconds

// VAKTO pricing (same as the signup + Settings subscription card).
export const PLAN_BASE = 9990;        // kr/mán m/VSK, 5 notendur innifaldir
export const PLAN_INCLUDED_USERS = 5;
export const PLAN_EXTRA_USER = 990;   // kr/mán per notanda umfram

export type BillingStatus = "paying" | "trial" | "trial_expired" | "unpaid" | "free" | "suspended" | "none";
export type AdminCompany = {
  id: string;
  name: string;
  kennitala: string | null;
  country: string;
  createdAt: string;          // ISO
  users: number;
  employees: number;
  locations: number;
  lastActivity: string | null; // ISO of latest punch/audit
  plan: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null; // negative = expired N days ago; null = no trial date
  billingStatus: BillingStatus;
  manualStatus: string | null; // raw billing_status column (admin override)
  mrr: number;                 // kr/mán this company contributes (0 unless paying)
  adminNote: string | null;    // companies.admin_note (0047)
  hasPunches30d: boolean;      // signup health: has anyone clocked in?
  hasRevenue30d: boolean;      // signup health: any revenue rows?
};
export type PlatformAuditEntry = {
  id: string;
  adminEmail: string;
  action: string;
  companyId: string | null;
  companyName: string | null;
  target: string | null;
  detail: string | null;
  at: string;
};
export type AdminOverview = {
  ok: boolean;
  needsMigration?: boolean;        // 0027 (billing_status) missing
  needsPlatformMigration?: boolean; // 0047 (platform_audit / admin_note) missing
  companies: AdminCompany[];
  platformAudit: PlatformAuditEntry[];
  totals: {
    companies: number; users: number; employees: number; paying: number; trials: number;
    trialsEnding7d: number; expired: number; mrr: number;
  };
};

const EMPTY: AdminOverview = {
  ok: false, companies: [], platformAudit: [],
  totals: { companies: 0, users: 0, employees: 0, paying: 0, trials: 0, trialsEnding7d: 0, expired: 0, mrr: 0 },
};

/** Is the signed-in user allowed into /admin? (email allowlist) */
export async function isVaktoAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return isAdminEmail(user?.email);
  } catch {
    return false;
  }
}

/** Platform audit write (0047). Best effort — never throws, never blocks the action. */
export async function logPlatform(
  db: SupabaseClient,
  e: { adminEmail: string; action: string; companyId?: string | null; target?: string | null; detail?: string | null },
): Promise<void> {
  try {
    const { error } = await db.from("platform_audit").insert({
      admin_email: e.adminEmail,
      action: e.action,
      company_id: e.companyId ?? null,
      target: e.target ?? null,
      detail: e.detail ?? null,
    });
    if (error) console.error("[platform_audit] write failed:", error.message);
  } catch (err) {
    console.error("[platform_audit] write failed:", err);
  }
}

// STRIPE HOOK: when Stripe billing lands, resolve subscription state here —
// read the company's stripe_customer/subscription (new table or column) and
// let an active Stripe subscription mean "paying" before the manual override.
// The webhook should write billing_status = 'paying'/'unpaid' so everything
// below (MRR, gating, badges) keeps working unchanged.
function deriveStatus(manual: string | null, trialEndsAt: string | null, plan: string | null): BillingStatus {
  if (manual === "paying" || manual === "unpaid" || manual === "free" || manual === "suspended") return manual;
  if (trialEndsAt) return new Date(trialEndsAt).getTime() > Date.now() ? "trial" : "trial_expired";
  return plan ? "trial_expired" : "none";
}

function mrrOf(status: BillingStatus, users: number): number {
  if (status !== "paying") return 0;
  return PLAN_BASE + Math.max(0, users - PLAN_INCLUDED_USERS) * PLAN_EXTRA_USER;
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const t = new Date(trialEndsAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

function mapPlatformRows(rows: Record<string, unknown>[] | null, names: Map<string, string>): PlatformAuditEntry[] {
  return (rows ?? []).map((r) => {
    const cid = r.company_id ? String(r.company_id) : null;
    return {
      id: String(r.id),
      adminEmail: String(r.admin_email ?? ""),
      action: String(r.action ?? ""),
      companyId: cid,
      companyName: cid ? (names.get(cid) ?? null) : null,
      target: (r.target as string) ?? null,
      detail: (r.detail as string) ?? null,
      at: String(r.at ?? ""),
    };
  });
}

/** Every company + usage + billing status + MRR + last 50 platform actions.
 *  Caller MUST have passed isVaktoAdmin(). */
export async function getAdminOverview(): Promise<AdminOverview> {
  if (!(await isVaktoAdmin())) return EMPTY;
  try {
    const db = createAdminClient();

    // billing_status (0027) and admin_note (0047) arrive with migrations — stay tolerant before them.
    let needsMigration = false;
    let needsPlatformMigration = false;
    let comps = await db.from("companies")
      .select("id, name, kennitala, country, created_at, plan, trial_ends_at, billing_status, admin_note")
      .order("created_at", { ascending: true });
    if (comps.error) {
      needsPlatformMigration = true;
      comps = await db.from("companies")
        .select("id, name, kennitala, country, created_at, plan, trial_ends_at, billing_status")
        .order("created_at", { ascending: true }) as typeof comps;
    }
    if (comps.error) {
      needsMigration = true;
      comps = await db.from("companies")
        .select("id, name, kennitala, country, created_at, plan, trial_ends_at")
        .order("created_at", { ascending: true }) as typeof comps;
    }
    const rows = (comps.data ?? []) as Record<string, unknown>[];
    const month = new Date(Date.now() - 30 * 86400000);
    const monthIso = month.toISOString();
    const monthDate = monthIso.slice(0, 10);

    const [usersRes, empRes, locRes, punchRes, auditRes, revRes, platRes] = await Promise.all([
      db.from("users").select("company_id"),
      db.from("employees").select("company_id"),
      db.from("locations").select("id, company_id"),
      db.from("punches").select("company_id, clock_in").order("clock_in", { ascending: false }).limit(2000),
      db.from("audit_log").select("company_id, created_at").order("created_at", { ascending: false }).limit(2000),
      db.from("revenue").select("location_id").gte("date", monthDate).limit(5000),
      db.from("platform_audit").select("id, admin_email, action, company_id, target, detail, at").order("at", { ascending: false }).limit(50),
    ]);
    if (platRes.error) needsPlatformMigration = true;

    const countBy = (list: { company_id?: unknown }[] | null) => {
      const m = new Map<string, number>();
      for (const r of list ?? []) { const k = String(r.company_id); m.set(k, (m.get(k) ?? 0) + 1); }
      return m;
    };
    const users = countBy(usersRes.data);
    const emps = countBy(empRes.data);
    const locs = countBy(locRes.data);
    const locCompany = new Map<string, string>();
    for (const l of locRes.data ?? []) locCompany.set(String(l.id), String(l.company_id));
    const revenueCompanies = new Set<string>();
    for (const r of revRes.data ?? []) {
      const cid = locCompany.get(String(r.location_id));
      if (cid) revenueCompanies.add(cid);
    }
    const lastAct = new Map<string, string>();
    const punched30d = new Set<string>();
    for (const p of punchRes.data ?? []) {
      const k = String(p.company_id);
      const t = String(p.clock_in);
      if (!lastAct.has(k)) lastAct.set(k, t);
      if (t >= monthIso) punched30d.add(k);
    }
    for (const a of auditRes.data ?? []) {
      const k = String(a.company_id);
      const t = String(a.created_at);
      if (!lastAct.has(k) || t > lastAct.get(k)!) lastAct.set(k, t);
    }

    const names = new Map<string, string>();
    const companies: AdminCompany[] = rows.map((c) => {
      const id = String(c.id);
      names.set(id, String(c.name ?? "—"));
      const u = users.get(id) ?? 0;
      const manual = (c.billing_status as string) ?? null;
      const trialEndsAt = (c.trial_ends_at as string) ?? null;
      const status = deriveStatus(manual, trialEndsAt, (c.plan as string) ?? null);
      return {
        id,
        name: String(c.name ?? "—"),
        kennitala: (c.kennitala as string) ?? null,
        country: String(c.country ?? "IS"),
        createdAt: String(c.created_at ?? ""),
        users: u,
        employees: emps.get(id) ?? 0,
        locations: locs.get(id) ?? 0,
        lastActivity: lastAct.get(id) ?? null,
        plan: (c.plan as string) ?? null,
        trialEndsAt,
        trialDaysLeft: daysLeft(trialEndsAt),
        billingStatus: status,
        manualStatus: manual,
        mrr: mrrOf(status, u),
        adminNote: (c.admin_note as string) ?? null,
        hasPunches30d: punched30d.has(id),
        hasRevenue30d: revenueCompanies.has(id),
      };
    });

    const totals = {
      companies: companies.length,
      users: [...users.values()].reduce((a, b) => a + b, 0),
      employees: [...emps.values()].reduce((a, b) => a + b, 0),
      paying: companies.filter((c) => c.billingStatus === "paying").length,
      trials: companies.filter((c) => c.billingStatus === "trial").length,
      trialsEnding7d: companies.filter((c) => c.billingStatus === "trial" && c.trialDaysLeft !== null && c.trialDaysLeft <= 7).length,
      expired: companies.filter((c) => c.billingStatus === "trial_expired" || c.billingStatus === "unpaid").length,
      mrr: companies.reduce((a, c) => a + c.mrr, 0),
    };
    return {
      ok: true, needsMigration, needsPlatformMigration, companies,
      platformAudit: platRes.error ? [] : mapPlatformRows(platRes.data as Record<string, unknown>[], names),
      totals,
    };
  } catch (e) {
    console.error("[admin] overview failed:", e);
    return EMPTY;
  }
}

/* ---------- company drill-down (support view) ---------- */

export type AdminCompanyUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  createdAt: string | null;
  lastSignInAt: string | null; // auth.users.last_sign_in_at (service role)
  employeeLinked: boolean;     // an employees row points at this user
};
export type AdminCompanyDetail = {
  ok: boolean;
  users: AdminCompanyUser[];
  locations: string[];
  employeesActive: number;
  employeesInactive: number;
  punches7d: number;
  revenue30d: number;
  audit: { action: string; detail: string | null; at: string }[];
  platformAudit: PlatformAuditEntry[]; // last 10 admin actions on this company
};

/** Support drill-down over one company. Caller MUST have passed isVaktoAdmin(). */
export async function getCompanyDetail(companyId: string): Promise<AdminCompanyDetail> {
  const empty: AdminCompanyDetail = {
    ok: false, users: [], locations: [], employeesActive: 0, employeesInactive: 0,
    punches7d: 0, revenue30d: 0, audit: [], platformAudit: [],
  };
  if (!(await isVaktoAdmin()) || !companyId) return empty;
  try {
    const db = createAdminClient();
    const week = new Date(Date.now() - 7 * 86400000).toISOString();
    const month = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [usersRes, locRes, empRes, punchRes, audRes, platRes] = await Promise.all([
      db.from("users").select("id, email, full_name, role, created_at").eq("company_id", companyId).order("created_at"),
      db.from("locations").select("id, name").eq("company_id", companyId),
      db.from("employees").select("status, user_id").eq("company_id", companyId),
      db.from("punches").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("clock_in", week),
      db.from("audit_log").select("action, detail, at").eq("company_id", companyId).order("at", { ascending: false }).limit(12),
      db.from("platform_audit").select("id, admin_email, action, company_id, target, detail, at").eq("company_id", companyId).order("at", { ascending: false }).limit(10),
    ]);
    const locIds = (locRes.data ?? []).map((l) => l.id as string);
    let revenue30d = 0;
    if (locIds.length) {
      const { data: rev } = await db.from("revenue").select("amount").in("location_id", locIds).gte("date", month);
      revenue30d = (rev ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
    }
    const emps = empRes.data ?? [];
    const linked = new Set(emps.map((e) => (e.user_id ? String(e.user_id) : "")).filter(Boolean));

    // Last sign-in lives in auth.users — one service-role lookup per user (companies are small).
    const baseUsers = (usersRes.data ?? []).slice(0, 100);
    const lastSignIn = await Promise.all(baseUsers.map(async (u) => {
      try {
        const { data } = await db.auth.admin.getUserById(u.id as string);
        return data?.user?.last_sign_in_at ?? null;
      } catch {
        return null;
      }
    }));

    return {
      ok: true,
      users: baseUsers.map((u, i) => ({
        id: u.id as string, email: (u.email as string) ?? null, name: (u.full_name as string) ?? null,
        role: (u.role as string) ?? null, createdAt: (u.created_at as string) ?? null,
        lastSignInAt: lastSignIn[i], employeeLinked: linked.has(String(u.id)),
      })),
      locations: (locRes.data ?? []).map((l) => String(l.name)),
      employeesActive: emps.filter((e) => e.status === "active").length,
      employeesInactive: emps.filter((e) => e.status !== "active").length,
      punches7d: punchRes.count ?? 0,
      revenue30d,
      audit: (audRes.data ?? []).map((a) => ({ action: String(a.action), detail: (a.detail as string) ?? null, at: String(a.at) })),
      platformAudit: platRes.error ? [] : mapPlatformRows(platRes.data as Record<string, unknown>[], new Map()),
    };
  } catch (e) {
    console.error("[admin] company detail failed:", e);
    return empty;
  }
}
