import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { mentionedIds } from "@/lib/mentions";

// @-merkingar í athugasemdum fréttaveitunnar — sama fyrir vef (addPostComment) og app (/api/app/notify).
// Sá sem er nefndur fær „Jón nefndi þig“; aldrei sá sem skrifaði.
export async function pushCommentMentions(commentId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: c } = await admin.from("post_comments").select("sender_id, company_id, body").eq("id", commentId).maybeSingle();
    const body = String(c?.body ?? "");
    if (!c || !body.includes("@")) return;
    const { data: emps } = await admin.from("employees").select("user_id, full_name").eq("company_id", c.company_id as string).not("user_id", "is", null);
    const people = (emps ?? []).filter((e) => e.full_name).map((e) => ({ userId: e.user_id as string, name: e.full_name as string }));
    const tagged = mentionedIds(body, people).filter((u) => u !== c.sender_id).slice(0, 20);
    if (!tagged.length) return;
    const me = String(people.find((p) => p.userId === c.sender_id)?.name ?? "").split(/\s+/)[0] || "Einhver";
    await Promise.all(tagged.map((u) => sendPushToUser(u, { title: `${me} nefndi þig`, body: body.trim().slice(0, 90), url: "/frettaveita", tag: `feed-mention-${commentId}` })));
  } catch { /* push is best-effort */ }
}
