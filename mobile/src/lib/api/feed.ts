// Fréttaveita — beint á Supabase (posts / post_likes / post_comments).
// Allir í fyrirtækinu mega birta; aðeins stjórnendur/vaktstjórar festa efst.
import { supabase } from "../supabase";
import { tr, trf } from "../../../src/lib/i18n";
import type { Me } from "./me";
import { peopleMap } from "./chat";

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥"] as const;

export type FeedComment = { id: string; sender: string; body: string; at: string; color: string | null; photo: string | null; me: boolean };

export type FeedAudience = { kind: "all" | "department" | "location"; id: string | null; name: string };
export type FeedPost = {
  id: string;
  audience: string | null;
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

/** Hverjir mega birta + markhópar (0054). Þolir grunn án dálkanna. */
export async function feedOptions(me: Me): Promise<{ canPost: boolean; audiences: FeedAudience[] }> {
  const manager = await canPin();
  const pol = await supabase.from("companies").select("feed_post_policy").eq("id", me.companyId).maybeSingle();
  const policy = pol.error ? "everyone" : ((pol.data?.feed_post_policy as string) ?? "everyone");
  const audiences: FeedAudience[] = [{ kind: "all", id: null, name: "Allir" }];
  if (manager) {
    const [{ data: deps }, { data: locs }] = await Promise.all([
      supabase.from("departments").select("id, name, locations!inner(company_id)").eq("locations.company_id", me.companyId).order("name"),
      supabase.from("locations").select("id, name").eq("company_id", me.companyId).order("name"),
    ]);
    for (const d of deps ?? []) audiences.push({ kind: "department", id: d.id as string, name: d.name as string });
    if ((locs ?? []).length > 1) for (const l of locs ?? []) audiences.push({ kind: "location", id: l.id as string, name: l.name as string });
  }
  return { canPost: manager || policy === "everyone", audiences };
}

export async function listPosts(me: Me): Promise<FeedPost[]> {
  const sel = (withAud: boolean) => supabase
      .from("posts")
      .select(`id, sender_id, body, created_at, image_url, file_url, file_name, pinned${withAud ? ", audience_kind, audience_id" : ""}, post_likes(user_id, reaction), post_comments(id, sender_id, body, created_at)`)
      .eq("company_id", me.companyId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
  let postsRes = await sel(true);
  if (postsRes.error) postsRes = (await sel(false)) as unknown as typeof postsRes;
  const [people, { data: auth }, { data: deps }, { data: locs }] = await Promise.all([
    peopleMap(me.companyId),
    supabase.auth.getUser(),
    supabase.from("departments").select("id, name, locations!inner(company_id)").eq("locations.company_id", me.companyId),
    supabase.from("locations").select("id, name").eq("company_id", me.companyId),
  ]);
  const posts = (postsRes.data ?? []) as unknown as ({ audience_kind?: string; audience_id?: string | null } & Record<string, unknown>)[];
  const audName = (k: unknown, id: unknown): string | null => k === "department" ? ((deps ?? []).find((d) => d.id === id)?.name as string) ?? "Deild" : k === "location" ? ((locs ?? []).find((l) => l.id === id)?.name as string) ?? "Staður" : null;
  const myId = auth.user?.id;
  return posts.map((p0) => {
    const p = p0 as unknown as { id: string; sender_id: string | null; body: string; created_at: string; image_url: string | null; file_url: string | null; file_name: string | null; pinned: boolean | null; audience_kind?: string; audience_id?: string | null; post_likes: unknown; post_comments: unknown };
    const likes = (p.post_likes ?? []) as { user_id: string; reaction: string }[];
    const counts = new Map<string, number>();
    let myReaction: string | null = null;
    for (const l of likes) { counts.set(l.reaction, (counts.get(l.reaction) ?? 0) + 1); if (l.user_id === myId) myReaction = l.reaction; }
    const comments = ((p.post_comments ?? []) as { id: string; sender_id: string; body: string; created_at: string }[])
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((c) => { const s = people.get(c.sender_id); return { id: c.id, sender: (s?.name ?? "Notandi").split(/\s+/)[0], body: c.body, at: ago(c.created_at), color: s?.color ?? null, photo: s?.photo ?? null, me: c.sender_id === myId }; });
    const s = p.sender_id ? people.get(p.sender_id) : null;
    return {
      id: p.id, audience: audName(p.audience_kind, p.audience_id), sender: p.sender_id ? (s?.name ?? "Notandi") : "VAKTO", senderRole: s?.role ?? null, color: s?.color ?? null, photo: s?.photo ?? null,
      me: p.sender_id === myId, system: !p.sender_id, body: p.body, at: ago(p.created_at), atISO: p.created_at, pinned: !!p.pinned,
      imageUrl: p.image_url, fileUrl: p.file_url, fileName: p.file_name,
      reactions: [...counts.entries()].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count), myReaction, comments,
    };
  });
}

export async function createPost(me: Me, body: string, opts: { pinned?: boolean; imageUrl?: string | null; audience?: FeedAudience | null } = {}): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const row: Record<string, unknown> = { company_id: me.companyId, sender_id: auth.user.id, body };
  if (opts.imageUrl) row.image_url = opts.imageUrl;
  if (opts.pinned) row.pinned = true;
  const a = opts.audience;
  const withAud = a && a.kind !== "all" && a.id ? { ...row, audience_kind: a.kind, audience_id: a.id } : row;
  let { error } = await supabase.from("posts").insert(withAud);
  if (error && /column|schema/i.test(error.message)) ({ error } = await supabase.from("posts").insert(row));
  if (error) return { ok: false, error: /policy|permission|violates/i.test(error.message) ? tr("Aðeins stjórnendur mega birta í fréttaveituna") : error.message };
  return { ok: true };
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
