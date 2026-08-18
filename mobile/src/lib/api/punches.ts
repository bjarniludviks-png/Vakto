// Clock in/out + punch history. Requires migration 0041 (punches self insert/update).
import { supabase } from "../supabase";
import type { Me } from "./me";

export async function clockIn(me: Me): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("punches").insert({
    company_id: me.companyId,
    employee_id: me.empId,
    clock_in: new Date().toISOString(),
    source: "app",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function clockOut(me: Me): Promise<{ ok: boolean; error?: string }> {
  const { data: open } = await supabase
    .from("punches")
    .select("id")
    .eq("employee_id", me.empId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1);
  const id = open?.[0]?.id;
  if (!id) return { ok: false, error: "Engin opin stimplun fannst" };
  const { error } = await supabase
    .from("punches")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type PunchRow = { id: string; clockIn: string; clockOut: string | null; source: string };

export async function listMyPunches(me: Me, fromISO: string): Promise<PunchRow[]> {
  const { data } = await supabase
    .from("punches")
    .select("id, clock_in, clock_out, source")
    .eq("employee_id", me.empId)
    .gte("clock_in", fromISO)
    .order("clock_in", { ascending: false })
    .limit(100);
  return (data ?? []).map((p) => ({
    id: p.id,
    clockIn: p.clock_in,
    clockOut: p.clock_out,
    source: p.source,
  }));
}
