"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { initials } from "@/lib/employees";

export type Conversation = { id: string; name: string; kind: string; av: string; color: string; last: string; lastAt: string | null; dm: boolean };
export type ChatMessage = { id: string; sender: string; senderId: string; me: boolean; body: string; at: string; kind: string; url: string | null };
export type Person = { userId: string; name: string; av: string; color: string };
export type Members = { members: Person[]; adminId: string | null; meId: string };

const PALETTE = ["#5b50e6", "#18a06a", "#1fb6a6", "#e0533f", "#0891b2", "#ca8a04", "#9333ea", "#e11d48"];
const colorOf = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

async function ctxOf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company };
}

/** Conversations the user can see: general + their groups + their DMs. */
export async function listConversations(): Promise<{ ok: boolean; items: Conversation[]; meId: string; needsMigration?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, items: [], meId: "" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, items: [], meId: "" };

    const chRes = await supabase.from("channels").select("id, name, kind, created_by").eq("company_id", ctx.company).order("created_at");
    if (chRes.error) return { ok: false, items: [], meId: ctx.userId, needsMigration: true };
    let channels = chRes.data as { id: string; name: string; kind: string; created_by: string }[];
    if (!channels.length) {
      const { data: created } = await supabase.from("channels")
        .insert({ company_id: ctx.company, name: "Almennt", kind: "general", created_by: ctx.userId })
        .select("id, name, kind, created_by").single();
      if (created) channels = [created as never];
    }
    const ids = channels.map((c) => c.id);

    // member names per channel (to resolve DM titles) + last message
    const [{ data: mems }, { data: msgs }] = await Promise.all([
      supabase.from("channel_members").select("channel_id, user_id, users(full_name)").in("channel_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("messages").select("channel_id, body, kind, created_at").in("channel_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false }).limit(400),
    ]);
    const memByCh = new Map<string, { id: string; name: string }[]>();
    for (const m of mems ?? []) {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      if (!memByCh.has(m.channel_id as string)) memByCh.set(m.channel_id as string, []);
      memByCh.get(m.channel_id as string)!.push({ id: m.user_id as string, name: u?.full_name ?? "?" });
    }
    const lastByCh = new Map<string, string>();
    const lastAtByCh = new Map<string, string>();
    for (const m of msgs ?? []) {
      if (lastByCh.has(m.channel_id as string)) continue;
      lastByCh.set(m.channel_id as string, m.kind === "image" ? "📷 Mynd" : m.kind === "audio" ? "🎤 Talskilaboð" : (m.body as string));
      lastAtByCh.set(m.channel_id as string, m.created_at as string);
    }

    const items: Conversation[] = channels.map((c) => {
      const dm = c.kind === "dm";
      const others = (memByCh.get(c.id) ?? []).filter((m) => m.id !== ctx.userId);
      const name = c.kind === "general" ? "Almennt"
        : dm ? (others[0]?.name ?? "Bein skilaboð")
          : c.name;
      const first = name.split(/\s+/)[0];
      return { id: c.id, name, kind: c.kind, av: dm ? initials(name) : (c.kind === "general" ? "#" : initials(c.name)), color: colorOf(first), last: lastByCh.get(c.id) ?? "", lastAt: lastAtByCh.get(c.id) ?? null, dm };
    });
    // Newest activity on top; the company-wide "Almennt" channel stays pinned first.
    items.sort((a, b) => (a.kind === "general" ? -1 : b.kind === "general" ? 1 : (b.lastAt ?? "").localeCompare(a.lastAt ?? "")));
    return { ok: true, items, meId: ctx.userId };
  } catch {
    return { ok: false, items: [], meId: "" };
  }
}

/** Employees in the company who have an account (for DM / group members). */
export async function searchPeople(q: string): Promise<Person[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return [];
    let query = supabase.from("employees").select("user_id, full_name").eq("company_id", ctx.company).not("user_id", "is", null).limit(40);
    if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
    const { data } = await query;
    return (data ?? [])
      .filter((e) => e.user_id && e.user_id !== ctx.userId)
      .map((e) => ({ userId: e.user_id as string, name: e.full_name as string, av: initials(e.full_name as string), color: colorOf((e.full_name as string).split(/\s+/)[0]) }));
  } catch {
    return [];
  }
}

