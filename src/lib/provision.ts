import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sjálfgefnar vaktategundir fyrir nýtt fyrirtæki — sömu og vaktaplanið sýnir
 * annars sem sýnidæmi, en hér vistaðar svo vaktir fái shift_type_id. */
export const DEFAULT_SHIFT_TYPES = [
  { name: "Dagvakt", start_time: "08:00", end_time: "16:00", premium_label: "Dagvinna", color: "#4338ca", bg: "#eef0ff", border: "#e0e2fb" },
  { name: "Morgunvakt", start_time: "07:00", end_time: "13:00", premium_label: "+33% fyrir 07:00", color: "#1f9d6b", bg: "#e7f6ef", border: "#cdeede" },
  { name: "Kvöldvakt", start_time: "16:00", end_time: "24:00", premium_label: "+33% álag", color: "#b06a12", bg: "#fff2e2", border: "#fbe2c4" },
  { name: "Helgarvakt", start_time: "12:00", end_time: "20:00", premium_label: "+45% helgarálag", color: "#c0392b", bg: "#fde9e6", border: "#f8d2cb" },
];

/** Vistar sjálfgefnu vaktategundirnar ef fyrirtækið á engar. Best-effort. */
export async function ensureDefaultShiftTypes(companyId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { count } = await admin.from("shift_types").select("id", { count: "exact", head: true }).eq("company_id", companyId);
    if ((count ?? 0) > 0) return false;
    // Ein færsla í einu með "on conflict do nothing" (unique index 0052) — samhliða
    // beiðnir (síða + prefetch) vista þá aldrei tvítekningar.
    for (const t of DEFAULT_SHIFT_TYPES) {
      await admin.from("shift_types").upsert({ ...t, company_id: companyId }, { onConflict: "company_id,name", ignoreDuplicates: true });
    }
    return true;
  } catch { return false; }
}

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
    await ensureDefaultShiftTypes(comp.id);
    return { ok: true, companyId: comp.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
