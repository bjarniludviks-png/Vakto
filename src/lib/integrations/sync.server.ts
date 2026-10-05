import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, fetchDaily, type Provider } from "./providers.server";

// Samstilling: sækir daglega veltu úr tengdu kerfi og skrifar í `revenue` (source = provider).
// Raðir þess kerfis á tímabilinu eru endurskrifaðar svo leiðréttingar (endurgreiðslur o.fl.) skili sér.

type Row = { id: string; company_id: string; provider: string; site: string; location_id: string | null; secret_enc: string | null };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function syncIntegration(row: Row, days = 7): Promise<{ ok: boolean; error?: string; total?: number }> {
  const db = createAdminClient();
  try {
    if (!row.secret_enc) throw new Error("Lykil vantar");
    let loc = row.location_id;
    if (!loc) {
      const { data } = await db.from("locations").select("id").eq("company_id", row.company_id).order("name").limit(1).maybeSingle();
      loc = (data?.id as string) ?? null;
    }
    if (!loc) throw new Error("Fyrirtækið hefur enga starfsstöð");
    const from = new Date(); from.setUTCDate(from.getUTCDate() - days);
    const fromISO = iso(from);
    const daily = await fetchDaily(row.provider as Provider, row.site, decrypt(row.secret_enc), fromISO);
    await db.from("revenue").delete().eq("location_id", loc).eq("source", row.provider).gte("date", fromISO);
    const rows = [...daily.entries()].filter(([, v]) => v > 0).map(([date, amount]) => ({ location_id: loc, date, amount: Math.round(amount), source: row.provider }));
    if (rows.length) { const { error } = await db.from("revenue").insert(rows); if (error) throw new Error(error.message); }
    const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
    await db.from("company_integrations").update({ status: "connected", last_error: null, last_sync_at: new Date().toISOString(), last_amount: Math.round(daily.get(iso(y)) ?? 0) }).eq("id", row.id);
    await refreshWeekdayPattern(row.company_id);
    return { ok: true, total: rows.reduce((a, r) => a + r.amount, 0) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Samstilling tókst ekki";
    await db.from("company_integrations").update({ status: "error", last_error: msg.slice(0, 300), last_sync_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: msg };
  }
}

/** Lærir meðalveltu hvers vikudags úr síðustu 8 vikum af raunveltu (≥ 21 dagur með tölum).
 *  Þá þarf enginn að slá inn meðaltöl — og veltuspá vaktaplansins fylgir raunveruleikanum. */
export async function refreshWeekdayPattern(companyId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: locs } = await db.from("locations").select("id").eq("company_id", companyId);
  const ids = (locs ?? []).map((l) => l.id as string);
  if (!ids.length) return false;
  const from = new Date(); from.setUTCDate(from.getUTCDate() - 56);
  const today = iso(new Date());
  const { data: rev } = await db.from("revenue").select("date, amount").in("location_id", ids).gte("date", iso(from)).lt("date", today);
  const perDay = new Map<string, number>();
  for (const r of rev ?? []) { const d = String(r.date).slice(0, 10); perDay.set(d, (perDay.get(d) ?? 0) + Number(r.amount ?? 0)); }
  if (perDay.size < 21) return false;
  const sum = Array(7).fill(0), cnt = Array(7).fill(0);
  for (const [d, v] of perDay) { const wd = new Date(d + "T00:00:00Z").getUTCDay(); sum[wd] += v; cnt[wd]++; }
  const map: Record<string, number> = {};
  for (let i = 0; i < 7; i++) map[String(i)] = cnt[i] ? Math.round(sum[i] / cnt[i]) : 0;
  await db.from("companies").update({ weekday_revenue: map, weekday_revenue_learned: true }).eq("id", companyId);
  return true;
}

/** Cron: samstillir allar tengingar (síðustu dagar) og uppfærir lærð mynstur. */
export async function syncAllIntegrations(): Promise<{ synced: number; failed: number }> {
  const db = createAdminClient();
  const { data } = await db.from("company_integrations").select("id, company_id, provider, site, location_id, secret_enc");
  let synced = 0, failed = 0;
  for (const row of (data ?? []) as Row[]) { const r = await syncIntegration(row, 7); if (r.ok) synced++; else failed++; }
  const { data: cos } = await db.from("companies").select("id");
  for (const c of cos ?? []) await refreshWeekdayPattern(c.id as string);
  return { synced, failed };
}
