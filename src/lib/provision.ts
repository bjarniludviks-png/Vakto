import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Create a company and link the user as its owner (service-role). Used by both
 * email/password signup and OAuth-first signups (no company yet). */
export async function provisionCompanyForUser(userId: string, email: string, fullName: string, companyName: string, country?: string): Promise<{ ok: boolean; companyId?: string; error?: string }> {
  try {
    const admin = createAdminClient();
    const co = (country ?? "IS").toUpperCase() === "IS" ? "IS" : "OTHER";
    // Try to set country (migration 0022); fall back to name-only if the column
    // isn't there yet, so signup never breaks.
    let comp: { id: string } | null = null;
    const withCountry = await admin.from("companies").insert({ name: companyName || "Mitt fyrirtæki", country: co }).select("id").single();
    if (withCountry.error) {
      const nameOnly = await admin.from("companies").insert({ name: companyName || "Mitt fyrirtæki" }).select("id").single();
      if (nameOnly.error || !nameOnly.data) return { ok: false, error: nameOnly.error?.message ?? "Tókst ekki að stofna fyrirtæki" };
      comp = nameOnly.data as { id: string };
    } else comp = withCountry.data as { id: string };
    if (!comp) return { ok: false, error: "Tókst ekki að stofna fyrirtæki" };
    const { error: uErr } = await admin.from("users").upsert({ id: userId, email, company_id: comp.id, role: "owner", full_name: fullName });
    if (uErr) return { ok: false, error: uErr.message };
    // Record the membership (migration 0023) — best-effort so signup never breaks.
    await admin.from("company_members").upsert({ user_id: userId, company_id: comp.id, role: "owner" });
    return { ok: true, companyId: comp.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
