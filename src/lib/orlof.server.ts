import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { orlofBalance, orlofYearStart, type OrlofBalance } from "./orlof";

/** Orlofsstaða fyrir einn eða fleiri starfsmenn (sama fyrirtæki). RLS gildir:
 *  starfsmaður fær sína, stjórnandi alla í fyrirtækinu. Þolir ef dálkar vantar. */
export async function getOrlofBalances(
  supabase: SupabaseClient,
  employeeIds: string[],
): Promise<Map<string, OrlofBalance>> {
  const out = new Map<string, OrlofBalance>();
  const ids = [...new Set(employeeIds)].filter(Boolean);
  if (!ids.length) return out;
  const since = orlofYearStart();
  const [punchRes, leaveRes, empRes] = await Promise.all([
    supabase.from("punches").select("employee_id, clock_in, clock_out")
      .in("employee_id", ids).gte("clock_in", since).not("clock_out", "is", null),
    supabase.from("leave_requests").select("employee_id, from_date, to_date, status, type")
      .in("employee_id", ids).eq("type", "orlof").gte("to_date", since),
    supabase.from("employees").select("id, orlof").in("id", ids),
  ]);
  const hours = new Map<string, number>();
  for (const p of punchRes.data ?? []) {
    const h = (new Date(p.clock_out as string).getTime() - new Date(p.clock_in as string).getTime()) / 3600000;
    if (h > 0 && h < 24) hours.set(p.employee_id as string, (hours.get(p.employee_id as string) ?? 0) + h);
  }
  const orlofOf = new Map((empRes.data ?? []).map((e) => [e.id as string, e.orlof as { mode?: string; pct?: number } | null]));
  for (const id of ids) {
    out.set(id, orlofBalance({
      hoursWorked: hours.get(id) ?? 0,
      orlof: orlofOf.get(id) ?? null,
      leaves: (leaveRes.data ?? []).filter((l) => l.employee_id === id) as { from_date: string; to_date: string; status: string; type: string }[],
    }));
  }
  return out;
}
