// Fréttaveita — beint á Supabase (posts / post_likes / post_comments).
// Allir í fyrirtækinu mega birta; aðeins stjórnendur/vaktstjórar festa efst.
import { supabase } from "../supabase";
import { tr, trf } from "../../../src/lib/i18n";
import type { Me } from "./me";
import { peopleMap } from "./chat";

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥"] as const;

export type FeedComment = { id: string; sender: string; body: string; at: string; color: string | null; photo: string | null; me: boolean };

export type FeedPost = {
  id: string;
  sender: string;
  senderRole: string | null;
  color: string | null;
  photo: string | null;
  me: boolean;
  system: boolean;
  body: string;
  at: string;
  atISO: string;
  pinned: boolean;
  imageUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  reactions: { emoji: string; count: number }[];
  myReaction: string | null;
  comments: FeedComment[];
};

export function ago(isoTs: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(isoTs).getTime()) / 60000));
  if (mins < 1) return tr("Rétt í þessu");
  if (mins < 60) return trf("{n} mín", mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return trf("{n} klst", hrs);
  const d = new Date(isoTs);
  const days = Math.floor(hrs / 24);
  if (days === 1) return tr("Í gær");
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

let roleCache: { userId: string; role: string } | null = null;
export async function canPin(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  if (!roleCache || roleCache.userId !== auth.user.id) {
    const { data } = await supabase.from("users").select("role").eq("id", auth.user.id).maybeSingle();
    roleCache = { userId: auth.user.id, role: (data?.role as string) ?? "employee" };
  }
  return roleCache.role === "owner" || roleCache.role === "manager";
}

export async function listPosts(me: Me): Promise<FeedPost[]> {
  const [{ data: posts }, people, { data: auth }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, sender_id, body, created_at, image_url, file_url, file_name, pinned, post_likes(user_id, reaction), post_comments(id, sender_id, body, created_at)")
      .eq("company_id", me.companyId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    peopleMap(me.companyId),
    supabase.auth.getUser(),
  ]);
  const myId = auth.user?.id;
  return (posts ?? []).map((p) => {
    const likes = (p.post_likes ?? []) as { user_id: string; reaction: string }[];
    const counts = new Map<string, number>();
    let myReaction: string | null = null;
    for (const l of likes) { counts.set(l.reaction, (counts.get(l.reaction) ?? 0) + 1); if (l.user_id === myId) myReaction = l.reaction; }
    const comments = ((p.post_comments ?? []) as { id: string; sender_id: string; body: string; created_at: string }[])
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((c) => { const s = people.get(c.sender_id); return { id: c.id, sender: (s?.name ?? "Notandi").split(/\s+/)[0], body: c.body, at: ago(c.created_at), color: s?.color ?? null, photo: s?.photo ?? null, me: c.sender_id === myId }; });
    const s = p.sender_id ? people.get(p.sender_id) : null;
    return {
      id: p.id, sender: p.sender_id ? (s?.name ?? "Notandi") : "VAKTO", senderRole: s?.role ?? null, color: s?.color ?? null, photo: s?.photo ?? null,
      me: p.sender_id === myId, system: !p.sender_id, body: p.body, at: ago(p.created_at), atISO: p.created_at, pinned: !!p.pinned,
      imageUrl: p.image_url, fileUrl: p.file_url, fileName: p.file_name,
      reactions: [...counts.entries()].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count), myReaction, comments,
    };
  });
}

export async function createPost(me: Me, body: string, opts: { pinned?: boolean; imageUrl?: string | null } = {}): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const row: Record<string, unknown> = { company_id: me.companyId, sender_id: auth.user.id, body };
  if (opts.imageUrl) row.image_url = opts.imageUrl;
  if (opts.pinned) row.pinned = true;
  const { error } = await supabase.from("posts").insert(row);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setPinned(postId: string, pinned: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("posts").update({ pinned }).eq("id", postId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deletePost(postId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  return { ok: !error };
}

export async function setPostReaction(me: Me, postId: string, emoji: string | null): Promise<{ ok: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  if (emoji === null) await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", auth.user.id);
  else await supabase.from("post_likes").upsert({ post_id: postId, user_id: auth.user.id, company_id: me.companyId, reaction: emoji }, { onConflict: "post_id,user_id" });
  return { ok: true };
}

export async function addPostComment(me: Me, postId: string, body: string): Promise<{ ok: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, company_id: me.companyId, sender_id: auth.user.id, body });
  return { ok: !error };
}

/** Upload a picked image to the `chat` bucket (company-scoped) and return a public URL. */
export async function uploadImage(me: Me, uri: string, ext = "jpg"): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch(uri);
    const blob = await res.arrayBuffer();
    const path = `${me.companyId}/feed/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat").upload(path, blob, { contentType: ext === "png" ? "image/png" : "image/jpeg", upsert: false });
    if (error) return { ok: false, error: error.message };
    const { data } = supabase.storage.from("chat").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
