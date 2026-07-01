import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Create a company and link the user as its owner (service-role). Used by both
 * email/password signup and OAuth-first signups (no company yet). */
export async function provisionCompanyForUser(userId: string, email: string, fullName: string, companyName: string): Promise<{ ok: boolean; companyId?: string; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data: comp, error } = await admin.from("companies").insert({ name: companyName || "Mitt fyrirtæki" }).select("id").single();
    if (error || !comp) return { ok: false, error: error?.message ?? "Tókst ekki að stofna fyrirtæki" };
    const { error: uErr } = await admin.from("users").upsert({ id: userId, email, company_id: comp.id, role: "owner", full_name: fullName });
    if (uErr) return { ok: false, error: uErr.message };
    return { ok: true, companyId: comp.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
