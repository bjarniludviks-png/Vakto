"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const DEMO_COMPANY = "00000000-0000-0000-0000-0000000000c0"; // Kaffi Krónan (seed)

export type PunchResult = { ok: boolean; demo?: boolean; error?: string };
export type KioskEmp = { id: string; initials: string; name: string; color: string; on: boolean; inTime: string };
export type KioskData = { company: string; employees: KioskEmp[] };

const ini = (s: string) => s.trim().split(/\s+/)[0].slice(0, 2).toUpperCase();
const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const last4 = (kt: string | null) => (kt ?? "").replace(/\D/g, "").slice(-4);

/** Load a company's employees for the shared kiosk tablet (no kennitala leaves the server). */
export async function getKioskData(companyId: string): Promise<KioskData | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = createAdminClient();
    const { data: company } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
    if (!company) return null;
    const { data: emps } = await admin
      .from("employees").select("id, full_name, avatar_color")
      .eq("company_id", companyId).eq("status", "active").order("full_name");
    if (!emps) return { company: company.name as string, employees: [] };

    // Open punches (clocked in now).
    const { data: open } = await admin
      .from("punches").select("employee_id, clock_in").eq("company_id", companyId).is("clock_out", null);
    const openMap = new Map((open ?? []).map((p) => [p.employee_id as string, p.clock_in as string]));

    const employees: KioskEmp[] = emps.map((e) => ({
      id: e.id as string,
      name: e.full_name as string,
      initials: ini(e.full_name as string),
      color: (e.avatar_color as string) ?? "#5b50e6",
      on: openMap.has(e.id as string),
      inTime: openMap.has(e.id as string) ? hm(openMap.get(e.id as string)!) : "—",
    }));
    return { company: company.name as string, employees };
  } catch {
    return null;
  }
}

/** Clock in/out via PIN = last 4 digits of kennitala. Toggles based on open punch. */
export async function kioskPunchByPin(
  companyId: string, employeeId: string, pin: string,
): Promise<PunchResult & { into?: boolean; time?: string }> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const admin = createAdminClient();
    const { data: emp } = await admin
      .from("employees").select("id, kennitala").eq("id", employeeId).eq("company_id", companyId).maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const code = last4(emp.kennitala as string | null);
    if (!code) return { ok: false, error: "Engin kennitala skráð á starfsmann" };
    if (code !== pin) return { ok: false, error: "Rangur kóði — reyndu aftur" };

    const { data: open } = await admin
      .from("punches").select("id").eq("employee_id", employeeId)
      .is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle();
    const now = new Date().toISOString();
    if (open) {
      const { error } = await admin.from("punches").update({ clock_out: now }).eq("id", open.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, into: false, time: hm(now) };
    }
    const { error } = await admin.from("punches").insert({
      company_id: companyId, employee_id: employeeId, clock_in: now, source: "kiosk",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, into: true, time: hm(now) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Legacy demo punch (name-based, Kaffi Krónan) — used only in the unbound demo kiosk. */
export async function kioskPunch(fullName: string, into: boolean): Promise<PunchResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const admin = createAdminClient();
    const { data: emp } = await admin
      .from("employees").select("id").eq("company_id", DEMO_COMPANY).eq("full_name", fullName).maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const now = new Date().toISOString();
    if (into) {
      const { error } = await admin.from("punches").insert({ company_id: DEMO_COMPANY, employee_id: emp.id, clock_in: now, source: "kiosk" });
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: open } = await admin.from("punches").select("id").eq("employee_id", emp.id).is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle();
      if (open) { const { error } = await admin.from("punches").update({ clock_out: now }).eq("id", open.id); if (error) return { ok: false, error: error.message }; }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
