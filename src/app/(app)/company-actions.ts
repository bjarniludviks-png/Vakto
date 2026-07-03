"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type CompanyOption = { id: string; name: string; role: string; active: boolean };
export type SearchEmp = { id: string; name: string; dept: string };

/** Lightweight employee list for the topbar search (company-scoped). Demo list
 * when unconfigured so search still works in preview. */
export async function listEmployeesForSearch(): Promise<SearchEmp[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: me } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    if (!me?.company_id) return [];
    const { data } = await supabase.from("employees")
      .select("id, full_name, departments(name)").eq("company_id", me.company_id).order("full_name");
    return (data ?? []).map((e) => {
      const d = (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } | null;
      return { id: e.id as string, name: e.full_name as string, dept: d?.name ?? "" };
    });
  } catch {
    return [];
  }
}

/** All companies the signed-in user belongs to (for the switcher). Tolerant of
 * migration 0023 not being run — returns just the active company then. */
export async function getMyCompanies(): Promise<CompanyOption[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: me } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const activeId = me?.company_id as string | undefined;

    const mem = await supabase.from("company_members").select("company_id, role, companies(name)").eq("user_id", user.id);
    if (mem.error) {
      // Pre-0023: only the active company is known.
      if (!activeId) return [];
      const { data: c } = await supabase.from("companies").select("name").eq("id", activeId).maybeSingle();
      return [{ id: activeId, name: (c?.name as string) ?? "VAKTO", role: "owner", active: true }];
    }
    const rows = (mem.data ?? []).map((r) => {
      const comp = (Array.isArray(r.companies) ? r.companies[0] : r.companies) as { name?: string } | null;
      return { id: r.company_id as string, name: comp?.name ?? "VAKTO", role: (r.role as string) ?? "employee", active: r.company_id === activeId };
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Switch the active company (must be a member). Updates users.company_id +
 * role so all existing company-scoped queries follow along. */
export async function switchCompany(companyId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const admin = createAdminClient();
    const { data: mem } = await admin.from("company_members").select("role").eq("user_id", user.id).eq("company_id", companyId).maybeSingle();
    if (!mem) return { ok: false, error: "Þú ert ekki með aðgang að þessu félagi" };
    const { error } = await admin.from("users").update({ company_id: companyId, role: mem.role }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
