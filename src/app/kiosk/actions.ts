"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const COMPANY = "00000000-0000-0000-0000-0000000000c0"; // Kaffi Krónan (seed)

export type PunchResult = { ok: boolean; demo?: boolean; error?: string };

/**
 * Kiosk is an unauthenticated shared-tablet page, so it writes via the
 * service-role admin client (trusted device). Identifies the employee by name
 * within the demo company. Flows into the manager Tímaskráning view.
 */
export async function kioskPunch(fullName: string, into: boolean): Promise<PunchResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const admin = createAdminClient();
    const { data: emp } = await admin
      .from("employees")
      .select("id")
      .eq("company_id", COMPANY)
      .eq("full_name", fullName)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const employee_id = emp.id as string;
    const now = new Date().toISOString();

    if (into) {
      const { error } = await admin.from("punches").insert({
        company_id: COMPANY,
        employee_id,
        clock_in: now,
        source: "kiosk",
      });
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: open } = await admin
        .from("punches")
        .select("id")
        .eq("employee_id", employee_id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open) {
        const { error } = await admin.from("punches").update({ clock_out: now }).eq("id", open.id);
        if (error) return { ok: false, error: error.message };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
