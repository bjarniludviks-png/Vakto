// Spjall — beint á Supabase (channels / channel_members / messages /
// message_reactions / channel_reads) með realtime, eins og vefurinn.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { tr, trf } from "../../../src/lib/i18n";
import { supabase } from "../supabase";
import type { Me } from "./me";

export type Person = {
  userId: string; name: string; color: string | null; photo: string | null; role: string | null; dept: string | null;
  // fyrir flýtival í hópavali („+ Allir í Eldhúsi“)
  deptId?: string | null; locId?: string | null; loc?: string | null; active?: boolean;
};

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
  kind: "text" | "image" | "audio" | "file";
  url: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  replyTo: { sender: string; body: string } | null;
};
export type ChannelRead = { userId: string; name: string; lastReadAt: string };

let peopleCache: { companyId: string; at: number; map: Map<string, Person> } | null = null;
export async function peopleMap(companyId: string, force = false): Promise<Map<string, Person>> {
  if (!force && peopleCache && peopleCache.companyId === companyId && Date.now() - peopleCache.at < 60000) return peopleCache.map;
  const { data } = await supabase
    .from("coworkers")
    .select("user_id, full_name, avatar_color, photo_url, title, status, department_id, location_id, positions(name), departments(name), locations(name)")
    .eq("company_id", companyId)
    .not("user_id", "is", null);
  const m = new Map<string, Person>();
  for (const r of data ?? []) {
    const pos = (Array.isArray(r.positions) ? r.positions[0] : r.positions) as { name?: string } | null;
    const dep = (Array.isArray(r.departments) ? r.departments[0] : r.departments) as { name?: string } | null;
    const loc = (Array.isArray(r.locations) ? r.locations[0] : r.locations) as { name?: string } | null;
    m.set(r.user_id as string, {
      userId: r.user_id as string, name: r.full_name, color: r.avatar_color, photo: r.photo_url, role: r.title ?? pos?.name ?? null, dept: dep?.name ?? null,
      deptId: r.department_id ?? null, locId: r.location_id ?? null, loc: loc?.name ?? null, active: r.status !== "inactive",
    });
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

/** Flýtival í hópavali: deildir og staðir með virku starfsfólki (ekki ég). */
export type TeamPick = { key: string; kind: "dept" | "loc"; name: string; userIds: string[] };
export function teamPicks(people: Person[]): TeamPick[] {
  const by = new Map<string, TeamPick>();
  const add = (key: string, kind: TeamPick["kind"], name: string | null | undefined, uid: string) => {
    if (!name) return;
    const t = by.get(key) ?? { key, kind, name, userIds: [] };
    if (!t.userIds.includes(uid)) t.userIds.push(uid);
    by.set(key, t);
  };
  for (const p of people) {
    if (p.active === false) continue;
    if (p.deptId) add(`dept:${p.deptId}`, "dept", p.dept, p.userId);
    if (p.locId) add(`loc:${p.locId}`, "loc", p.loc, p.userId);
  }
  return [...by.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "is") : a.kind === "dept" ? -1 : 1));
}

/** Sjálfgefið heiti hóps (Messenger): „Anna og Jón“, „Anna, Jón og Gunna“, „Anna, Jón og 3 fleiri“. */
export function defaultGroupName(names: string[]): string {
  const f = names.map((n) => n.split(/\s+/)[0]);
  if (f.length <= 1) return f[0] ?? "";
  if (f.length <= 3) return trf("{x} og {x}", f.slice(0, -1).join(", "), f[f.length - 1]); // trf fyllir {x} í röð
  return trf("{x} og {n} fleiri", f.slice(0, 2).join(", "), f.length - 2);
}

