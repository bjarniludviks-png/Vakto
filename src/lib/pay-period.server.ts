import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizePayPeriod, type PayPeriodCfg } from "@/lib/periods";
import type { OtMode } from "@/lib/payrules";

export type CompanyPaySetup = { period: PayPeriodCfg; otMode: OtMode };
const DEFAULT_SETUP: CompanyPaySetup = { period: { kind: "month", startDay: 1 }, otMode: "week" };

/** Launatímabil + yfirvinnuregla fyrirtækis. Þolir að 0036/0097 vanti (fellur á gömlu dálkana / sjálfgefið). */
export async function companyPaySetup(supabase: SupabaseClient, company: string): Promise<CompanyPaySetup> {
  const full = await supabase.from("companies").select("pay_period_start, pay_period, ot_mode").eq("id", company).maybeSingle();
  if (!full.error) {
    const d = full.data as { pay_period_start?: number; pay_period?: unknown; ot_mode?: string } | null;
    return { period: normalizePayPeriod(d?.pay_period, Number(d?.pay_period_start) || 1), otMode: d?.ot_mode === "period" ? "period" : "week" };
  }
  const old = await supabase.from("companies").select("pay_period_start").eq("id", company).maybeSingle(); // fyrir 0097
  if (old.error) return DEFAULT_SETUP;
  return { period: normalizePayPeriod(null, Number(old.data?.pay_period_start) || 1), otMode: "week" };
}

async function myCompany(): Promise<{ supabase: SupabaseClient; company: string } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  return profile?.company_id ? { supabase, company: profile.company_id as string } : null;
}

/** Launatímabil innskráðs notanda (almanaksmánuður ef ekkert er stillt). */
export async function getPayPeriod(): Promise<PayPeriodCfg> {
  try {
    const ctx = await myCompany();
    return ctx ? (await companyPaySetup(ctx.supabase, ctx.company)).period : DEFAULT_SETUP.period;
  } catch {
    return DEFAULT_SETUP.period;
  }
}

/** @deprecated Notið getPayPeriod — skilar upphafsdegi mánaðar (1 fyrir önnur tímabil). */
export async function getPayPeriodStart(): Promise<number> {
  const p = await getPayPeriod();
  return p.kind === "month" ? p.startDay ?? 1 : 1;
}
