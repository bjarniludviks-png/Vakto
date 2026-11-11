// Sjálfvirk stimplun (migration 0112). Stýrikerfið fylgist með svæðum (vinnustöðunum) og vekur appið
// AÐEINS þegar síminn kemur inn á eða fer út af svæði — engin samfelld rakning, appið les ekki
// staðsetningu þess á milli. Atburðurinn fer á /api/app/auto-punch, sem ákveður (eftir stillingu
// vinnustaðarins og vaktaplani) hvort stimplað er beint eða tillaga búin til.
//
// Þessi skrá verður að vera flutt inn efst í app/_layout.tsx svo bakgrunnsverkið sé skilgreint þegar
// stýrikerfið ræsir appið í bakgrunni við atburð.
import { Platform } from "react-native";
import * as Location from "expo-location";
import type * as TaskManagerT from "expo-task-manager";
import { supabase } from "./supabase";

export const AUTO_PUNCH_TASK = "vakto-auto-punch";
// Eldri build (fyrir 0112) hafa ekki native-hluta expo-task-manager. Ef þessi kóði berst þangað með OTA
// má appið ekki hrynja — þá er sjálfvirk stimplun einfaldlega ekki í boði á þeim síma.
let TaskManager: typeof TaskManagerT | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TaskManager = require("expo-task-manager") as typeof TaskManagerT;
} catch {
  TaskManager = null;
}
const API = (process.env.EXPO_PUBLIC_API_URL ?? "https://www.vakto.is").replace(/\/$/, "");
const platformOk = Platform.OS === "ios" || Platform.OS === "android";

export type AutoPunchMode = "off" | "suggest" | "auto";
export type Region = { id: string; name: string; lat: number; lng: number; radius: number };
export type Suggestion = { id: string; kind: "in" | "out"; at: string; location: string | null; createdAt: string };
export type AutoPunchState = { mode: AutoPunchMode; unscheduled: boolean; consent: boolean; regions: Region[]; pending: Suggestion[]; clockoutHours: number | null };

async function call<T>(method: "GET" | "POST", body?: unknown): Promise<T | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const r = await fetch(`${API}/api/app/auto-punch`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Atburður frá stýrikerfinu → þjónninn. Staðsetningin er síðasta þekkta staðsetning símans (engin ný
 *  mæling ræst); sé hún ekki til eða gömul er miðja svæðisins send með óvissu = radíus svæðisins. */
async function report(type: "enter" | "exit", region: Location.LocationRegion): Promise<void> {
  if (!region.identifier) return;
  let pos: { lat: number; lng: number; acc: number } | null = null;
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    if (last) pos = { lat: last.coords.latitude, lng: last.coords.longitude, acc: Math.round(last.coords.accuracy ?? 0) };
  } catch { /* engin staðsetning */ }
  if (!pos) pos = { lat: region.latitude, lng: region.longitude, acc: Math.round(region.radius) };
  await call("POST", { action: "event", type, locationId: region.identifier, ...pos, at: new Date().toISOString() });
}

const native = platformOk && !!TaskManager;

if (native && TaskManager) try {
  if (!TaskManager.isTaskDefined(AUTO_PUNCH_TASK)) TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(AUTO_PUNCH_TASK, async ({ data, error }) => {
    if (error || !data?.region) return;
    if (data.eventType === Location.GeofencingEventType.Enter) await report("enter", data.region);
    else if (data.eventType === Location.GeofencingEventType.Exit) await report("exit", data.region);
  });
} catch (e) {
  console.warn("auto-punch task", e);
}

export async function getAutoPunch(): Promise<AutoPunchState | null> {
  const r = await call<{ ok: boolean } & AutoPunchState>("GET");
  return r?.ok ? r : null;
}

export async function backgroundAllowed(): Promise<boolean> {
  if (!native) return false;
  try { return (await Location.getBackgroundPermissionsAsync()).status === "granted"; } catch { return false; }
}

async function stopFencing(): Promise<void> {
  if (!native) return;
  try { if (await Location.hasStartedGeofencingAsync(AUTO_PUNCH_TASK)) await Location.stopGeofencingAsync(AUTO_PUNCH_TASK); } catch { /* ekki í gangi */ }
}

/** Kallað við innskráningu og þegar appið opnast: svæðin uppfærð (nýr staður, breyttur radíus),
 *  eða vöktun stöðvuð ef slökkt hefur verið (af starfsmanni eða vinnustað). */
export async function syncAutoPunch(): Promise<AutoPunchState | null> {
  if (!native) return null;
  const s = await getAutoPunch();
  if (!s) return null; // net niðri: breytum engu
  if (s.mode === "off" || !s.consent || !s.regions.length || !(await backgroundAllowed())) {
    await stopFencing();
    return s;
  }
  try {
    await Location.startGeofencingAsync(AUTO_PUNCH_TASK, s.regions.map((r) => ({
      identifier: r.id, latitude: r.lat, longitude: r.lng, radius: r.radius, notifyOnEnter: true, notifyOnExit: true,
    })));
  } catch (e) {
    console.warn("geofencing", e);
  }
  return s;
}

export type EnableResult = "ok" | "unsupported" | "denied_foreground" | "denied_background" | "error";

/** Starfsmaður kveikir sjálfur: fyrst „meðan appið er notað“, svo „Alltaf“ (iOS/Android krefjast þessarar röðar). */
export async function enableAutoPunch(): Promise<EnableResult> {
  if (!native) return "unsupported";
  const fg = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (fg?.status !== "granted") return "denied_foreground";
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
  if (bg?.status !== "granted") return "denied_background";
  const r = await call<{ ok: boolean }>("POST", { action: "consent", on: true });
  if (!r?.ok) return "error";
  await syncAutoPunch();
  return "ok";
}

export async function disableAutoPunch(): Promise<boolean> {
  await stopFencing();
  const r = await call<{ ok: boolean }>("POST", { action: "consent", on: false });
  return !!r?.ok;
}

/** Útskráning: hætta að fylgjast með svæðum á þessum síma (samþykkið helst á aðganginum). */
export async function stopAutoPunchOnDevice(): Promise<void> {
  await stopFencing();
}

export async function decideSuggestion(id: string, confirm: boolean, at?: string): Promise<{ ok: boolean; error?: string }> {
  const r = await call<{ ok: boolean; error?: string }>("POST", { action: "decide", id, confirm, at });
  return r ?? { ok: false, error: "Ekkert samband — reyndu aftur" };
}
