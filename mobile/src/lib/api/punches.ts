// Clock in/out + punch history. Requires migration 0041 (punches self insert/update).
// Geofence (0055): when the company has it on, one position goes with each
// punch; the database trigger judges it (flag, or refuse clock-in in block mode).
import * as Location from "expo-location";
import { supabase } from "../supabase";
import type { Me } from "./me";
import { notifyServer } from "./notify";

export type GeofenceMode = "off" | "flag" | "block";
export type PunchPos = { lat: number; lng: number; acc: number };

/** The company's mode — nothing is asked for or sent while it's "off". */
export async function getGeofenceMode(): Promise<GeofenceMode> {
  const { data, error } = await supabase.rpc("my_geofence_mode");
  return error ? "off" : ((data as GeofenceMode | null) ?? "off");
}

/** One foreground position for a punch. null when denied or unavailable. */
export async function punchPosition(): Promise<PunchPos | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy ?? 0) };
  } catch {
    return null;
  }
}

/** Friendly text for the geofence trigger's refusals (mirrors the web). */
function punchError(message: string): string {
  const m = message.match(/GEOFENCE_OUTSIDE:(\d+)/);
  if (m) {
    const d = Number(m[1]);
    const far = d >= 1000 ? `${(Math.round(d / 100) / 10).toString().replace(".", ",")} km` : `${d} m`;
    return `Þú ert utan vinnusvæðis (${far} frá næsta stað) — ekki hægt að stimpla inn hér.`;
  }
  if (message.includes("GEOFENCE_MISSING")) return "Staðsetning þarf til að stimpla inn — leyfðu staðsetningu í stillingum símans og reyndu aftur.";
  return "Stimplun tókst ekki — reyndu aftur.";
}

export async function clockIn(me: Me, pos?: PunchPos | null): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("punches").insert({
    company_id: me.companyId,
    employee_id: me.empId,
    clock_in: new Date().toISOString(),
    source: "app",
    ...(pos ? { in_lat: pos.lat, in_lng: pos.lng, in_acc: pos.acc } : {}),
  });
  if (error) return { ok: false, error: punchError(error.message) };
  void notifyServer("punch"); // vefurinn athugar „mætti ekki“ hjá hinum
  return { ok: true };
}

export async function clockOut(me: Me, pos?: PunchPos | null): Promise<{ ok: boolean; error?: string }> {
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
    .update({ clock_out: new Date().toISOString(), ...(pos ? { out_lat: pos.lat, out_lng: pos.lng, out_acc: pos.acc } : {}) })
    .eq("id", id);
  return error ? { ok: false, error: punchError(error.message) } : { ok: true };
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
