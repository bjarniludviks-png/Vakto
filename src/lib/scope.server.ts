import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** A viewer's department scope. `departments` empty = sees every department. */
export type Scope = { role: string; departments: string[] };

/**
 * The current user's department scope for screens that filter by department.
 * Owners always see everything. Managers/shift-leads are limited to the
 * departments assigned to them (employees.oversees_departments, migration 0025).
 * Tolerant: any error (incl. column missing pre-migration) → full access.
 */
export async function getMyScope(): Promise<Scope> {
  if (!isSupabaseConfigured()) return { role: "owner", departments: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: "owner", departments: [] };
    const { data: u } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    const role = (u?.role as string) ?? "owner";
    if (role === "owner") return { role, departments: [] };
    const { data: emp } = await supabase
      .from("employees").select("oversees_departments").eq("user_id", user.id).maybeSingle();
    const departments = ((emp?.oversees_departments as string[] | null) ?? []).filter(Boolean);
    return { role, departments };
  } catch {
    return { role: "owner", departments: [] };
  }
}
