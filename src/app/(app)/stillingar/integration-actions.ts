"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { encrypt, normalizeSite, testConnection, type Provider } from "@/lib/integrations/providers.server";
import { syncIntegration, refreshWeekdayPattern } from "@/lib/integrations/sync.server";
import { paydayToken } from "@/lib/integrations/payday.server";

export type IntegrationView = { id: string; provider: string; site: string; status: "connected" | "error"; lastSync: string | null; lastError: string | null; lastAmount: number | null; location: string | null };
export type RevenueMode = "system" | "manual" | "estimate";
export type TengingarView = {
  ok: boolean; mode: RevenueMode | null; weekday: Record<string, number> | null; learned: boolean;
  integrations: IntegrationView[]; locations: { id: string; name: string }[]; interest: string[];
  yesterday: { amount: number; sources: string[] } | null; needsMigration?: boolean;
  /** Bein tenging við Payday (tímaskrá send í launakeyrslu). */
  payday?: { id: string; lastSync: string | null; lastError: string | null } | null;
};
type R = { ok: boolean; error?: string };

async function ctxOf() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: u } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!u?.company_id) return { error: "Fyrirtæki fannst ekki" as const };
  if (u.role !== "owner" && u.role !== "manager") return { error: "Aðeins stjórnendur og vaktstjórar" as const };
  return { supabase, company: u.company_id as string, userId: user.id };
}
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function getTengingar(): Promise<TengingarView> {
  const empty: TengingarView = { ok: false, mode: null, weekday: null, learned: false, integrations: [], locations: [], interest: [], yesterday: null };
  const c = await ctxOf(); if ("error" in c) return empty;
  const { supabase, company } = c;
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
  const [co, ints, locs, intr] = await Promise.all([
    supabase.from("companies").select("revenue_mode, weekday_revenue, weekday_revenue_learned").eq("id", company).maybeSingle(),
    supabase.from("company_integrations").select("id, provider, site, status, last_sync_at, last_error, last_amount, location_id").eq("company_id", company).order("created_at"),
    supabase.from("locations").select("id, name").eq("company_id", company).order("name"),
    supabase.from("integration_interest").select("provider").eq("company_id", company),
  ]);
  const locations = (locs.data ?? []).map((l) => ({ id: l.id as string, name: l.name as string }));
  const ln = new Map(locations.map((l) => [l.id, l.name]));
  const { data: rev } = locations.length
    ? await supabase.from("revenue").select("amount, source").in("location_id", locations.map((l) => l.id)).eq("date", isoDay(y))
    : { data: [] };
  const yAmt = (rev ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
  return {
    ok: true,
    needsMigration: !!co.error || !!ints.error,
    mode: (co.data?.revenue_mode as RevenueMode | null) ?? null,
    weekday: (co.data?.weekday_revenue as Record<string, number> | null) ?? null,
    learned: !!co.data?.weekday_revenue_learned,
    payday: (() => { const p = (ints.data ?? []).find((i) => i.provider === "payday"); return p ? { id: p.id as string, lastSync: (p.last_sync_at as string) ?? null, lastError: (p.last_error as string) ?? null } : null; })(),
    integrations: (ints.data ?? []).filter((i) => i.provider !== "payday").map((i) => ({
      id: i.id as string, provider: i.provider as string, site: i.site as string, status: i.status as "connected" | "error",
      lastSync: (i.last_sync_at as string | null) ?? null, lastError: (i.last_error as string | null) ?? null,
      lastAmount: i.last_amount == null ? null : Number(i.last_amount), location: i.location_id ? ln.get(i.location_id as string) ?? null : null,
    })),
    locations,
    interest: (intr.data ?? []).map((r) => r.provider as string),
    yesterday: (rev ?? []).length ? { amount: yAmt, sources: [...new Set((rev ?? []).map((r) => String(r.source ?? "manual")))] } : null,
  };
}

export async function connectIntegration(input: { provider: Provider; site: string; token?: string; key?: string; secret?: string; locationId?: string }): Promise<R & { total?: number }> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  if (input.provider !== "shopify" && input.provider !== "woocommerce") return { ok: false, error: "Óþekkt kerfi" };
  const site = normalizeSite(input.provider, input.site);
  if (!site) return { ok: false, error: input.provider === "shopify" ? "Sláðu inn slóðina sem endar á .myshopify.com" : "Sláðu inn slóð vefverslunarinnar (https://…)" };
  const creds = input.provider === "shopify" ? { token: (input.token ?? "").trim() } : { key: (input.key ?? "").trim(), secret: (input.secret ?? "").trim() };
  if (input.provider === "shopify" ? !creds.token : !creds.key || !creds.secret) return { ok: false, error: "Vantar lykil" };
  try { await testConnection(input.provider, site, creds); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Tenging tókst ekki" }; }
  const { supabase, company, userId } = c;
  const { data, error } = await supabase.from("company_integrations").upsert({
    company_id: company, provider: input.provider, site, location_id: input.locationId || null, secret_enc: encrypt(creds), status: "connected", last_error: null,
  }, { onConflict: "company_id,provider,site" }).select("id, company_id, provider, site, location_id, secret_enc").single();
  if (error || !data) { console.error("[integrations] connect", error?.message); return { ok: false, error: "Tókst ekki að vista tenginguna — reyndu aftur." }; }
  await supabase.from("companies").update({ revenue_mode: "system" }).eq("id", company);
  const r = await syncIntegration(data as never, 90); // fyrsta sókn: síðustu 90 dagar
  await logAudit(supabase, company, userId, { action: "integration.connect", entity: "company_integrations", entityId: data.id as string, detail: `${input.provider} tengt — ${site}` });
  revalidatePath("/stillingar"); revalidatePath("/maelabord");
  return r.ok ? { ok: true, total: r.total } : { ok: false, error: `Tengt, en fyrsta sókn tókst ekki: ${r.error}` };
}

/** Tengir Payday: lyklarnir eru prófaðir (sóttur aðgangslykill) og geymdir dulkóðaðir. */
export async function connectPayday(input: { clientId: string; clientSecret: string }): Promise<R> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  const creds = { key: input.clientId.trim(), secret: input.clientSecret.trim() };
  if (!creds.key || !creds.secret) return { ok: false, error: "Vantar Client ID og Client Secret" };
  try { await paydayToken(creds); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Tenging tókst ekki" }; }
  const { data, error } = await c.supabase.from("company_integrations").upsert({
    company_id: c.company, provider: "payday", site: "payday.is", secret_enc: encrypt(creds), status: "connected", last_error: null,
  }, { onConflict: "company_id,provider,site" }).select("id").single();
  if (error || !data) { console.error("[integrations] payday", error?.message); return { ok: false, error: "Tókst ekki að vista tenginguna — reyndu aftur." }; }
  await logAudit(c.supabase, c.company, c.userId, { action: "integration.connect", entity: "company_integrations", entityId: data.id as string, detail: "Payday tengt" });
  revalidatePath("/stillingar"); revalidatePath("/launakeyrslur");
  return { ok: true };
}

export async function syncNow(id: string): Promise<R> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  const { data } = await c.supabase.from("company_integrations").select("id, company_id, provider, site, location_id, secret_enc").eq("id", id).eq("company_id", c.company).maybeSingle();
  if (!data) return { ok: false, error: "Tenging fannst ekki" };
  const r = await syncIntegration(data as never, 14);
  revalidatePath("/stillingar"); revalidatePath("/maelabord");
  return r;
}

