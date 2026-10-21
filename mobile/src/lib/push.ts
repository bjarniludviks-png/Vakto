// Push-tilkynningar í símann (Expo push). Tokenið er vistað í push_subscriptions
// með endpoint = "expo:<token>" (sama tafla og vefpush; þjónninn sendir á Expo
// fyrir þau endpoint). Þegjandi no-op í Expo Go / hermi án leyfis.
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import type { Me } from "./api/me";
import { getDnd } from "./mute";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

let registered: string | null = null;

export async function registerForPush(me: Me): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    if (await getDnd()) { await unregisterPush(); return null; } // Ekki trufla: ekkert token á þjóni
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "VAKTO", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 100, 200], lightColor: "#e9700f" });
    }
    const { status: cur } = await Notifications.getPermissionsAsync();
    let status = cur;
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const tok = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (!tok || tok === registered) return tok;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    await supabase.from("push_subscriptions").upsert(
      { user_id: auth.user.id, company_id: me.companyId, endpoint: `expo:${tok}`, p256dh: Platform.OS, auth: Device.modelName ?? "" },
      { onConflict: "endpoint" }
    );
    registered = tok;
    return tok;
  } catch {
    return null;
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    let tok = registered;
    if (!tok && Device.isDevice) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
        tok = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
      }
    }
    if (tok) await supabase.from("push_subscriptions").delete().eq("endpoint", `expo:${tok}`);
  } catch { /* ignore */ }
  registered = null;
}

/** Kallað þegar appið opnast: ef Ekki-trufla er útrunnið → skrá token aftur. */
export async function syncPushWithDnd(me: Me): Promise<void> {
  const dnd = await getDnd();
  if (dnd) { await unregisterPush(); return; }
  await registerForPush(me);
}

export async function pushEnabled(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/* Smellt á tilkynningu → réttur skjár. Þjónninn setur data.url (t.d. "/samningur?id=…", sjá
 * appUrl í src/lib/push.ts á vefnum). Aðeins leiðir sem eru til í appinu; annað opnar appið bara. */
const APP_ROUTES = ["samningur", "skjol", "frettaveita"];
const handled = new Set<string>();

function routeOf(r: Notifications.NotificationResponse | null | undefined): string | null {
  if (!r) return null;
  const id = r.notification.request.identifier;
  if (handled.has(id)) return null;
  const url = (r.notification.request.content.data as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || !url.startsWith("/")) return null;
  if (!APP_ROUTES.includes(url.slice(1).split(/[?/#]/)[0])) return null;
  handled.add(id);
  return url;
}

/** Kaldræsing: tilkynningin sem opnaði appið (einu sinni), eða null. */
export async function launchRoute(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try { return routeOf(await Notifications.getLastNotificationResponseAsync()); } catch { return null; }
}

/** Appið opið/í bakgrunni: kallar á go(url) þegar smellt er á tilkynningu. Skilar afskráningu. */
export function onPushTap(go: (url: string) => void): () => void {
  if (Platform.OS === "web") return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => { const u = routeOf(r); if (u) go(u); });
    return () => sub.remove();
  } catch { return () => {}; }
}
