import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuditEntry = { action: string; entity: string | null; detail: string | null; at: string };

/** Best-effort audit write. Never throws — auditing must not break the action. */
export async function logAudit(
  supabase: SupabaseClient,
  companyId: string,
  userId: string | null,
  e: { action: string; entity?: string; entityId?: string; detail?: string },
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      company_id: companyId,
      user_id: userId,
      action: e.action,
      entity: e.entity ?? null,
      entity_id: e.entityId ?? null,
      detail: e.detail ?? null,
    });
  } catch {
    /* ignore */
  }
}

const DEMO: AuditEntry[] = [
  { action: "payroll.run", entity: "payroll_run", detail: "Launakeyrsla keyrð — 12 starfsmenn", at: "2026-06-23T09:12:00Z" },
  { action: "schedule.publish", entity: "shifts", detail: "Vaktaplan birt — 34 vaktir, vika 22.–28. júní", at: "2026-06-22T16:40:00Z" },
  { action: "employee.update", entity: "employee", detail: "Taxti uppfærður — Ómar S.", at: "2026-06-22T11:05:00Z" },
  { action: "inventra.sync", entity: "revenue", detail: "Velta sótt frá Inventra — 612.000 kr", at: "2026-06-22T08:01:00Z" },
  { action: "employee.create", entity: "employee", detail: "Nýr starfsmaður stofnaður — Lóa", at: "2026-06-20T13:22:00Z" },
];

export async function getAuditLog(): Promise<{ entries: AuditEntry[]; live: boolean }> {
  if (!isSupabaseConfigured()) return { entries: DEMO, live: false };
  try {
    const supabase = await createClient();
    // Demo only before sign-in; a signed-in company shows its real (maybe empty) log.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { entries: DEMO, live: false };
    const { data, error } = await supabase
      .from("audit_log")
      .select("action, entity, detail, at")
      .order("at", { ascending: false })
      .limit(8);
    if (error) return { entries: DEMO, live: false };
    return { entries: (data ?? []) as AuditEntry[], live: true };
  } catch {
    return { entries: DEMO, live: false };
  }
}
