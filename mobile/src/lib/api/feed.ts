// Fréttaveita — direct-Supabase port of the web feed actions (posts/post_likes/post_comments).
import { supabase } from "../supabase";
import type { Me } from "./me";

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥"] as const;

export type FeedComment = { id: string; sender: string; body: string; at: string };

export type FeedPost = {
  id: string;
  sender: string;
  me: boolean;
  system: boolean;
  body: string;
  at: string;
  pinned: boolean;
  imageUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  reactions: { emoji: string; count: number }[];
  myReaction: string | null;
  comments: FeedComment[];
};

function ago(isoTs: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(isoTs).getTime()) / 60000));
  if (mins < 1) return "Rétt í þessu";
  if (mins < 60) return `${mins} mín`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} klst`;
  const d = new Date(isoTs);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export async function listPosts(me: Me): Promise<FeedPost[]> {
  const [{ data: posts }, { data: emps }, { data: auth }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, sender_id, body, created_at, image_url, file_url, file_name, pinned, post_likes(user_id, reaction), post_comments(id, sender_id, body, created_at)"
      )
      .eq("company_id", me.companyId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("employees")
      .select("user_id, full_name")
      .eq("company_id", me.companyId)
      .not("user_id", "is", null),
    supabase.auth.getUser(),
  ]);
  const names = new Map<string, string>();
  for (const e of emps ?? []) names.set(e.user_id as string, e.full_name);
  const myId = auth.user?.id;

  return (posts ?? []).map((p) => {
    const likes = (p.post_likes ?? []) as { user_id: string; reaction: string }[];
    const counts = new Map<string, number>();
    let myReaction: string | null = null;
    for (const l of likes) {
      counts.set(l.reaction, (counts.get(l.reaction) ?? 0) + 1);
      if (l.user_id === myId) myReaction = l.reaction;
    }
    const comments = ((p.post_comments ?? []) as { id: string; sender_id: string; body: string; created_at: string }[])
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((c) => ({
        id: c.id,
        sender: (names.get(c.sender_id) ?? "Notandi").split(/\s+/)[0],
        body: c.body,
        at: ago(c.created_at),
      }));
    return {
      id: p.id,
      sender: p.sender_id ? (names.get(p.sender_id) ?? "Notandi") : "VAKTO",
      me: p.sender_id === myId,
      system: !p.sender_id,
      body: p.body,
      at: ago(p.created_at),
      pinned: !!p.pinned,
      imageUrl: p.image_url,
      fileUrl: p.file_url,
      fileName: p.file_name,
      reactions: [...counts.entries()].map(([emoji, count]) => ({ emoji, count })),
      myReaction,
      comments,
    };
  });
}

export async function createPost(me: Me, body: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { error } = await supabase.from("posts").insert({
    company_id: me.companyId,
    sender_id: auth.user.id,
    body,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setPostReaction(
  me: Me,
  postId: string,
  emoji: string | null
): Promise<{ ok: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  if (emoji === null) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", auth.user.id);
  } else {
    await supabase.from("post_likes").upsert(
      { post_id: postId, user_id: auth.user.id, company_id: me.companyId, reaction: emoji },
      { onConflict: "post_id,user_id" }
    );
  }
  return { ok: true };
}

export async function addPostComment(me: Me, postId: string, body: string): Promise<{ ok: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    company_id: me.companyId,
    sender_id: auth.user.id,
    body,
  });
  return { ok: !error };
}