export async function listConversations(me: Me): Promise<Conversation[]> {
  // auto_key kemur með 0046 — falla á eldri lögun ef dálkinn vantar
  const chQ = (cols: string) => supabase.from("channels").select(cols).eq("company_id", me.companyId);
  const [chRes, { data: auth }, people, unread] = await Promise.all([
    chQ("id, name, kind, created_at, photo_url, auto_key"),
    supabase.auth.getUser(),
    peopleMap(me.companyId),
    unreadCounts(),
  ]);
  type Ch = { id: string; name: string; kind: string; created_at: string; photo_url: string | null; auto_key?: string | null };
  let channels = (chRes.error ? (await chQ("id, name, kind, created_at, photo_url")).data ?? [] : chRes.data ?? []) as unknown as Ch[];
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
  // VAKTO stofnar engar rásir sjálft: eldri „Almennt“ og deildar-/staðarrásir eru venjuleg
  // samtöl og birtast aðeins hafi einhver skrifað í þær (tómar ónotaðar rásir hverfa).
  const legacy = channels.filter((c) => (c.kind === "general" || !!c.auto_key) && !lastBy.has(c.id));
  if (legacy.length) {
    const used = await Promise.all(legacy.map(async (c) => {
      const { data } = await supabase.from("messages").select("id").eq("channel_id", c.id).limit(1);
      return (data ?? []).length > 0 ? c.id : null;
    }));
    const keep = new Set(used.filter(Boolean) as string[]);
    channels = channels.filter((c) => !legacy.includes(c) || keep.has(c.id));
  }
  const createdBy = new Map(channels.map((c) => [c.id, c.created_at]));

  const conv: Conversation[] = channels.map((c) => {
    const last = lastBy.get(c.id);
    const mem = memBy.get(c.id) ?? [];
    const otherId = c.kind === "dm" ? mem.find((u) => u !== myId) : undefined;
    const other = otherId ? (people.get(otherId) ?? { userId: otherId, name: "Samtal", color: null, photo: null, role: null, dept: null }) : null;
    return {
      id: c.id,
      name: c.kind === "dm" ? (other?.name ?? tr("Samtal")) : c.kind === "general" ? tr(c.name || "Almennt") : c.name,
      kind: c.kind as Conversation["kind"],
      last: last ? (last.kind === "text" ? last.body : last.kind === "image" ? tr("📷 Mynd") : last.kind === "file" ? `📎 ${last.body || tr("Skjal")}` : tr("🎤 Talskilaboð")) : null,
      lastAt: last?.at ?? null,
      lastFrom: last ? (last.from === myId ? tr("Þú") : (people.get(last.from)?.name.split(/\s+/)[0] ?? null)) : null,
      unread: unread[c.id] ?? 0,
      photo: c.kind === "dm" ? (other?.photo ?? null) : (c.photo_url ?? null),
      color: c.kind === "dm" ? (other?.color ?? null) : null,
      members: c.kind === "general" ? people.size : mem.length,
      other,
    };
  });
  // nýjasta virkni efst, ekkert fest (nýr tómur hópur raðast eftir stofndegi)
  const at = (c: Conversation) => c.lastAt ?? createdBy.get(c.id) ?? "";
  return conv.sort((a, b) => at(b).localeCompare(at(a)));
}

/** Síðustærð spjallþráðar: NÝJUSTU skilaboðin; eldri sótt með bendli („Sýna eldri skilaboð“). */
export const CHAT_PAGE = 100;
export type MessageCursor = { createdAt: string; id: string };

/** Nýjasta síða þráðar — eða, með `before`, síðan á undan bendlinum — í tímaröð
 * (elst fyrst). `hasMore` = eldri skilaboð eru til. */
