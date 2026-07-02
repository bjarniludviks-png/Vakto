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
  if (!init()) { console.log(`[push] skipped (no VAPID): "${payload.title}" → ${userId}`); return; }
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    for (const s of data ?? []) {
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
