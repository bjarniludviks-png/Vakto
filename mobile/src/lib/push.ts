// Push-tilkynningar í símann (Expo push). Tokenið er vistað í push_subscriptions
// með endpoint = "expo:<token>" (sama tafla og vefpush; þjónninn sendir á Expo
// fyrir þau endpoint). Þegjandi no-op í Expo Go / hermi án leyfis.
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import type { Me } from "./api/me";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

let registered: string | null = null;

export async function registerForPush(me: Me): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
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
  if (!registered) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", `expo:${registered}`);
  registered = null;
}

export async function pushEnabled(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}
