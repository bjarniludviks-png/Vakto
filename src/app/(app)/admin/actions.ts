"use server";

// VAKTO super-admin actions — every action re-verifies the email allowlist
// before touching data with the service-role client.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVaktoAdmin } from "@/lib/vakto-admin.server";

export type AdminResult = { ok: boolean; error?: string };

const STATUSES = new Set(["paying", "unpaid", "free", "auto"]);

/** Set a company's manual billing status ('auto' clears the override → trial logic). */
export async function setBillingStatus(companyId: string, status: string): Promise<AdminResult> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Aðgangi hafnað" };
  if (!companyId || !STATUSES.has(status)) return { ok: false, error: "Ógild staða" };
  try {
    const db = createAdminClient();
    const { error } = await db.from("companies")
      .update({ billing_status: status === "auto" ? null : status })
      .eq("id", companyId);
    if (error) return { ok: false, error: error.message.includes("billing_status") ? "Keyrðu migration 0027" : error.message };
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
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
