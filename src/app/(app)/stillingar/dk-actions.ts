"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { logAudit } from "@/lib/audit";
import { getExportLines } from "@/lib/payroll-export.server";

// DK: launaliðir fyrirtækisins í dk Laun (fyrir CSV-innlestur í launakeyrslu) — companies.dk_paycodes (0091).
export type DkCodes = { dagvinna?: string; yfirvinna?: string; alag?: Record<string, string> };
export type DkSettings = { codes: DkCodes; alagPcts: number[]; connected: { id: string; company: string | null; lastSync: string | null; lastError: string | null } | null };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!u?.company_id || (u.role !== "owner" && u.role !== "manager")) return null;
  return { supabase, company: u.company_id as string, userId: user.id };
}

const code = (v: unknown) => (typeof v === "string" ? v.trim().replace(/[^\w-]/g, "").slice(0, 12) : "");

export async function getDkSettings(): Promise<DkSettings | null> {
  const c = await ctx(); if (!c) return null;
  const db = createAdminClient();
  const [{ data: co }, { data: integ }] = await Promise.all([
    db.from("companies").select("dk_paycodes").eq("id", c.company).maybeSingle(),
    db.from("company_integrations").select("id, last_sync_at, last_error").eq("company_id", c.company).eq("provider", "dk").maybeSingle(),
  ]);
  const codes = ((co?.dk_paycodes as DkCodes | null) ?? {});
  // Álagsprósentur sem koma fyrir í síðasta mánuði + þær sem eru þegar stilltar.
  const now = new Date(), from = new Date(now.getFullYear(), now.getMonth() - 1, 1), to = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const seen = new Set<number>(Object.keys(codes.alag ?? {}).map(Number));
  try {
    const { hours } = await getExportLines(iso(from), iso(to));
    for (const h of hours.values()) for (const [p, v] of Object.entries(h.alag)) if (v > 0) seen.add(Number(p));
  } catch { /* engin gögn: aðeins vistuð gildi */ }
  return {
    codes, alagPcts: [...seen].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b),
    connected: integ ? { id: integ.id as string, company: null, lastSync: (integ.last_sync_at as string) ?? null, lastError: (integ.last_error as string) ?? null } : null,
  };
}

export async function saveDkCodes(input: DkCodes): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult();
  const c = await ctx(); if (!c) return { ok: false, error: "Aðeins stjórnendur og vaktstjórar" };
  const alag: Record<string, string> = {};
  for (const [p, v] of Object.entries(input.alag ?? {})) { const k = String(Number(p)); if (Number(k) > 0 && code(v)) alag[k] = code(v); }
  const codes: DkCodes = { dagvinna: code(input.dagvinna), yfirvinna: code(input.yfirvinna), alag };
  if (!codes.dagvinna) return { ok: false, error: "Settu inn launalið fyrir dagvinnu" };
  const { error } = await createAdminClient().from("companies").update({ dk_paycodes: codes }).eq("id", c.company);
  if (error) { console.error("[dk] codes", error.message); return { ok: false, error: "Tókst ekki að vista launaliðina" }; }
  await logAudit(c.supabase, c.company, c.userId, { action: "integration.dk_codes", entity: "companies", detail: "Launaliðir DK vistaðir" });
  revalidatePath("/stillingar"); revalidatePath("/launakeyrslur");
  return { ok: true };
}
