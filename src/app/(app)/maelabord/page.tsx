import DashboardScreen from "./dashboard-screen";
import { getDashboard } from "./dashboard.server";
import { getWhoIsOn } from "../timaskraning/attendance.server";
import { getPendingRequests } from "../vaktaplan/requests.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";
import { checkNoShows } from "@/lib/noshow.server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DashPrefs } from "./widgets";
import { getSettlementsDue } from "@/lib/terminations.server";

/** Fornafn innskráðs notanda fyrir kveðjuna efst + sérstillingar mælaborðsins (0077). */
async function me(): Promise<{ name: string; prefs: DashPrefs | null }> {
  if (!isSupabaseConfigured()) return { name: "", prefs: null };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { name: "", prefs: null };
    let res = await supabase.from("users").select("full_name, dashboard_prefs").eq("id", user.id).maybeSingle();
    if (res.error) res = await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle() as typeof res; // fyrir 0077
    const name = String(res.data?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    return { name, prefs: (res.data as { dashboard_prefs?: DashPrefs | null } | null)?.dashboard_prefs ?? null };
  } catch { return { name: "", prefs: null }; }
}

export default async function MaelabordPage() {
  after(() => checkNoShows());
  const scope = await getMyScope();
  const [view, board, reqs, name, due] = await Promise.all([getDashboard(scope.departments), getWhoIsOn(), getPendingRequests(), me(), scope.role === "owner" ? getSettlementsDue() : Promise.resolve([])]); // lokauppgjör: Launakeyrslur eru aðeins fyrir eiganda
  const d = scope.departments;
  return <DashboardScreen laborPct={view.laborPct} laborCostWeek={view.laborCostWeek} hoursWeek={view.hoursWeek} onboarding={view.onboarding} live={view.live} onNow={scopeRows(d, board.rows)} missing={scopeRows(d, board.missing)} pending={reqs.items.length} firstName={name.name} prefs={name.prefs} settlements={due.length} />;
}
