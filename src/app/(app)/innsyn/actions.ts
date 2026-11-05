"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCompanyId, getLaborFacts, type LaborFacts } from "@/lib/labor";
import { getMyScope } from "@/lib/scope.server";
import { getSickRate } from "@/lib/sickrate.server";
import type { SickRate } from "@/lib/sickrate";
import type { Gran } from "@/lib/periods";

/** Veikindahlutfall fyrir valda tímabilsgerð (stjórnendur; RLS + deildaafmörkun í getSickRate). */
export async function fetchSickRate(gran: Gran): Promise<SickRate> {
  const g: Gran = gran === "period" || gran === "quarter" || gran === "year" ? gran : "month";
  return getSickRate(g);
}


/** Launagreining Innsýnar: staður × deild × starfsmaður × dagur fyrir tímabil (aðeins eigandi — laun allra). */
export async function fetchLaborFacts(fromISO: string, toISO: string): Promise<{ ok: boolean; data?: LaborFacts; error?: string }> {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(fromISO) || !iso.test(toISO) || fromISO > toISO) return { ok: false, error: "Ógilt tímabil" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Engin gögn" };
  try {
    const scope = await getMyScope();
    if (scope.role !== "owner") return { ok: false, error: "Aðeins eigandi sér launagreiningu" };
    const supabase = await createClient();
    const company = await getCompanyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };
    return { ok: true, data: await getLaborFacts(supabase, company, fromISO, toISO) };
  } catch (e) {
    console.error("fetchLaborFacts", e);
    return { ok: false, error: "Tókst ekki að sækja gögn" };
  }
}
