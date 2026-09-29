// Orlofsstaða starfsmannsins sjálfs — sama reikniregla og vefurinn (src/lib/orlof.ts).
import { supabase } from "../supabase";
import { orlofBalance, orlofYearStart, type OrlofBalance } from "../orlof";
import type { Me } from "./me";

export async function getMyOrlof(me: Me): Promise<OrlofBalance | null> {
  const since = orlofYearStart();
  const [punchRes, leaveRes, empRes] = await Promise.all([
    supabase.from("punches").select("clock_in, clock_out")
      .eq("employee_id", me.empId).gte("clock_in", since).not("clock_out", "is", null),
    supabase.from("leave_requests").select("from_date, to_date, status, type")
      .eq("employee_id", me.empId).eq("type", "orlof").gte("to_date", since),
    supabase.from("employees").select("orlof").eq("id", me.empId).maybeSingle(),
  ]);
  if (punchRes.error && leaveRes.error) return null;
  let hours = 0;
  for (const p of punchRes.data ?? []) {
    const h = (new Date(p.clock_out as string).getTime() - new Date(p.clock_in as string).getTime()) / 3600000;
    if (h > 0 && h < 24) hours += h;
  }
  return orlofBalance({
    hoursWorked: hours,
    orlof: (empRes.data?.orlof as { mode?: string; pct?: number } | null) ?? null,
    leaves: (leaveRes.data ?? []) as { from_date: string; to_date: string; status: string; type: string }[],
  });
}