/** Find or create a 1:1 DM with another user. */
export async function startDM(otherUserId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    // existing DM where both are members
    const { data: mine } = await supabase.from("channel_members").select("channel_id, channels(kind)").eq("user_id", ctx.userId);
    const dmIds = (mine ?? []).filter((m) => ((Array.isArray(m.channels) ? m.channels[0] : m.channels) as { kind?: string } | null)?.kind === "dm").map((m) => m.channel_id as string);
    if (dmIds.length) {
      const { data: shared } = await supabase.from("channel_members").select("channel_id").eq("user_id", otherUserId).in("channel_id", dmIds).maybeSingle();
      if (shared) return { ok: true, id: shared.channel_id as string };
    }
    const { data: ch, error } = await supabase.from("channels")
      .insert({ company_id: ctx.company, name: "", kind: "dm", created_by: ctx.userId }).select("id").single();
    if (error || !ch) return { ok: false, error: error?.message ?? "Villa" };
    await supabase.from("channel_members").insert([{ channel_id: ch.id, user_id: ctx.userId }, { channel_id: ch.id, user_id: otherUserId }]);
    return { ok: true, id: ch.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function createGroup(name: string, memberUserIds: string[]): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const nm = name.trim();
  if (!nm) return { ok: false, error: "Sláðu inn heiti" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: ch, error } = await supabase.from("channels")
      .insert({ company_id: ctx.company, name: nm, kind: "group", created_by: ctx.userId }).select("id").single();
    if (error || !ch) return { ok: false, error: error?.message ?? "Villa" };
    const uniq = Array.from(new Set([ctx.userId, ...memberUserIds]));
    await supabase.from("channel_members").insert(uniq.map((u) => ({ channel_id: ch.id, user_id: u })));
    return { ok: true, id: ch.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function listMembers(channelId: string): Promise<Members> {
  const empty: Members = { members: [], adminId: null, meId: "" };
  if (!isSupabaseConfigured() || !channelId) return empty;
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return empty;
    const { data: ch } = await supabase.from("channels").select("created_by").eq("id", channelId).maybeSingle();
    const { data } = await supabase.from("channel_members").select("user_id, users(full_name)").eq("channel_id", channelId);
    const members: Person[] = (data ?? []).map((m) => {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      const name = u?.full_name ?? "?";
      return { userId: m.user_id as string, name, av: initials(name), color: colorOf(name.split(/\s+/)[0]) };
    });
    return { members, adminId: (ch?.created_by as string) ?? null, meId: ctx.userId };
  } catch {
    return empty;
  }
}

export async function addMembers(channelId: string, userIds: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("channel_members").upsert(userIds.map((u) => ({ channel_id: channelId, user_id: u })), { onConflict: "channel_id,user_id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function removeMember(channelId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: ch } = await supabase.from("channels").select("created_by").eq("id", channelId).maybeSingle();
    if ((ch?.created_by as string) !== ctx.userId) return { ok: false, error: "Aðeins stofnandi getur fjarlægt" };
    const { error } = await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function leaveChannel(channelId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", ctx.userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function listMessages(channelId: string): Promise<{ ok: boolean; messages: ChatMessage[] }> {
  if (!isSupabaseConfigured() || !channelId) return { ok: false, messages: [] };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, messages: [] };
    const { data } = await supabase
      .from("messages").select("id, body, kind, attachment_url, created_at, sender_id, users(full_name)")
      .eq("company_id", ctx.company).eq("channel_id", channelId).order("created_at").limit(300);
    const messages: ChatMessage[] = (data ?? []).map((m) => {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      return {
        id: m.id as string, sender: (u?.full_name ?? "—").split(/\s+/)[0], senderId: m.sender_id as string,
        me: m.sender_id === ctx.userId, body: (m.body as string) ?? "", at: hhmm(m.created_at as string),
        kind: (m.kind as string) ?? "text", url: (m.attachment_url as string) ?? null,
      };
    });
    return { ok: true, messages };
  } catch {
    return { ok: false, messages: [] };
  }
}

export async function sendChatMessage(channelId: string, body: string, kind: "text" | "image" | "audio" = "text", attachmentUrl?: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const text = body.trim();
  if ((!text && kind === "text") || !channelId) return { ok: false };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("messages").insert({
      company_id: ctx.company, channel_id: channelId, sender_id: ctx.userId,
      body: text || (kind === "image" ? "Mynd" : "Talskilaboð"), kind, attachment_url: attachmentUrl ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Upload an image/voice clip (base64 data URL) to the chat bucket; returns public URL. */
export async function uploadChatMedia(dataUrl: string, ext: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const comma = dataUrl.indexOf(",");
    const meta = dataUrl.slice(5, comma); // e.g. image/png;base64
    const contentType = meta.split(";")[0] || "application/octet-stream";
    const buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
    const path = `${ctx.company}/${ctx.userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat").upload(path, buf, { contentType, upsert: false });
    if (error) return { ok: false, error: error.message };
    const { data } = supabase.storage.from("chat").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/* ---------- news feed (posts + likes + comments) ---------- */

export type FeedComment = { id: string; sender: string; av: string; color: string; body: string; at: string };
export type FeedPost = {
  id: string; sender: string; av: string; color: string; me: boolean;
  body: string; at: string; likes: number; likedByMe: boolean; comments: FeedComment[];
};

/** Latest 50 posts with likes + comments, newest first. */
export async function listPosts(): Promise<{ ok: boolean; posts: FeedPost[]; meId: string }> {
  if (!isSupabaseConfigured()) return { ok: false, posts: [], meId: "" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, posts: [], meId: "" };
    const { data: rows } = await supabase
      .from("posts").select("id, sender_id, body, created_at, users!posts_sender_id_fkey(full_name)")
      .eq("company_id", ctx.company).order("created_at", { ascending: false }).limit(50);
    const ids = (rows ?? []).map((r) => r.id as string);
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_comments").select("id, post_id, sender_id, body, created_at, users!post_comments_sender_id_fkey(full_name)").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at"),
    ]);
    const nameOf = (u: unknown) => ((Array.isArray(u) ? u[0] : u) as { full_name?: string } | null)?.full_name ?? "Notandi";
    const posts: FeedPost[] = (rows ?? []).map((r) => {
      const name = nameOf(r.users);
      const pLikes = (likes ?? []).filter((l) => l.post_id === r.id);
      return {
        id: r.id as string, sender: name, av: initials(name), color: colorOf(name.split(/\s+/)[0] || name),
        me: r.sender_id === ctx.userId,
        body: r.body as string, at: hhmm(r.created_at as string) + " · " + new Date(r.created_at as string).toLocaleDateString("de-DE").replace(/\./g, "."),
        likes: pLikes.length, likedByMe: pLikes.some((l) => l.user_id === ctx.userId),
        comments: (comments ?? []).filter((cm) => cm.post_id === r.id).map((cm) => {
          const cn = nameOf(cm.users);
          return { id: cm.id as string, sender: cn, av: initials(cn), color: colorOf(cn.split(/\s+/)[0] || cn), body: cm.body as string, at: hhmm(cm.created_at as string) };
        }),
      };
    });
    return { ok: true, posts, meId: ctx.userId };
  } catch {
    return { ok: false, posts: [], meId: "" };
  }
}

export async function createPost(body: string): Promise<{ ok: boolean; error?: string }> {
  if (!body.trim()) return { ok: false, error: "Skrifaðu eitthvað fyrst" };
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("posts").insert({ company_id: ctx.company, sender_id: ctx.userId, body: body.trim() });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function togglePostLike(postId: string, like: boolean): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false };
    if (like) await supabase.from("post_likes").upsert({ post_id: postId, user_id: ctx.userId, company_id: ctx.company });
    else await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", ctx.userId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function addPostComment(postId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!body.trim()) return { ok: false, error: "Skrifaðu athugasemd" };
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, company_id: ctx.company, sender_id: ctx.userId, body: body.trim() });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
