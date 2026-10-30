import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

// Push fyrir ný skilaboð í spjalli — sama fyrir vef (sendChatMessage) og app (/api/app/notify).
// Hópspjall: titill = nafn hópsins, texti = „Nafn: skilaboð“ (eins og Messenger) svo það sést strax
// að þetta er úr hópnum. Beint spjall: titill = sendandi. Smellt í appinu → opnar þráðinn.
export async function pushChatMessage(messageId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: m } = await admin.from("messages").select("channel_id, sender_id, company_id, body, kind").eq("id", messageId).maybeSingle();
    if (!m) return;
    const channelId = m.channel_id as string;
    const [{ data: mems }, { data: ch }, { data: emp }] = await Promise.all([
      admin.from("channel_members").select("user_id").eq("channel_id", channelId).limit(50),
      admin.from("channels").select("name, kind").eq("id", channelId).maybeSingle(),
      admin.from("employees").select("full_name").eq("company_id", m.company_id as string).eq("user_id", m.sender_id as string).maybeSingle(),
    ]);
    const sender = String(emp?.full_name ?? "").split(/\s+/)[0] || "Ný skilaboð";
    const kind = m.kind as string;
    const preview = kind === "image" ? "📷 Mynd" : kind === "audio" ? "🎤 Talskilaboð" : kind === "file" ? `📎 ${String(m.body ?? "Skjal")}` : String(m.body ?? "").slice(0, 90);
    const group = ch?.kind === "group";
    const payload = group
      ? { title: (ch?.name as string | null) || "Hópspjall", body: `${sender}: ${preview}` }
      : { title: sender, body: preview };
    await Promise.all((mems ?? []).filter((x) => x.user_id !== m.sender_id)
      .map((x) => sendPushToUser(x.user_id as string, { ...payload, url: "/spjall", appUrl: `/spjall/${channelId}`, tag: `chat-${channelId}` })));
  } catch { /* push is best-effort */ }
}
