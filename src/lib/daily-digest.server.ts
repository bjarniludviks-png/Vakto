import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDailyDigest, type DailyDigest } from "@/lib/email";

// Morgunyfirlit á eiganda VAKTO: heimsóknir gærdagsins (site_visits, 0079), nýskráningar og áskriftir.
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function top(rows: string[], n = 6): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r, (m.get(r) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export async function buildDailyDigest(now = new Date()): Promise<DailyDigest> {
  const db = createAdminClient();
  const y = new Date(now.getTime() - 86400e3);
  const day = isoDay(y);
  const from = `${day}T00:00:00Z`, to = `${isoDay(now)}T00:00:00Z`;
  const [vis, cos, paid, failed, pms] = await Promise.all([
    db.from("site_visits").select("path, referrer_host, utm_source, visitor").eq("day", day).limit(20000),
    db.from("companies").select("id, name, created_at, billing_status, trial_ends_at, card_required"),
    db.from("invoices").select("total_amount").eq("status", "paid").gte("paid_at", from).lt("paid_at", to),
    db.from("invoices").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", from).lt("created_at", to),
    db.from("payment_methods").select("company_id").eq("status", "active"),
  ]);
  const v = vis.data ?? [];
  const withCard = new Set((pms.data ?? []).map((p) => p.company_id as string));
  const companies = cos.data ?? [];
  const newCos = companies.filter((c) => String(c.created_at) >= from && String(c.created_at) < to);
  const owners = newCos.length
    ? (await db.from("users").select("company_id, full_name").in("company_id", newCos.map((c) => c.id)).eq("role", "owner")).data ?? []
    : [];
  const nowIso = now.toISOString();
  return {
    dayLabel: `${y.getUTCDate()}.${y.getUTCMonth() + 1}.${y.getUTCFullYear()}`,
    visits: v.length,
    visitors: new Set(v.map((r) => r.visitor)).size,
    topPages: top(v.map((r) => r.path as string)),
    topSources: top(v.map((r) => (r.utm_source as string) || (r.referrer_host as string) || "Beint / óþekkt")),
    signups: newCos.map((c) => ({ company: c.name as string, name: (owners.find((o) => o.company_id === c.id)?.full_name as string) ?? "", card: withCard.has(c.id as string) })),
    trials: companies.filter((c) => c.billing_status !== "paying" && c.billing_status !== "free" && c.trial_ends_at && String(c.trial_ends_at) > nowIso).length,
    paying: companies.filter((c) => c.billing_status === "paying").length,
    paidYesterday: (paid.data ?? []).reduce((a, r) => a + ((r.total_amount as number) ?? 0), 0),
    failedYesterday: failed.count ?? 0,
  };
}

export async function runDailyDigest() {
  const d = await buildDailyDigest();
  const r = await sendDailyDigest(d);
  return { sent: r.ok, visits: d.visits, visitors: d.visitors, signups: d.signups.length };
}
