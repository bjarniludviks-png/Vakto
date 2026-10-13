import "server-only";
// Meta (Facebook/Instagram) auglýsingar — lesið beint úr Marketing API fyrir /admin/auglysingar.
// Eingöngu LESTUR. Þarf tvær env-breytur á Vercel:
//   META_ACCESS_TOKEN   — System User token úr Business Manager með ads_read
//   META_AD_ACCOUNT_ID  — auglýsingareikningurinn (með eða án „act_“)
// Án þeirra skilar þetta { configured: false } og síðan sýnir uppsetningarleiðbeiningar.

const API = "https://graph.facebook.com/v23.0";
// Gjaldmiðlar þar sem Meta gefur fjárhag í heilum einingum (offset 1) — annars í 1/100.
const ZERO_DECIMAL = new Set(["ISK", "JPY", "KRW", "CLP", "COP", "CRC", "HUF", "IDR", "PYG", "TWD", "VND"]);

export type MetaTotals = { spend: number; impressions: number; reach: number; clicks: number; ctr: number; cpc: number; cpm: number; results: number };
export type MetaCampaign = {
  id: string; name: string; status: string; objective: string | null;
  dailyBudget: number | null; lifetimeBudget: number | null; budgetRemaining: number | null;
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number; results: number;
};
export type MetaOverview =
  | { configured: false }
  | { configured: true; ok: false; error: string }
  | {
      configured: true; ok: true;
      account: { id: string; name: string; currency: string; status: number; spentAllTime: number; spendCap: number | null };
      days: number;
      totals: MetaTotals;
      daily: { date: string; spend: number }[];
      campaigns: MetaCampaign[];
    };

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
type Action = { action_type?: string; value?: string };
/** „Niðurstöður“ = leads + skráningar + kaup; annars smellir á hlekk. */
function results(actions: Action[] | undefined): number {
  const by = new Map<string, number>();
  for (const a of actions ?? []) by.set(String(a.action_type), num(a.value));
  const conv = (by.get("lead") ?? 0) + (by.get("complete_registration") ?? 0) + (by.get("purchase") ?? 0)
    + (by.get("offsite_conversion.fb_pixel_lead") ?? 0) + (by.get("offsite_conversion.fb_pixel_complete_registration") ?? 0);
  return conv || (by.get("link_click") ?? 0);
}

async function get(path: string, params: Record<string, string>, token: string): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 600 } });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    const e = json.error as { message?: string } | undefined;
    throw new Error(e?.message ?? `Meta API ${res.status}`);
  }
  return json;
}

export function metaConfigured(): boolean {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

/** Lykiltölur, dagleg eyðsla og herferðir síðustu `days` daga (7, 14, 30 eða 90). */
export async function getMetaOverview(days: 7 | 14 | 30 | 90 = 30): Promise<MetaOverview> {
  const token = process.env.META_ACCESS_TOKEN;
  const raw = process.env.META_AD_ACCOUNT_ID;
  if (!token || !raw) return { configured: false };
  const act = raw.startsWith("act_") ? raw : `act_${raw}`;
  const preset = `last_${days}d`;
  try {
    const [acc, tot, daily, camps] = await Promise.all([
      get(act, { fields: "name,currency,account_status,amount_spent,spend_cap" }, token),
      get(`${act}/insights`, { date_preset: preset, fields: "spend,impressions,reach,clicks,ctr,cpc,cpm,actions" }, token),
      get(`${act}/insights`, { date_preset: preset, time_increment: "1", fields: "spend", limit: "100" }, token),
      get(`${act}/campaigns`, {
        fields: `name,effective_status,objective,daily_budget,lifetime_budget,budget_remaining,insights.date_preset(${preset}){spend,impressions,clicks,ctr,cpc,actions}`,
        limit: "50",
      }, token),
    ]);
    const currency = String(acc.currency ?? "ISK");
    const off = ZERO_DECIMAL.has(currency) ? 1 : 100;
    const money = (v: unknown) => (v === undefined || v === null || v === "" ? null : num(v) / off);
    const t = ((tot.data as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
    const campaigns: MetaCampaign[] = ((camps.data as Record<string, unknown>[] | undefined) ?? []).map((c) => {
      const i = (((c.insights as { data?: Record<string, unknown>[] } | undefined)?.data) ?? [])[0] ?? {};
      return {
        id: String(c.id), name: String(c.name ?? "—"), status: String(c.effective_status ?? ""), objective: (c.objective as string) ?? null,
        dailyBudget: money(c.daily_budget), lifetimeBudget: money(c.lifetime_budget), budgetRemaining: money(c.budget_remaining),
        spend: num(i.spend), impressions: num(i.impressions), clicks: num(i.clicks), ctr: num(i.ctr), cpc: num(i.cpc),
        results: results(i.actions as Action[] | undefined),
      };
    }).sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || b.spend - a.spend);
    const cap = money(acc.spend_cap);
    return {
      configured: true, ok: true, days,
      account: {
        id: act, name: String(acc.name ?? act), currency, status: num(acc.account_status),
        spentAllTime: num(acc.amount_spent) / off, spendCap: cap && cap > 0 ? cap : null,
      },
      totals: {
        spend: num(t.spend), impressions: num(t.impressions), reach: num(t.reach), clicks: num(t.clicks),
        ctr: num(t.ctr), cpc: num(t.cpc), cpm: num(t.cpm), results: results(t.actions as Action[] | undefined),
      },
      daily: ((daily.data as Record<string, unknown>[] | undefined) ?? []).map((d) => ({ date: String(d.date_start), spend: num(d.spend) })),
      campaigns,
    };
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : "Villa við að sækja gögn frá Meta" };
  }
}
