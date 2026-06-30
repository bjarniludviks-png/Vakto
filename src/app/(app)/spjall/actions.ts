"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { initials } from "@/lib/employees";

export type Conversation = { id: string; name: string; kind: string; av: string; color: string; last: string; dm: boolean };
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
    for (const m of msgs ?? []) {
      if (lastByCh.has(m.channel_id as string)) continue;
      lastByCh.set(m.channel_id as string, m.kind === "image" ? "📷 Mynd" : m.kind === "audio" ? "🎤 Talskilaboð" : (m.body as string));
    }

    const items: Conversation[] = channels.map((c) => {
      const dm = c.kind === "dm";
      const others = (memByCh.get(c.id) ?? []).filter((m) => m.id !== ctx.userId);
      const name = c.kind === "general" ? "Almennt"
        : dm ? (others[0]?.name ?? "Bein skilaboð")
          : c.name;
      const first = name.split(/\s+/)[0];
      return { id: c.id, name, kind: c.kind, av: dm ? initials(name) : (c.kind === "general" ? "#" : initials(c.name)), color: colorOf(first), last: lastByCh.get(c.id) ?? "", dm };
    });
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
