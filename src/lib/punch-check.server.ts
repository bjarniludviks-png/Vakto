import "server-only";

// "Ertu enn að vinna?" — find punches open for 12+ hours and nudge the
// employee once (push + email), marking long_reminded_at so we never nag.
// Called from the daily cron AND opportunistically when managers open
// Tímaskráning. Tolerant of migration 0033 not having run (returns 0).

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { notifyEmployee } from "@/lib/push";
import { sendStillWorkingEmail } from "@/lib/email";

export async function checkLongPunches(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - 12 * 3600e3).toISOString();
    const { data, error } = await admin
      .from("punches")
      .select("id, employee_id, clock_in, long_reminded_at, employees(full_name, email)")
      .is("clock_out", null).is("long_reminded_at", null)
      .lt("clock_in", cutoff).limit(50);
    if (error) return 0;
    let n = 0;
    for (const p of data ?? []) {
      const emp = (Array.isArray(p.employees) ? p.employees[0] : p.employees) as { full_name?: string; email?: string } | null;
      void notifyEmployee(p.employee_id as string, {
        title: "Ertu enn að vinna?",
        body: "Þú hefur verið stimplað/ur inn í meira en 12 klst — gleymdirðu að stimpla út?",
        url: "/mitt-svaedi", tag: "punch-reminder",
      });
      if (emp?.email) void sendStillWorkingEmail(emp.email, emp.full_name ?? "");
      await admin.from("punches").update({ long_reminded_at: new Date().toISOString() }).eq("id", p.id);
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