export async function disconnectIntegration(id: string): Promise<R> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  const { data } = await c.supabase.from("company_integrations").delete().eq("id", id).eq("company_id", c.company).select("provider, site").maybeSingle();
  if (data) await logAudit(c.supabase, c.company, c.userId, { action: "integration.disconnect", entity: "company_integrations", entityId: id, detail: `${data.provider} aftengt — ${data.site}` });
  revalidatePath("/stillingar");
  return { ok: true };
}

export async function setRevenueMode(mode: RevenueMode): Promise<R> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  const { error } = await c.supabase.from("companies").update({ revenue_mode: mode }).eq("id", c.company);
  return error ? { ok: false, error: "Tókst ekki að vista" } : { ok: true };
}

// Dæmigert mynstur veitinga- og þjónustufyrirtækja (sun=0 … lau=6), summa = 1.
const WEIGHTS = [0.14, 0.11, 0.11, 0.12, 0.14, 0.18, 0.20];

/** Áætlun út frá mánaðarveltu: skiptist á vikudaga eftir dæmigerðu mynstri. Raunvelta vinnur alltaf þegar hún kemur. */
export async function saveMonthlyEstimate(monthly: number): Promise<R> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  if (!(monthly > 0) || monthly > 5e10) return { ok: false, error: "Sláðu inn mánaðarveltu" };
  const weekly = (monthly * 12) / 52;
  const map: Record<string, number> = {};
  WEIGHTS.forEach((w, i) => { map[String(i)] = Math.round(weekly * w); });
  const { error } = await c.supabase.from("companies").update({ weekday_revenue: map, weekday_revenue_learned: false, revenue_mode: "estimate" }).eq("id", c.company);
  if (error) return { ok: false, error: "Tókst ekki að vista" };
  await logAudit(c.supabase, c.company, c.userId, { action: "revenue.estimate", entity: "company", detail: `Áætluð mánaðarvelta ${Math.round(monthly)} kr` });
  revalidatePath("/maelabord");
  return { ok: true };
}

/** Eftir handvirka skráningu: læra mynstrið ef nóg er komið af tölum. */
export async function relearnPattern(): Promise<R> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  await refreshWeekdayPattern(c.company);
  return { ok: true };
}

export async function notifyInterest(provider: string): Promise<R> {
  const c = await ctxOf(); if ("error" in c) return { ok: false, error: c.error };
  const { error } = await c.supabase.from("integration_interest").upsert({ company_id: c.company, provider: provider.slice(0, 40), user_id: c.userId }, { onConflict: "company_id,provider" });
  return error ? { ok: false, error: "Tókst ekki að vista" } : { ok: true };
}
