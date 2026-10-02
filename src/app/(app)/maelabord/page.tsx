import DashboardScreen from "./dashboard-screen";
import { getDashboard } from "./dashboard.server";
import { getWhoIsOn } from "../timaskraning/attendance.server";
import { getPendingRequests } from "../vaktaplan/requests.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";
import { checkNoShows } from "@/lib/noshow.server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Fornafn innskráðs notanda fyrir kveðjuna efst. */
async function firstName(): Promise<string> {
  if (!isSupabaseConfigured()) return "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const { data } = await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle();
    return String(data?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
  } catch { return ""; }
}

export default async function MaelabordPage() {
  after(() => checkNoShows());
  const scope = await getMyScope();
  const [view, board, reqs, name] = await Promise.all([getDashboard(scope.departments), getWhoIsOn(), getPendingRequests(), firstName()]);
  const d = scope.departments;
  return <DashboardScreen laborPct={view.laborPct} laborCostWeek={view.laborCostWeek} hoursWeek={view.hoursWeek} onboarding={view.onboarding} live={view.live} onNow={scopeRows(d, board.rows)} missing={scopeRows(d, board.missing)} pending={reqs.items.length} firstName={name} />;
}
