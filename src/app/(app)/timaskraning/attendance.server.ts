import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type Attendance = { onShift: number; live: boolean };

/** Count employees currently clocked in (open punches today) — fed by kiosk + app. */
export async function getTodayAttendance(): Promise<Attendance> {
  if (!isSupabaseConfigured()) return { onShift: 5, live: false };
  try {
    const supabase = await createClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from("punches")
      .select("id", { count: "exact", head: true })
      .is("clock_out", null)
      .gte("clock_in", start.toISOString());
    if (error) return { onShift: 5, live: false };
    return { onShift: count ?? 0, live: true };
  } catch {
    return { onShift: 5, live: false };
  }
}
