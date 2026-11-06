"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { logAudit } from "@/lib/audit";
import { getExportLines } from "@/lib/payroll-export.server";

// DK: launaliðir fyrirtækisins í dk Laun (fyrir CSV-innlestur í launakeyrslu) — companies.dk_paycodes (0091).
export type DkCodes = { dagvinna?: string; yfirvinna?: string; alag?: Record<string, string> };
/** Deild + númer hennar í dk Laun (departments.dk_code, 0110). */
export type DkDept = { id: string; name: string; location: string; code: string };
export type DkSettings = { codes: DkCodes; alagPcts: number[]; depts: DkDept[]; connected: { id: string; company: string | null; lastSync: string | null; lastError: string | null } | null };

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
  const [{ data: co }, { data: integ }, depRes] = await Promise.all([
    db.from("companies").select("dk_paycodes").eq("id", c.company).maybeSingle(),
    db.from("company_integrations").select("id, last_sync_at, last_error").eq("company_id", c.company).eq("provider", "dk").maybeSingle(),
    db.from("departments").select("id, name, dk_code, locations!inner(name, company_id)").eq("locations.company_id", c.company),
  ]);
  const depts: DkDept[] = (depRes.error ? [] : depRes.data ?? []).map((d) => ({
    id: d.id as string, name: (d.name as string) ?? "",
    location: ((Array.isArray(d.locations) ? d.locations[0] : d.locations) as { name?: string } | null)?.name ?? "",
    code: (d.dk_code as string | null) ?? "",
  })).sort((a, b) => a.location.localeCompare(b.location, "is") || a.name.localeCompare(b.name, "is"));
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
    codes, depts, alagPcts: [...seen].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b),
    connected: integ ? { id: integ.id as string, company: null, lastSync: (integ.last_sync_at as string) ?? null, lastError: (integ.last_error as string) ?? null } : null,
  };
}

export async function saveDkCodes(input: DkCodes & { deptCodes?: Record<string, string> }): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult();
  const c = await ctx(); if (!c) return { ok: false, error: "Aðeins stjórnendur og vaktstjórar" };
  const alag: Record<string, string> = {};
  for (const [p, v] of Object.entries(input.alag ?? {})) { const k = String(Number(p)); if (Number(k) > 0 && code(v)) alag[k] = code(v); }
  const codes: DkCodes = { dagvinna: code(input.dagvinna), yfirvinna: code(input.yfirvinna), alag };
  if (!codes.dagvinna) return { ok: false, error: "Settu inn launalið fyrir dagvinnu" };
  const { error } = await createAdminClient().from("companies").update({ dk_paycodes: codes }).eq("id", c.company);
  if (error) { console.error("[dk] codes", error.message); return { ok: false, error: "Tókst ekki að vista launaliðina" }; }
  // Deildarnúmer — aðeins deildir þessa fyrirtækis.
  if (input.deptCodes && Object.keys(input.deptCodes).length) {
    const db = createAdminClient();
    const { data: mine } = await db.from("departments").select("id, locations!inner(company_id)").eq("locations.company_id", c.company);
    const ok = new Set((mine ?? []).map((d) => d.id as string));
    for (const [id, v] of Object.entries(input.deptCodes)) {
      if (!ok.has(id)) continue;
      const { error: e2 } = await db.from("departments").update({ dk_code: code(v) || null }).eq("id", id);
      if (e2) { console.error("[dk] dept code", e2.message); return { ok: false, error: "Tókst ekki að vista deildarnúmer" }; }
    }
  }
  await logAudit(c.supabase, c.company, c.userId, { action: "integration.dk_codes", entity: "companies", detail: "Launaliðir DK vistaðir" });
  revalidatePath("/stillingar"); revalidatePath("/launakeyrslur");
  return { ok: true };
}
