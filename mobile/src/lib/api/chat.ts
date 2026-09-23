// Spjall — beint á Supabase (channels / channel_members / messages /
// message_reactions / channel_reads) með realtime, eins og vefurinn.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type { Me } from "./me";

export type Person = { userId: string; name: string; color: string | null; photo: string | null; role: string | null; dept: string | null };

export type Conversation = {
  id: string;
  name: string;
  kind: "general" | "group" | "dm";
  last: string | null;
  lastAt: string | null;
  lastFrom: string | null; // fornafn
  unread: number;
  photo: string | null;
  color: string | null;
  members: number;
  other: Person | null; // DM
};

export type ChatMessage = {
  id: string;
  senderId: string;
  sender: string;       // fornafn
  senderFull: string;
  color: string | null;
  photo: string | null;
  me: boolean;
  body: string;
  at: string;           // HH:MM
  createdAt: string;
  kind: "text" | "image" | "audio";
  url: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  replyTo: { sender: string; body: string } | null;
};
export type ChannelRead = { userId: string; name: string; lastReadAt: string };

let peopleCache: { companyId: string; at: number; map: Map<string, Person> } | null = null;
export async function peopleMap(companyId: string, force = false): Promise<Map<string, Person>> {
  if (!force && peopleCache && peopleCache.companyId === companyId && Date.now() - peopleCache.at < 60000) return peopleCache.map;
  const { data } = await supabase
    .from("employees")
    .select("user_id, full_name, avatar_color, photo_url, title, positions(name), departments(name)")
    .eq("company_id", companyId)
    .not("user_id", "is", null);
  const m = new Map<string, Person>();
  for (const r of data ?? []) {
    const pos = (Array.isArray(r.positions) ? r.positions[0] : r.positions) as { name?: string } | null;
    const dep = (Array.isArray(r.departments) ? r.departments[0] : r.departments) as { name?: string } | null;
    m.set(r.user_id as string, { userId: r.user_id as string, name: r.full_name, color: r.avatar_color, photo: r.photo_url, role: r.title ?? pos?.name ?? null, dept: dep?.name ?? null });
  }
  peopleCache = { companyId, at: Date.now(), map: m };
  return m;
}
export async function listPeople(me: Me): Promise<Person[]> {
  const { data: auth } = await supabase.auth.getUser();
  const m = await peopleMap(me.companyId, true);
  return [...m.values()].filter((p) => p.userId !== auth.user?.id).sort((a, b) => a.name.localeCompare(b.name));
}

export async function unreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("chat_unread_counts");
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as { channel_id: string; n: number | string }[]) out[r.channel_id] = Number(r.n) || 0;
  return out;
}
export async function getUnreadTotal(): Promise<number> {
  const c = await unreadCounts();
  return Object.values(c).reduce((a, b) => a + b, 0);
}
export async function markChannelRead(channelId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("channel_reads").upsert({ channel_id: channelId, user_id: auth.user.id, last_read_at: new Date().toISOString() }, { onConflict: "channel_id,user_id" });
}

export async function listConversations(me: Me): Promise<Conversation[]> {
  const [{ data: chs }, { data: auth }, people, unread] = await Promise.all([
    supabase.from("channels").select("id, name, kind, created_at, photo_url").eq("company_id", me.companyId),
    supabase.auth.getUser(),
    peopleMap(me.companyId),
    unreadCounts(),
  ]);
  const channels = chs ?? [];
  if (!channels.length) return [];
  const myId = auth.user?.id;
  const ids = channels.map((c) => c.id);
  const [{ data: msgs }, { data: members }] = await Promise.all([
    supabase.from("messages").select("channel_id, sender_id, body, kind, created_at").in("channel_id", ids).order("created_at", { ascending: false }).limit(300),
    supabase.from("channel_members").select("channel_id, user_id").in("channel_id", ids),
  ]);
  const lastBy = new Map<string, { body: string; kind: string; at: string; from: string }>();
  for (const m of msgs ?? []) if (!lastBy.has(m.channel_id)) lastBy.set(m.channel_id, { body: m.body, kind: m.kind, at: m.created_at, from: m.sender_id });
  const memBy = new Map<string, string[]>();
  for (const m of members ?? []) memBy.set(m.channel_id, [...(memBy.get(m.channel_id) ?? []), m.user_id]);

  const conv: Conversation[] = channels.map((c) => {
    const last = lastBy.get(c.id);
    const mem = memBy.get(c.id) ?? [];
    const otherId = c.kind === "dm" ? mem.find((u) => u !== myId) : undefined;
    const other = otherId ? (people.get(otherId) ?? { userId: otherId, name: "Samtal", color: null, photo: null, role: null, dept: null }) : null;
    return {
      id: c.id,
      name: c.kind === "dm" ? (other?.name ?? "Samtal") : c.kind === "general" ? (c.name || "Almennt") : c.name,
      kind: c.kind as Conversation["kind"],
      last: last ? (last.kind === "text" ? last.body : last.kind === "image" ? "📷 Mynd" : "🎤 Talskilaboð") : null,
      lastAt: last?.at ?? null,
      lastFrom: last ? (last.from === myId ? "Þú" : (people.get(last.from)?.name.split(/\s+/)[0] ?? null)) : null,
      unread: unread[c.id] ?? 0,
      photo: c.kind === "dm" ? (other?.photo ?? null) : (c.photo_url ?? null),
      color: c.kind === "dm" ? (other?.color ?? null) : null,
      members: c.kind === "general" ? people.size : mem.length,
      other,
    };
  });
  return conv.sort((a, b) => {
    if ((a.kind === "general") !== (b.kind === "general")) return a.kind === "general" ? -1 : 1;
    return (b.lastAt ?? "") < (a.lastAt ?? "") ? -1 : 1;
  });
}

