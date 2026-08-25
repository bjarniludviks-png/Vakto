"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { initials } from "@/lib/employees";
import { notifyEmployee, sendPushToUser } from "@/lib/push";

export type Conversation = { id: string; name: string; kind: string; av: string; color: string; last: string; lastAt: string | null; dm: boolean; photo: string | null };
export type ChatMessage = {
  id: string; sender: string; senderId: string; me: boolean; body: string; at: string; kind: string; url: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  replyTo: { sender: string; body: string } | null;
};
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

/** user_id → full_name from employees — fallback when a users row is missing. */
async function empNameMap(supabase: Awaited<ReturnType<typeof createClient>>, company: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("employees").select("user_id, full_name").eq("company_id", company).not("user_id", "is", null);
  return new Map((data ?? []).map((e) => [e.user_id as string, e.full_name as string]));
}

/** Conversations the user can see: general + their groups + their DMs. */
export async function listConversations(): Promise<{ ok: boolean; items: Conversation[]; meId: string; needsMigration?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, items: [], meId: "" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, items: [], meId: "" };

    // photo_url arrives with migration 0042 — fall back to the old shape before it runs
    let chRes = await supabase.from("channels").select("id, name, kind, created_by, photo_url").eq("company_id", ctx.company).order("created_at");
    if (chRes.error) chRes = (await supabase.from("channels").select("id, name, kind, created_by").eq("company_id", ctx.company).order("created_at")) as unknown as typeof chRes;
    if (chRes.error) return { ok: false, items: [], meId: ctx.userId, needsMigration: true };
    let channels = chRes.data as { id: string; name: string; kind: string; created_by: string; photo_url?: string | null }[];
    if (!channels.length) {
      const { data: created } = await supabase.from("channels")
        .insert({ company_id: ctx.company, name: "Almennt", kind: "general", created_by: ctx.userId })
        .select("id, name, kind, created_by").single();
      if (created) channels = [created as never];
    }
    const ids = channels.map((c) => c.id);

    // member names per channel (to resolve DM titles) + last message
    const [{ data: mems }, { data: msgs }, emps] = await Promise.all([
      supabase.from("channel_members").select("channel_id, user_id, users(full_name)").in("channel_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("messages").select("channel_id, body, kind, created_at").in("channel_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false }).limit(400),
      empNameMap(supabase, ctx.company),
    ]);
    const memByCh = new Map<string, { id: string; name: string }[]>();
    for (const m of mems ?? []) {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      if (!memByCh.has(m.channel_id as string)) memByCh.set(m.channel_id as string, []);
      memByCh.get(m.channel_id as string)!.push({ id: m.user_id as string, name: emps.get(m.user_id as string) ?? u?.full_name ?? "?" });
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
      return { id: c.id, name, kind: c.kind, av: dm ? initials(name) : (c.kind === "general" ? "#" : initials(c.name)), color: colorOf(first), last: lastByCh.get(c.id) ?? "", lastAt: lastAtByCh.get(c.id) ?? null, dm, photo: c.photo_url ?? null };
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
    const [{ data }, emps] = await Promise.all([
      supabase.from("channel_members").select("user_id, users(full_name)").eq("channel_id", channelId),
      empNameMap(supabase, ctx.company),
    ]);
    const members: Person[] = (data ?? []).map((m) => {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      const name = emps.get(m.user_id as string) ?? u?.full_name ?? "?";
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
    // reply_to arrives with migration 0042 — fall back to the old shape before it runs
    let res = await supabase
      .from("messages").select("id, body, kind, attachment_url, created_at, sender_id, reply_to, users(full_name)")
      .eq("company_id", ctx.company).eq("channel_id", channelId).order("created_at").limit(300);
    if (res.error) {
      res = (await supabase
        .from("messages").select("id, body, kind, attachment_url, created_at, sender_id, users(full_name)")
        .eq("company_id", ctx.company).eq("channel_id", channelId).order("created_at").limit(300)) as unknown as typeof res;
    }
    const data = res.data ?? [];

    // reactions (table arrives with 0042 — tolerate its absence)
    const reactByMsg = new Map<string, { emoji: string; count: number; mine: boolean }[]>();
    try {
      const ids = data.map((m) => m.id as string);
      const { data: reacts } = await supabase.from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      for (const r of reacts ?? []) {
        const list = reactByMsg.get(r.message_id as string) ?? [];
        const hit = list.find((x) => x.emoji === r.emoji);
        if (hit) { hit.count++; hit.mine = hit.mine || r.user_id === ctx.userId; }
        else list.push({ emoji: r.emoji as string, count: 1, mine: r.user_id === ctx.userId });
        reactByMsg.set(r.message_id as string, list);
      }
    } catch { /* pre-0042 */ }

    const emps = await empNameMap(supabase, ctx.company);
    const senderOf = (m: (typeof data)[number]) => {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      return (emps.get(m.sender_id as string) ?? u?.full_name ?? "—").split(/\s+/)[0];
    };
    const byId = new Map(data.map((m) => [m.id as string, m]));
    const messages: ChatMessage[] = data.map((m) => {
      const rt = "reply_to" in m && m.reply_to ? byId.get(m.reply_to as string) : undefined;
      return {
        id: m.id as string, sender: senderOf(m), senderId: m.sender_id as string,
        me: m.sender_id === ctx.userId, body: (m.body as string) ?? "", at: hhmm(m.created_at as string),
        kind: (m.kind as string) ?? "text", url: (m.attachment_url as string) ?? null,
        reactions: (reactByMsg.get(m.id as string) ?? []).sort((a, b) => b.count - a.count),
        replyTo: rt ? { sender: senderOf(rt), body: rt.kind === "image" ? "📷 Mynd" : rt.kind === "audio" ? "🎤 Talskilaboð" : ((rt.body as string) ?? "") } : null,
      };
    });
    return { ok: true, messages };
  } catch {
    return { ok: false, messages: [] };
  }
}

export async function sendChatMessage(channelId: string, body: string, kind: "text" | "image" | "audio" = "text", attachmentUrl?: string, replyTo?: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const text = body.trim();
  if ((!text && kind === "text") || !channelId) return { ok: false };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const row = {
      company_id: ctx.company, channel_id: channelId, sender_id: ctx.userId,
      body: text || (kind === "image" ? "Mynd" : "Talskilaboð"), kind, attachment_url: attachmentUrl ?? null,
    };
    // reply_to column arrives with 0042 — retry without it if the insert rejects
    let error: { message: string } | null;
    if (replyTo) {
      ({ error } = await supabase.from("messages").insert({ ...row, reply_to: replyTo } as never));
      if (error) ({ error } = await supabase.from("messages").insert(row));
    } else {
      ({ error } = await supabase.from("messages").insert(row));
    }
    if (error) return { ok: false, error: error.message };
    // Push to the other channel members (best-effort; tag collapses per channel).
    try {
      const [{ data: mems }, { data: ch }, emps] = await Promise.all([
        supabase.from("channel_members").select("user_id").eq("channel_id", channelId).limit(50),
        supabase.from("channels").select("name, kind").eq("id", channelId).maybeSingle(),
        empNameMap(supabase, ctx.company),
      ]);
      const sender = (emps.get(ctx.userId) ?? "").split(/\s+/)[0] || "Ný skilaboð";
      const title = ch?.kind === "group" && ch.name ? `${sender} · ${ch.name}` : sender;
      const preview = kind === "text" ? text.slice(0, 90) : kind === "image" ? "📷 Mynd" : "🎤 Talskilaboð";
      for (const m of mems ?? []) {
        if (m.user_id === ctx.userId) continue;
        void sendPushToUser(m.user_id as string, { title, body: preview, url: "/spjall", tag: `chat-${channelId}` });
      }
    } catch { /* push is best-effort */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** One emoji reaction per user per message — emoji sets/updates, null removes. */
export async function setMessageReaction(messageId: string, emoji: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (emoji) {
      const { error } = await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: ctx.userId, company_id: ctx.company, emoji });
      if (error) return { ok: false, error: "Keyrðu migration 0042 fyrir viðbrögð" };
    } else {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", ctx.userId);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Villa" };
  }
}

