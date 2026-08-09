import "server-only";

// 🎂 Automatic birthday posts on the Fréttaveita. Birthday = DDMM from the
// kennitala. Runs from the daily cron + opportunistically when the feed is
// opened; an existing birthday post for the employee today makes it a no-op.

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { notifyEmployee } from "@/lib/push";

export async function checkBirthdays(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const admin = createAdminClient();
    const now = new Date();
    const ddmm = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const { data: emps } = await admin
      .from("employees").select("id, company_id, full_name, kennitala")
      .eq("status", "active").not("kennitala", "is", null);
    let n = 0;
    for (const e of emps ?? []) {
      const kt = (e.kennitala as string).replace(/\D/g, "");
      if (kt.slice(0, 4) !== ddmm) continue;
      const first = (e.full_name as string).split(/\s+/)[0];
      const body = `🎂 ${first} á afmæli í dag — til hamingju! 🎉`;
      const { data: dup } = await admin
        .from("posts").select("id").eq("company_id", e.company_id).eq("body", body)
        .gte("created_at", dayStart.toISOString()).limit(1);
      if (dup?.length) continue;
      const { error } = await admin.from("posts").insert({ company_id: e.company_id, sender_id: null, body, pinned: false });
      if (error) continue;
      n++;
      // A small joy-push to the team (best-effort, capped).
      const { data: team } = await admin.from("employees").select("id").eq("company_id", e.company_id).eq("status", "active").limit(100);
      for (const m of team ?? []) {
        if (m.id === e.id) continue;
        void notifyEmployee(m.id as string, { title: "🎂 Afmæli í dag", body: `${first} á afmæli í dag — sendu kveðju á fréttaveitunni!`, url: "/frettaveita", tag: "birthday" });
      }
    }
    return n;
  } catch {
    return 0;
  }
}