export async function listMessages(me: Me, channelId: string): Promise<{ messages: ChatMessage[]; reads: ChannelRead[] }> {
  const [{ data: msgs }, people, { data: auth }, { data: reads }] = await Promise.all([
    supabase.from("messages").select("id, sender_id, body, kind, attachment_url, created_at, reply_to, message_reactions(user_id, emoji)").eq("channel_id", channelId).order("created_at").limit(300),
    peopleMap(me.companyId),
    supabase.auth.getUser(),
    supabase.from("channel_reads").select("user_id, last_read_at").eq("channel_id", channelId),
  ]);
  const myId = auth.user?.id;
  const byId = new Map((msgs ?? []).map((m) => [m.id, m]));
  const messages: ChatMessage[] = (msgs ?? []).map((m) => {
    const p = people.get(m.sender_id);
    const full = p?.name ?? "Notandi";
    const rx = (m.message_reactions ?? []) as { user_id: string; emoji: string }[];
    const counts = new Map<string, { count: number; mine: boolean }>();
    for (const r of rx) { const c = counts.get(r.emoji) ?? { count: 0, mine: false }; c.count++; if (r.user_id === myId) c.mine = true; counts.set(r.emoji, c); }
    const rt = m.reply_to ? byId.get(m.reply_to) : null;
    return {
      id: m.id, senderId: m.sender_id, sender: full.split(/\s+/)[0], senderFull: full, color: p?.color ?? null, photo: p?.photo ?? null,
      me: m.sender_id === myId, body: m.body ?? "", at: new Date(m.created_at).toTimeString().slice(0, 5), createdAt: m.created_at,
      kind: (m.kind ?? "text") as ChatMessage["kind"], url: m.attachment_url,
      reactions: [...counts.entries()].map(([emoji, c]) => ({ emoji, ...c })),
      replyTo: rt ? { sender: (people.get(rt.sender_id)?.name ?? "Notandi").split(/\s+/)[0], body: rt.body ?? "" } : null,
    };
  });
  const readsOut: ChannelRead[] = (reads ?? []).filter((r) => r.user_id !== myId).map((r) => ({ userId: r.user_id, name: people.get(r.user_id)?.name ?? "", lastReadAt: r.last_read_at }));
  return { messages, reads: readsOut };
}

export async function sendChatMessage(me: Me, channelId: string, body: string, replyTo?: string | null): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data, error } = await supabase.from("messages").insert({ company_id: me.companyId, channel_id: channelId, sender_id: auth.user.id, body, kind: "text", reply_to: replyTo ?? null }).select("id").single();
  if (error) return { ok: false, error: error.message };
  markChannelRead(channelId).catch(() => {});
  return { ok: true, id: data?.id as string };
}

export async function setReaction(me: Me, messageId: string, emoji: string | null): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  if (!emoji) await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", auth.user.id);
  else await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: auth.user.id, company_id: me.companyId, emoji }, { onConflict: "message_id,user_id" });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await supabase.from("messages").delete().eq("id", messageId);
}

/** Finna eða stofna einkaspjall við annan notanda. */
export async function startDM(me: Me, otherUserId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const myId = auth.user.id;
  const { data: dms } = await supabase.from("channels").select("id").eq("company_id", me.companyId).eq("kind", "dm");
  const ids = (dms ?? []).map((c) => c.id);
  if (ids.length) {
    const { data: mem } = await supabase.from("channel_members").select("channel_id, user_id").in("channel_id", ids);
    const byCh = new Map<string, Set<string>>();
    for (const m of mem ?? []) byCh.set(m.channel_id, (byCh.get(m.channel_id) ?? new Set()).add(m.user_id));
    for (const [ch, set] of byCh) if (set.size === 2 && set.has(myId) && set.has(otherUserId)) return { ok: true, id: ch };
  }
  const { data: ch, error } = await supabase.from("channels").insert({ company_id: me.companyId, name: "", kind: "dm", created_by: myId }).select("id").single();
  if (error || !ch) return { ok: false, error: error?.message ?? "Villa" };
  await supabase.from("channel_members").insert([{ channel_id: ch.id, user_id: myId }, { channel_id: ch.id, user_id: otherUserId }]);
  return { ok: true, id: ch.id as string };
}

/** Realtime: ný skilaboð + lestrarstöður (RLS sér um afmörkun). */
export function subscribeChat(onMessage: (row: { id: string; channel_id: string; sender_id: string; body: string; kind: string; created_at: string; attachment_url: string | null; reply_to: string | null }) => void, onReads?: () => void): RealtimeChannel {
  return supabase
    .channel("chat-live-" + Math.random().toString(36).slice(2, 8))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => onMessage(p.new as Parameters<typeof onMessage>[0]))
    .on("postgres_changes", { event: "*", schema: "public", table: "channel_reads" }, () => onReads?.())
    .subscribe();
}

/** Typing indicator (broadcast only). */
export function typingChannel(channelId: string, onTyping: (p: { userId: string; name: string; stop?: boolean }) => void): RealtimeChannel {
  return supabase
    .channel(`typing:${channelId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "typing" }, (m) => onTyping(m.payload as { userId: string; name: string; stop?: boolean }))
    .subscribe();
}