/** Unsend: delete your own message (RLS-enforced, migration 0042). */
export async function deleteMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", ctx.userId).select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "Ekki tókst að eyða (migration 0042?)" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Rename a group (any member — RLS `channels_member_update`, migration 0042). */
export async function renameChannel(channelId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const nm = name.trim();
  if (!nm) return { ok: false, error: "Sláðu inn heiti" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("channels").update({ name: nm }).eq("id", channelId).eq("kind", "group").select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "Ekki tókst að breyta heiti" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Set a group photo: upload (base64 data URL) to the chat bucket + save on the channel. */
export async function setChannelPhoto(channelId: string, dataUrl: string, ext: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const comma = dataUrl.indexOf(",");
    const contentType = dataUrl.slice(5, comma).split(";")[0] || "image/png";
    const buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
    const path = `${ctx.company}/channel-${channelId}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("chat").upload(path, buf, { contentType, upsert: false });
    if (up.error) return { ok: false, error: up.error.message };
    const { data: pub } = supabase.storage.from("chat").getPublicUrl(path);
    const { data, error } = await supabase.from("channels").update({ photo_url: pub.publicUrl }).eq("id", channelId).select("id");
    if (error) return { ok: false, error: "Keyrðu migration 0042 fyrir grúppumyndir" };
    if (!data?.length) return { ok: false, error: "Ekki tókst að vista mynd" };
    return { ok: true, url: pub.publicUrl };
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
  body: string; at: string; pinned: boolean; system: boolean;
  imageUrl: string | null; fileUrl: string | null; fileName: string | null;
  reactions: { emoji: string; count: number }[];
  myReaction: string | null;
  comments: FeedComment[];
};

/** Latest 50 posts with likes + comments, newest first. */
export async function listPosts(): Promise<{ ok: boolean; posts: FeedPost[]; meId: string; canPin: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, posts: [], meId: "", canPin: false };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, posts: [], meId: "", canPin: false };
    const { data: meRow } = await supabase.from("users").select("role").eq("id", ctx.userId).maybeSingle();
    const canPin = meRow?.role === "owner" || meRow?.role === "manager";
    const { data: rows } = await supabase
      .from("posts").select("id, sender_id, body, created_at, image_url, file_url, file_name, pinned, users!posts_sender_id_fkey(full_name)")
      .eq("company_id", ctx.company).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
    const ids = (rows ?? []).map((r) => r.id as string);
    const [{ data: likes }, { data: comments }, empNames] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id, reaction").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_comments").select("id, post_id, sender_id, body, created_at, users!post_comments_sender_id_fkey(full_name)").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at"),
      empNameMap(supabase, ctx.company),
    ]);
    // Prefer the employee's real name — users.full_name can hold the email
    // (or nothing) for invited accounts.
    const nameOf = (u: unknown, senderId?: unknown) =>
      (senderId ? empNames.get(String(senderId)) : undefined) ??
      ((Array.isArray(u) ? u[0] : u) as { full_name?: string } | null)?.full_name ?? "Notandi";
    const posts: FeedPost[] = (rows ?? []).map((r) => {
      const system = !r.sender_id;
      const name = system ? "VAKTO" : nameOf(r.users, r.sender_id);
      const pLikes = (likes ?? []).filter((l) => l.post_id === r.id);
      const byEmoji = new Map<string, number>();
      for (const l of pLikes) byEmoji.set((l.reaction as string) || "❤️", (byEmoji.get((l.reaction as string) || "❤️") ?? 0) + 1);
      return {
        id: r.id as string, sender: name,
        av: system ? "🎂" : initials(name),
        color: system ? "#e9700f" : colorOf(name.split(/\s+/)[0] || name),
        pinned: !!r.pinned, system,
        me: r.sender_id === ctx.userId,
        body: r.body as string, at: hhmm(r.created_at as string) + " · " + new Date(r.created_at as string).toLocaleDateString("de-DE").replace(/\./g, "."),
        imageUrl: (r.image_url as string) ?? null, fileUrl: (r.file_url as string) ?? null, fileName: (r.file_name as string) ?? null,
        reactions: [...byEmoji.entries()].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count),
        myReaction: (pLikes.find((l) => l.user_id === ctx.userId)?.reaction as string) ?? null,
        comments: (comments ?? []).filter((cm) => cm.post_id === r.id).map((cm) => {
          const cn = nameOf(cm.users, cm.sender_id);
          return { id: cm.id as string, sender: cn, av: initials(cn), color: colorOf(cn.split(/\s+/)[0] || cn), body: cm.body as string, at: hhmm(cm.created_at as string) };
        }),
      };
    });
    return { ok: true, posts, meId: ctx.userId, canPin };
  } catch {
    return { ok: false, posts: [], meId: "", canPin: false };
  }
}

/** Pin/unpin an announcement (managers + owners only — checked server-side). */
export async function setPostPinned(postId: string, pinned: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: meRow } = await supabase.from("users").select("role").eq("id", ctx.userId).maybeSingle();
    if (meRow?.role !== "owner" && meRow?.role !== "manager") return { ok: false, error: "Aðeins stjórnendur geta fest tilkynningar" };
    const { error } = await supabase.from("posts").update({ pinned }).eq("id", postId).eq("company_id", ctx.company);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function createPost(body: string, media?: { imageUrl?: string; fileUrl?: string; fileName?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!body.trim() && !media?.imageUrl && !media?.fileUrl) return { ok: false, error: "Skrifaðu eitthvað fyrst" };
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("posts").insert({
      company_id: ctx.company, sender_id: ctx.userId, body: body.trim(),
      image_url: media?.imageUrl ?? null, file_url: media?.fileUrl ?? null, file_name: media?.fileName ?? null,
    });
    if (error) return { ok: false, error: error.message };
    // Manager/owner posts push to the team (best-effort, capped).
    const { data: meRow } = await supabase.from("users").select("role, full_name").eq("id", ctx.userId).maybeSingle();
    if (meRow?.role === "owner" || meRow?.role === "manager") {
      const { data: team } = await supabase.from("employees").select("id, user_id").eq("company_id", ctx.company).eq("status", "active").limit(100);
      const preview = body.trim().slice(0, 80) || "Ný færsla á fréttaveitunni";
      for (const m of team ?? []) {
        if (m.user_id === ctx.userId) continue;
        void notifyEmployee(m.id as string, { title: `📣 ${(meRow.full_name as string) ?? "Stjórnandi"}`, body: preview, url: "/frettaveita", tag: "feed" });
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** One reaction per user per post — emoji sets/updates it, null removes it. */
export async function setPostReaction(postId: string, emoji: string | null): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false };
    if (emoji) await supabase.from("post_likes").upsert({ post_id: postId, user_id: ctx.userId, company_id: ctx.company, reaction: emoji });
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
