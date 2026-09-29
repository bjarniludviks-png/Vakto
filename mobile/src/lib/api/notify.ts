// Tilkynningar úr appinu. Appið talar beint við Supabase (engar server actions),
// svo push til vaktstjóra/starfsmanns fer gegnum vefinn: /api/app/notify sannreynir
// innskráða notandann og að hann eigi hlut að færslunni áður en push er sent.
import { supabase } from "../supabase";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "https://www.vakto.is").replace(/\/$/, "");

export type NotifyKind = "leave_request" | "leave_decided" | "swap_request" | "punch";

/** Fire-and-forget: a failed notification never blocks the action itself. */
export async function notifyServer(kind: NotifyKind, id?: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${API}/api/app/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, id }),
    });
  } catch {
    /* offline or server unreachable — the request itself is already saved */
  }
}