export async function listMessages(me: Me, channelId: string, before?: MessageCursor | null): Promise<{ messages: ChatMessage[]; reads: ChannelRead[]; hasMore: boolean }> {
  // nýjast fyrst + limit (ein aukaröð segir hvort eldri séu til), svo snúið við;
  // bendill á (created_at, id) svo jafnir tímastimplar detta aldrei út
  let q = supabase.from("messages").select("id, sender_id, body, kind, attachment_url, created_at, reply_to, message_reactions(user_id, emoji)").eq("channel_id", channelId);
  if (before) q = q.or(`created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt.${before.id})`);
  const [{ data: rows }, people, { data: auth }, { data: reads }] = await Promise.all([
    q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(CHAT_PAGE + 1),
    peopleMap(me.companyId),
    supabase.auth.getUser(),
    before ? Promise.resolve({ data: [] as { user_id: string; last_read_at: string }[] }) : supabase.from("channel_reads").select("user_id, last_read_at").eq("channel_id", channelId),
  ]);
  const hasMore = (rows ?? []).length > CHAT_PAGE;
  const msgs = (rows ?? []).slice(0, CHAT_PAGE).reverse();
  const myId = auth.user?.id;
  const byId = new Map<string, { sender_id: string; body: string | null }>(msgs.map((m) => [m.id, m]));
  // tilvitnuð skilaboð utan síðunnar: sækja bara þær raðir (eytt → engin tilvitnun)
  const missing = [...new Set(msgs.map((m) => m.reply_to as string | null).filter((x): x is string => !!x && !byId.has(x)))];
  if (missing.length) {
    const { data: extra } = await supabase.from("messages").select("id, sender_id, body").in("id", missing);
    for (const r of extra ?? []) byId.set(r.id, r);
  }
  const messages: ChatMessage[] = msgs.map((m) => {
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
  return { messages, reads: readsOut, hasMore };
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

/** Senda mynd (þegar hlaðið upp í `chat` bucket). */
export async function sendChatImage(me: Me, channelId: string, url: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { error } = await supabase.from("messages").insert({ company_id: me.companyId, channel_id: channelId, sender_id: auth.user.id, body: "", kind: "image", attachment_url: url });
  if (error) return { ok: false, error: error.message };
  markChannelRead(channelId).catch(() => {});
  return { ok: true };
}

/** Hlaða skrá (mynd/skjal) í `chat` bucket og skila opinberri slóð. */
export async function uploadChatFile(me: Me, uri: string, name: string, contentType: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
    const path = `${me.companyId}/chat/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("chat").upload(path, buf, { contentType, upsert: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, url: supabase.storage.from("chat").getPublicUrl(path).data.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Senda skjal (kind "file", body = skráarnafn). */
export async function sendChatFile(me: Me, channelId: string, url: string, fileName: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { error } = await supabase.from("messages").insert({ company_id: me.companyId, channel_id: channelId, sender_id: auth.user.id, body: fileName, kind: "file", attachment_url: url });
  if (error) return { ok: false, error: error.message };
  markChannelRead(channelId).catch(() => {});
  return { ok: true };
}

export type Attachment = { id: string; kind: "image" | "file" | "audio"; url: string; name: string; at: string; sender: string };
/** Myndir og skjöl sem hafa verið send í rásina. */
export async function listAttachments(me: Me, channelId: string): Promise<Attachment[]> {
  const [{ data }, people] = await Promise.all([
    supabase.from("messages").select("id, kind, body, attachment_url, created_at, sender_id").eq("channel_id", channelId).not("attachment_url", "is", null).order("created_at", { ascending: false }).limit(200),
    peopleMap(me.companyId),
  ]);
  return (data ?? []).map((m) => ({ id: m.id, kind: (m.kind === "image" ? "image" : m.kind === "audio" ? "audio" : "file") as Attachment["kind"], url: m.attachment_url as string, name: m.kind === "image" ? "Mynd" : (m.body || "Skjal"), at: m.created_at, sender: people.get(m.sender_id)?.name.split(/\s+/)[0] ?? "" }));
}

/** Yfirgefa hóp/einkaspjall (ekki eldra „Almennt“ — þar er aðild óbein). */
export async function leaveChannel(channelId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { error } = await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", auth.user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Stofna hópspjall með nafni og meðlimum. */
export async function createGroup(me: Me, name: string, memberUserIds: string[]): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data: ch, error } = await supabase.from("channels").insert({ company_id: me.companyId, name: name.trim(), kind: "group", created_by: auth.user.id }).select("id").single();
  if (error || !ch) return { ok: false, error: error?.message ?? "Villa" };
  const ids = Array.from(new Set([auth.user.id, ...memberUserIds]));
  const { error: mErr } = await supabase.from("channel_members").insert(ids.map((u) => ({ channel_id: ch.id, user_id: u })));
  if (mErr) return { ok: false, error: mErr.message };
  return { ok: true, id: ch.id as string };
}
