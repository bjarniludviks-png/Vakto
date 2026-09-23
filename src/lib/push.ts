import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-side web push. No-op (logged) until VAPID keys are set.
const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJ = process.env.VAPID_SUBJECT || "mailto:hjalp@vakto.is";
let ready = false;
function init(): boolean {
  if (!ready && PUB && PRIV) { webpush.setVapidDetails(SUBJ, PUB, PRIV); ready = true; }
  return ready;
}
export function pushConfigured(): boolean { return !!(PUB && PRIV); }

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Notify all owners/managers of a company (e.g. a new employee request). */
export async function notifyManagers(companyId: string | null | undefined, payload: PushPayload): Promise<void> {
  if (!companyId) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("users").select("id").eq("company_id", companyId).in("role", ["owner", "manager"]);
    for (const u of data ?? []) await sendPushToUser(u.id as string, payload);
  } catch { /* best-effort */ }
}

/** Send a push to the auth user linked to an employee (employees.user_id). */
export async function notifyEmployee(employeeId: string | null | undefined, payload: PushPayload): Promise<void> {
  if (!employeeId) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("employees").select("user_id").eq("id", employeeId).maybeSingle();
    if (data?.user_id) await sendPushToUser(data.user_id as string, payload);
  } catch { /* best-effort */ }
}

/** Send a push to all of a user's subscribed devices; prunes dead subscriptions. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    if (!init()) {
      // Engir VAPID-lyklar: sendum samt á Expo-tæki (þarf enga lykla).
      const { data } = await admin.from("push_subscriptions").select("id, endpoint").eq("user_id", userId).like("endpoint", "expo:%");
      if (data?.length) await sendExpo(data.map((s) => ({ id: s.id as string, token: (s.endpoint as string).slice(5) })), payload, admin);
      else console.log(`[push] skipped (no VAPID): "${payload.title}" → ${userId}`);
      return;
    }
    const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    // Expo-tokens (appið) fara á Expo push API; hitt er vefpush.
    const expo = (data ?? []).filter((s) => (s.endpoint as string).startsWith("expo:"));
    if (expo.length) await sendExpo(expo.map((s) => ({ id: s.id as string, token: (s.endpoint as string).slice(5) })), payload, admin);
    for (const s of (data ?? []).filter((s) => !(s.endpoint as string).startsWith("expo:"))) {
      const sub = { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } };
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id as string);
      }
    }
  } catch (e) {
    console.log("[push] error", e instanceof Error ? e.message : e);
  }
}

/** Expo push (appið): https://docs.expo.dev/push-notifications/sending-notifications/ */
async function sendExpo(devices: { id: string; token: string }[], payload: PushPayload, admin: ReturnType<typeof createAdminClient>): Promise<void> {
  try {
    const r = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(devices.map((d) => ({ to: d.token, title: payload.title, body: payload.body, sound: "default", data: { url: payload.url ?? "/", tag: payload.tag ?? "" }, channelId: "default" }))),
    });
    const j = (await r.json()) as { data?: { status: string; details?: { error?: string } }[] };
    (j.data ?? []).forEach(async (t, i) => {
      if (t.status === "error" && t.details?.error === "DeviceNotRegistered") await admin.from("push_subscriptions").delete().eq("id", devices[i].id);
    });
  } catch (e) {
    console.log("[push] expo error", e instanceof Error ? e.message : e);
  }
}
