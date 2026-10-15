import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { followupEmail, followupStage, FOLLOWUP_FROM, FOLLOWUP_REPLY_TO } from "@/lib/signup-followup";

// Daginn eftir nýskráningu: persónulegur póstur frá Bjarna til eiganda (0080 companies.followup_sent_at).
// Fer aðeins einu sinni á hvert fyrirtæki, aðeins í production, og ekki á prufu-/demo-fyrirtæki.
const MIN_AGE_H = 20, MAX_AGE_D = 10;

export async function runSignupFollowups(now = new Date()): Promise<{ sent: string[]; skipped: string[] }> {
  if (process.env.VERCEL_ENV !== "production") return { sent: [], skipped: ["not production"] };
  const db = createAdminClient();
  const { data: cos } = await db.from("companies").select("id, name, billing_status, created_at")
    .is("followup_sent_at", null)
    .lte("created_at", new Date(now.getTime() - MIN_AGE_H * 3600e3).toISOString())
    .gte("created_at", new Date(now.getTime() - MAX_AGE_D * 86400e3).toISOString());
  const sent: string[] = [], skipped: string[] = [];
  for (const c of cos ?? []) {
    const name = String(c.name ?? "");
    if (c.billing_status === "free" || /test|prufa|demo/i.test(name)) { skipped.push(name); continue; }
    const { data: owner } = await db.from("users").select("full_name, email").eq("company_id", c.id).eq("role", "owner")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!owner?.email) { skipped.push(name); continue; }
    const [{ count: staff }, { count: shifts }] = await Promise.all([
      db.from("employees").select("id", { count: "exact", head: true }).eq("company_id", c.id),
      db.from("shifts").select("id", { count: "exact", head: true }).eq("company_id", c.id).eq("published", true),
    ]);
    const input = { firstName: String(owner.full_name ?? "").split(/\s+/)[0] ?? "", company: name, hasStaff: (staff ?? 0) > 0, hasSchedule: (shifts ?? 0) > 0 };
    // Merkt fyrst svo tvöföld keyrsla sendi ekki tvisvar.
    const { data: claimed } = await db.from("companies").update({ followup_sent_at: now.toISOString() }).eq("id", c.id).is("followup_sent_at", null).select("id");
    if (!claimed?.length) continue;
    const mail = followupEmail(input);
    const r = await sendEmail({ to: owner.email as string, from: FOLLOWUP_FROM, replyTo: FOLLOWUP_REPLY_TO, ...mail });
    if (r.ok) sent.push(`${name} (${followupStage(input)})`);
    else { await db.from("companies").update({ followup_sent_at: null }).eq("id", c.id); skipped.push(`${name}: ${r.error}`); }
  }
  return { sent, skipped };
}
