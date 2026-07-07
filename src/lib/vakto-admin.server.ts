import "server-only";
// VAKTO super-admin (the SaaS owner's view over ALL companies) — strictly
// gated by email allowlist, then reads with the service-role client since the
// data spans every tenant. Never expose any of this through normal RLS paths.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Comma-separated allowlist; defaults to the founder's account.
const ADMIN_EMAILS = (process.env.VAKTO_ADMIN_EMAILS || "bjarniludviks@icloud.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// VAKTO pricing (same as the signup + Settings subscription card).
export const PLAN_BASE = 9990;        // kr/mán m/VSK, 5 notendur innifaldir
export const PLAN_INCLUDED_USERS = 5;
export const PLAN_EXTRA_USER = 990;   // kr/mán per notanda umfram

export type BillingStatus = "paying" | "trial" | "trial_expired" | "unpaid" | "free" | "none";
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
  billingStatus: BillingStatus;
  manualStatus: string | null; // raw billing_status column (admin override)
  mrr: number;                 // kr/mán this company contributes (0 unless paying)
};
export type AdminOverview = {
  ok: boolean;
  needsMigration?: boolean;
  companies: AdminCompany[];
  totals: { companies: number; users: number; employees: number; paying: number; trials: number; expired: number; mrr: number };
};

const EMPTY: AdminOverview = { ok: false, companies: [], totals: { companies: 0, users: 0, employees: 0, paying: 0, trials: 0, expired: 0, mrr: 0 } };

/** Is the signed-in user allowed into /admin? (email allowlist) */
export async function isVaktoAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}

function deriveStatus(manual: string | null, trialEndsAt: string | null, plan: string | null): BillingStatus {
  if (manual === "paying" || manual === "unpaid" || manual === "free") return manual;
  if (trialEndsAt) return new Date(trialEndsAt).getTime() > Date.now() ? "trial" : "trial_expired";
  return plan ? "trial_expired" : "none";
}

function mrrOf(status: BillingStatus, users: number): number {
  if (status !== "paying") return 0;
  return PLAN_BASE + Math.max(0, users - PLAN_INCLUDED_USERS) * PLAN_EXTRA_USER;
}

/** Every company + usage + billing status + MRR. Caller MUST have passed isVaktoAdmin(). */
export async function getAdminOverview(): Promise<AdminOverview> {
  if (!(await isVaktoAdmin())) return EMPTY;
  try {
    const db = createAdminClient();

    // billing_status column arrives with migration 0027 — stay tolerant before it.
    let needsMigration = false;
    let comps = await db.from("companies")
      .select("id, name, kennitala, country, created_at, plan, trial_ends_at, billing_status")
      .order("created_at", { ascending: true });
    if (comps.error) {
      needsMigration = true;
      comps = await db.from("companies")
        .select("id, name, kennitala, country, created_at, plan, trial_ends_at")
        .order("created_at", { ascending: true }) as typeof comps;
    }
    const rows = (comps.data ?? []) as Record<string, unknown>[];

    const [usersRes, empRes, locRes, punchRes, auditRes] = await Promise.all([
      db.from("users").select("company_id"),
      db.from("employees").select("company_id"),
      db.from("locations").select("company_id"),
      db.from("punches").select("company_id, clock_in").order("clock_in", { ascending: false }).limit(2000),
      db.from("audit_log").select("company_id, created_at").order("created_at", { ascending: false }).limit(2000),
    ]);
    const countBy = (list: { company_id?: unknown }[] | null) => {
      const m = new Map<string, number>();
      for (const r of list ?? []) { const k = String(r.company_id); m.set(k, (m.get(k) ?? 0) + 1); }
      return m;
    };
    const users = countBy(usersRes.data);
    const emps = countBy(empRes.data);
    const locs = countBy(locRes.data);
    const lastAct = new Map<string, string>();
    for (const p of punchRes.data ?? []) {
      const k = String(p.company_id);
      if (!lastAct.has(k)) lastAct.set(k, String(p.clock_in));
    }
    for (const a of auditRes.data ?? []) {
      const k = String(a.company_id);
      const t = String(a.created_at);
      if (!lastAct.has(k) || t > lastAct.get(k)!) lastAct.set(k, t);
    }

    const companies: AdminCompany[] = rows.map((c) => {
      const id = String(c.id);
      const u = users.get(id) ?? 0;
      const manual = (c.billing_status as string) ?? null;
      const status = deriveStatus(manual, (c.trial_ends_at as string) ?? null, (c.plan as string) ?? null);
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
        trialEndsAt: (c.trial_ends_at as string) ?? null,
        billingStatus: status,
        manualStatus: manual,
        mrr: mrrOf(status, u),
      };
    });

    const totals = {
      companies: companies.length,
      users: [...users.values()].reduce((a, b) => a + b, 0),
      employees: [...emps.values()].reduce((a, b) => a + b, 0),
      paying: companies.filter((c) => c.billingStatus === "paying").length,
      trials: companies.filter((c) => c.billingStatus === "trial").length,
      expired: companies.filter((c) => c.billingStatus === "trial_expired" || c.billingStatus === "unpaid").length,
      mrr: companies.reduce((a, c) => a + c.mrr, 0),
    };
    return { ok: true, needsMigration, companies, totals };
  } catch {
    return EMPTY;
  }
}
