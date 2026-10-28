"use server";

import { revalidatePath } from "next/cache";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import { notifyEmployees, notifyManagers } from "@/lib/push";
import { getRights, type EmployeeRights } from "@/lib/rights.server";

// Réttindi og fjarvistir á starfsmannaspjaldi: lesa stöðu, skrá veikindi/frí, uppfæra orlofsprósentu.

type Result = { ok: boolean; demo?: boolean; error?: string; warning?: string };
export type AbsenceType = "veikindi" | "veikindi_barns" | "orlof" | "olaunad";
const TYPES: AbsenceType[] = ["veikindi", "veikindi_barns", "orlof", "olaunad"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LBL: Record<AbsenceType, string> = { veikindi: "Veikindi", veikindi_barns: "Veikindi barns", orlof: "Orlof", olaunad: "Launalaust frí" };

async function ctxOf() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: me } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!me?.company_id) return { error: "Fyrirtæki fannst ekki" as const };
  if (me.role !== "owner" && me.role !== "manager") return { error: "Aðeins stjórnendur geta skráð fjarvistir" as const };
  return { supabase, company: me.company_id as string, userId: user.id };
}

/** Réttindastaða eins starfsmanns (eða allra ef id vantar) — RLS: stjórnendur fyrirtækisins. */
export async function getEmployeeRights(employeeId?: string): Promise<EmployeeRights[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    return await getRights(supabase, employeeId ? [employeeId] : undefined);
  } catch (e) {
    console.error("getEmployeeRights", e);
    return [];
  }
}

/** Skrá fjarvist (samþykkt strax). freeShifts = vaktir starfsmannsins þessa daga verða lausar vaktir. */
export async function registerAbsence(input: { employeeId: string; type: AbsenceType; from: string; to: string; note?: string; freeShifts?: boolean }): Promise<Result> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (!TYPES.includes(input.type) || !ISO.test(input.from) || !ISO.test(input.to) || input.to < input.from) return { ok: false, error: "Veldu tegund og dagsetningar" };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { supabase, company, userId } = ctx;
    const { data: emp } = await supabase.from("employees").select("id, full_name").eq("id", input.employeeId).eq("company_id", company).maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const row = { company_id: company, employee_id: emp.id, type: input.type, from_date: input.from, to_date: input.to, status: "approved", note: input.note?.trim() || null };
    let ins = await supabase.from("leave_requests").insert(row);
    if (ins.error && /note/.test(ins.error.message)) { const { note: _n, ...rest } = row; void _n; ins = await supabase.from("leave_requests").insert(rest); } // fyrir 0096
    if (ins.error) return { ok: false, error: userError(ins.error) };
    let freed = 0;
    if (input.freeShifts) {
      const { data } = await supabase.from("shifts").update({ employee_id: null, note: `Laus vegna fjarvistar (${LBL[input.type].toLowerCase()})` })
        .eq("company_id", company).eq("employee_id", emp.id).gte("date", input.from).lte("date", input.to).select("id");
      freed = data?.length ?? 0;
      // Laus vakt í dag eða síðar → starfsfólk fær tilkynningu og getur sótt um (sama og „Laus vakt“ í Vaktaplani).
      const today = new Date().toISOString().slice(0, 10);
      if (freed && input.to >= today) {
        const d = (iso: string) => { const [, m, dd] = iso.split("-"); return `${+dd}.${+m}.`; };
        void notifyEmployees(company, { title: freed > 1 ? "Lausar vaktir" : "Laus vakt", body: `${d(input.from)}${input.to !== input.from ? `–${d(input.to)}` : ""} · ${freed > 1 ? `${freed} vaktir` : "vakt"} laus vegna forfalla. Sæktu um í appinu.`, url: "/mitt-svaedi", tag: "open-shift" });
      }
    }
    await logAudit(supabase, company, userId, {
      action: "leave.register", entity: "employee", entityId: emp.id as string,
      detail: `${LBL[input.type]} skráð — ${emp.full_name} ${input.from}${input.to !== input.from ? `–${input.to}` : ""}${freed ? ` · ${freed} vaktir lausar` : ""}`,
    });
    // Viðvörun ef veikindaréttur er búinn eða að klárast — og tilkynning til stjórnenda.
    let warning: string | undefined;
    if (input.type === "veikindi" || input.type === "veikindi_barns") {
      const [r] = await getRights(supabase, [emp.id as string]);
      if (r) {
        const first = (r.name ?? "").split(/\s+/)[0];
        if (input.type === "veikindi" && r.sick.right && r.sick.over) warning = `${first} hefur notað ${r.sick.used} veikindadaga á 12 mánuðum — rétturinn er ${r.sick.right.label}. Umframdagar eru ekki greiddir skv. kjarasamningi.`;
        else if (input.type === "veikindi" && r.sick.right && r.sick.near) warning = `${first} hefur notað ${r.sick.used} af um ${r.sick.right.days} veikindadögum á 12 mánuðum.`;
        else if (input.type === "veikindi_barns" && r.child.over) warning = `${first} hefur notað ${r.child.used} daga vegna veikinda barna — rétturinn er ${r.child.label}.`;
        if (warning) void notifyManagers(company, { title: "Veikindaréttur", body: warning, url: `/starfsfolk/${emp.id}`, tag: `sick-${emp.id}` });
      }
    }
    revalidatePath("/starfsfolk");
    revalidatePath("/vaktaplan");
    return { ok: true, warning: [warning, freed ? `${freed} ${freed === 1 ? "vakt varð laus" : "vaktir urðu lausar"} í vaktaplaninu.` : ""].filter(Boolean).join(" ") || undefined };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function deleteAbsence(id: string): Promise<Result> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await ctx.supabase.from("leave_requests").delete().eq("id", id).eq("company_id", ctx.company)
      .select("employee_id, type, from_date, to_date").maybeSingle();
    if (error) return { ok: false, error: userError(error) };
    if (data) await logAudit(ctx.supabase, ctx.company, ctx.userId, {
      action: "leave.delete", entity: "employee", entityId: data.employee_id as string, detail: `Fjarvist eytt — ${data.type} ${data.from_date}–${data.to_date}`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Setja orlofsprósentu starfsmanns á réttinn skv. kjarasamningi (t.d. 10,17 → 10,64 eftir 6 mánuði). */
export async function applyOrlofPct(employeeId: string, pct: number): Promise<Result> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (!(pct >= 10.17 && pct <= 20)) return { ok: false, error: "Ógild orlofsprósenta" };
  try {
    const ctx = await ctxOf();
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emp } = await ctx.supabase.from("employees").select("id, full_name, orlof").eq("id", employeeId).eq("company_id", ctx.company).maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const prev = (emp.orlof as { mode?: string; pct?: number } | null) ?? {};
    const { error } = await ctx.supabase.from("employees").update({ orlof: { mode: prev.mode ?? "accrue_amount", pct } }).eq("id", employeeId);
    if (error) return { ok: false, error: userError(error) };
    await logAudit(ctx.supabase, ctx.company, ctx.userId, {
      action: "employee.update", entity: "employee", entityId: employeeId,
      detail: `Orlofsprósenta ${String(prev.pct ?? 10.17).replace(".", ",")} → ${String(pct).replace(".", ",")} % skv. kjarasamningi`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
