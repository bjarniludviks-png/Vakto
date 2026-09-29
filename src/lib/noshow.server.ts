import "server-only";

// „Mætti ekki á vakt“ — birt vakt sem hófst fyrir 15+ mín, starfsmaðurinn hefur
// ekki stimplað inn og er ekki í samþykktu fríi → stjórnendur fá eina tilkynningu.
// Engin tíðari cron er til (Vercel keyrir daglega), svo þetta keyrir tækifærisbundið:
// þegar stjórnandi opnar Mælaborð/Tímaskráningu og þegar einhver stimplar inn.
// Dagsetningar/tímar vakta eru íslenskur tími = UTC. noshow_alerts (0057) tryggir
// að sama vakt sé aldrei tilkynnt tvisvar. Þolir að taflan vanti (skilar 0).

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { notifyManagers } from "@/lib/push";

const GRACE_MIN = 15;
const LOOKBACK_H = 6;

export async function checkNoShows(companyId?: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const admin = createAdminClient();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const hm = (d: Date) => d.toISOString().slice(11, 16);
    const latest = hm(new Date(now.getTime() - GRACE_MIN * 60e3));
    const earliest = new Date(now.getTime() - LOOKBACK_H * 3600e3);
    // Ekki fara yfir miðnætti aftur á bak — gærdagurinn er afgreiddur.
    const from = earliest.toISOString().slice(0, 10) === today ? hm(earliest) : "00:00";
    if (latest < from) return 0;

    let q = admin.from("shifts")
      .select("company_id, employee_id, start_time, employees(full_name, status)")
      .eq("date", today).eq("published", true).not("employee_id", "is", null)
      .gte("start_time", from).lte("start_time", latest);
    if (companyId) q = q.eq("company_id", companyId);
    const { data: shifts, error } = await q.limit(200);
    if (error || !shifts?.length) return 0;

    const empIds = [...new Set(shifts.map((s) => s.employee_id as string))];
    const [punchRes, leaveRes, sentRes] = await Promise.all([
      admin.from("punches").select("employee_id").in("employee_id", empIds).gte("clock_in", `${today}T00:00:00Z`),
      admin.from("leave_requests").select("employee_id").in("employee_id", empIds)
        .eq("status", "approved").lte("from_date", today).gte("to_date", today),
      admin.from("noshow_alerts").select("employee_id, start_time").in("employee_id", empIds).eq("date", today),
    ]);
    if (sentRes.error) return 0; // 0057 ekki keyrð
    const punched = new Set((punchRes.data ?? []).map((p) => p.employee_id as string));
    const onLeave = new Set((leaveRes.data ?? []).map((l) => l.employee_id as string));
    const sent = new Set((sentRes.data ?? []).map((a) => `${a.employee_id}|${String(a.start_time).slice(0, 5)}`));

    let n = 0;
    for (const s of shifts) {
      const eid = s.employee_id as string;
      const start = String(s.start_time).slice(0, 5);
      const emp = (Array.isArray(s.employees) ? s.employees[0] : s.employees) as { full_name?: string; status?: string } | null;
      if (punched.has(eid) || onLeave.has(eid) || sent.has(`${eid}|${start}`) || emp?.status === "inactive") continue;
      // Skrá fyrst — ef annar keyrsluþráður var á undan fellur insert á lyklinum og við sleppum.
      const { error: insErr } = await admin.from("noshow_alerts")
        .insert({ company_id: s.company_id, employee_id: eid, date: today, start_time: start });
      if (insErr) continue;
      sent.add(`${eid}|${start}`);
      const name = emp?.full_name?.split(/\s+/)[0] ?? "Starfsmaður";
      await notifyManagers(s.company_id as string, {
        title: "Mætti ekki á vakt",
        body: `${name} átti að mæta kl. ${start} og hefur ekki stimplað inn.`,
        url: "/timaskraning", tag: `noshow-${eid}-${today}`,
      });
      n++;
    }
    return n;
  } catch (e) {
    console.error("checkNoShows", e);
    return 0;
  }
}
