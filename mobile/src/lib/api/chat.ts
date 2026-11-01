// Spjall — beint á Supabase (channels / channel_members / messages /
// message_reactions / channel_reads) með realtime, eins og vefurinn.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { tr, trf, getLang } from "../../../src/lib/i18n";
import { supabase } from "../supabase";
import { notifyServer } from "./notify";
import type { Me } from "./me";
import { colorFor } from "../avatar";

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
  faces: Person[]; // hópur án myndar: tveir síðustu sem sendu (aðrir en ég), annars meðlimir — eins og á Facebook
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
  /** Sendandi breytti textanum (0100). */
  edited?: boolean;
  reactions: Reaction[];
  replyTo: { sender: string; body: string } | null;
};
/** Eitt emoji á skilaboðum og hverjir settu það („Viðbrögð“, eins og í Messenger). */
export type ReactionWho = { userId: string; name: string; color: string | null; photo: string | null; me: boolean };
export type Reaction = { emoji: string; count: number; mine: boolean; who: ReactionWho[] };
export type ChannelRead = { userId: string; name: string; lastReadAt: string; color: string | null; photo: string | null };

let peopleCache: { companyId: string; at: number; map: Map<string, Person> } | null = null;
/** Innskráður notandi úr lotunni í minni — ekkert netkall (getUser fer á þjóninn í hvert sinn og hægði á
 * sendingu og „séð“). RLS sannreynir notandann hvort sem er. */
export async function authUser(): Promise<{ data: { user: { id: string } | null } }> {
  const { data } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null } };
}

export async function peopleMap(companyId: string, force = false): Promise<Map<string, Person>> {
  if (!force && peopleCache && peopleCache.companyId === companyId && Date.now() - peopleCache.at < 60000) return peopleCache.map;
  const { data } = await supabase
    .from("coworkers")
    .select("id, user_id, full_name, avatar_color, photo_url, title, status, department_id, location_id, positions(name), departments(name), locations(name)")
    .eq("company_id", companyId)
    .not("user_id", "is", null);
  const m = new Map<string, Person>();
  for (const r of data ?? []) {
    const pos = (Array.isArray(r.positions) ? r.positions[0] : r.positions) as { name?: string } | null;
    const dep = (Array.isArray(r.departments) ? r.departments[0] : r.departments) as { name?: string } | null;
    const loc = (Array.isArray(r.locations) ? r.locations[0] : r.locations) as { name?: string } | null;
    m.set(r.user_id as string, {
      userId: r.user_id as string, name: r.full_name, color: (r.avatar_color as string | null) ?? colorFor(r.id as string), photo: r.photo_url, role: r.title ?? pos?.name ?? null, dept: dep?.name ?? null,
      deptId: r.department_id ?? null, locId: r.location_id ?? null, loc: loc?.name ?? null, active: r.status !== "inactive",
    });
  }
  peopleCache = { companyId, at: Date.now(), map: m };
  return m;
}
export async function listPeople(me: Me): Promise<Person[]> {
  const { data: auth } = await authUser();
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
  const { data: auth } = await authUser();
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
    authUser(),
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
  const sendersBy = new Map<string, string[]>(); // nýjast fyrst, einstök
  for (const m of msgs ?? []) {
    const l = sendersBy.get(m.channel_id) ?? [];
    if (m.sender_id !== myId && !l.includes(m.sender_id) && l.length < 2) sendersBy.set(m.channel_id, [...l, m.sender_id]);
  }
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
      color: c.kind === "dm" ? (other?.color ?? null) : colorFor(c.id),
      members: c.kind === "general" ? people.size : mem.length,
      other,
      faces: c.kind === "group" && !c.photo_url
        ? [...new Set([...(sendersBy.get(c.id) ?? []), ...mem.filter((u) => u !== myId)])].slice(0, 2).map((u) => people.get(u)).filter((x): x is Person => !!x)
        : [],
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
export async function listMessages(me: Me, channelId: string, before?: MessageCursor | null): Promise<{ messages: ChatMessage[]; reads: ChannelRead[]; hasMore: boolean; myReadAt: string | null }> {
  // nýjast fyrst + limit (ein aukaröð segir hvort eldri séu til), svo snúið við;
  // bendill á (created_at, id) svo jafnir tímastimplar detta aldrei út
  // edited_at kemur með 0100 — eldri grunnur svarar villu og þá er sótt án hans
  type Row = { id: string; sender_id: string; body: string | null; kind: string | null; attachment_url: string | null; created_at: string; reply_to: string | null; edited_at?: string | null; message_reactions: { user_id: string; emoji: string }[] | null };
  const page = async (withEdited: boolean): Promise<{ data: Row[] | null; error: unknown }> => {
    const cols = "id, sender_id, body, kind, attachment_url, created_at, reply_to, message_reactions(user_id, emoji)" + (withEdited ? ", edited_at" : "");
    let q = supabase.from("messages").select(cols as "*").eq("channel_id", channelId);
    if (before) q = q.or(`created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt.${before.id})`);
    return (await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(CHAT_PAGE + 1)) as unknown as { data: Row[] | null; error: unknown };
  };
  const rowsP = page(true).then(async (r) => (r.error ? await page(false) : r));
  const [{ data: rows }, people, { data: auth }, { data: reads }] = await Promise.all([
    rowsP,
    peopleMap(me.companyId),
    authUser(),
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
    const counts = new Map<string, Reaction>();
    for (const r of rx) {
      const c = counts.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, who: [] };
      const pp = people.get(r.user_id);
      c.count++; if (r.user_id === myId) c.mine = true;
      c.who.push({ userId: r.user_id, name: pp?.name ?? "Notandi", color: pp?.color ?? null, photo: pp?.photo ?? null, me: r.user_id === myId });
      counts.set(r.emoji, c);
    }
    const rt = m.reply_to ? byId.get(m.reply_to) : null;
    return {
      id: m.id, senderId: m.sender_id, sender: full.split(/\s+/)[0], senderFull: full, color: p?.color ?? null, photo: p?.photo ?? null,
      me: m.sender_id === myId, body: m.body ?? "", at: new Date(m.created_at).toTimeString().slice(0, 5), createdAt: m.created_at,
      kind: (m.kind ?? "text") as ChatMessage["kind"], url: m.attachment_url, edited: !!m.edited_at,
      reactions: [...counts.values()],
      replyTo: rt ? { sender: (people.get(rt.sender_id)?.name ?? "Notandi").split(/\s+/)[0], body: rt.body ?? "" } : null,
    };
  });
  const readsOut: ChannelRead[] = (reads ?? []).filter((r) => r.user_id !== myId).map((r) => ({ userId: r.user_id, name: people.get(r.user_id)?.name ?? "", lastReadAt: r.last_read_at, color: people.get(r.user_id)?.color ?? null, photo: people.get(r.user_id)?.photo ?? null }));
  // hvenær ég las síðast (fyrir „Ólesin skilaboð“-línuna) — lesið ÁÐUR en þráðurinn er merktur lesinn
  const myReadAt = (reads ?? []).find((r) => r.user_id === myId)?.last_read_at ?? null;
  return { messages, reads: readsOut, hasMore, myReadAt };
}

export async function sendChatMessage(me: Me, channelId: string, body: string, replyTo?: string | null): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: auth } = await authUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data, error } = await supabase.from("messages").insert({ company_id: me.companyId, channel_id: channelId, sender_id: auth.user.id, body, kind: "text", reply_to: replyTo ?? null }).select("id").single();
  if (error) return { ok: false, error: error.message };
  markChannelRead(channelId).catch(() => {});
  if (data?.id) notifyServer("chat_message", data.id as string);
  return { ok: true, id: data?.id as string };
}

export async function setReaction(me: Me, messageId: string, emoji: string | null): Promise<void> {
  const { data: auth } = await authUser();
  if (!auth.user) return;
  if (!emoji) await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", auth.user.id);
  else await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: auth.user.id, company_id: me.companyId, emoji }, { onConflict: "message_id,user_id" });
}

/** Breyta texta eigin skilaboða (0100: aðeins body, edited_at sett í grunninum). */
export async function editMessage(messageId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.from("messages").update({ body }).eq("id", messageId).select("id");
  if (error) return { ok: false, error: error.message };
  return (data ?? []).length ? { ok: true } : { ok: false, error: tr("Ekki hægt að breyta þessum skilaboðum") };
}

const API = (process.env.EXPO_PUBLIC_API_URL ?? "https://www.vakto.is").replace(/\/$/, "");
/** Þýðir skilaboð á tungumál appsins (VAKTO AI á vefnum, /api/app/chat/translate). */
export async function translateMessage(messageId: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) return { ok: false, error: tr("Ekki innskráð(ur)") };
  try {
    const r = await fetch(`${API}/api/app/chat/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ messageId, lang: getLang() }),
    });
    const j = (await r.json()) as { ok?: boolean; text?: string; error?: string };
    return j.ok && j.text ? { ok: true, text: j.text } : { ok: false, error: j.error ?? tr("Þýðing tókst ekki") };
  } catch { return { ok: false, error: tr("Þýðing tókst ekki") }; }
}

/** Sjálfvirk þýðing (0103): þýðir mörg skilaboð í einu á tungumál appsins (vistað á þjóninum).
 *  Skilar { id: texti } aðeins fyrir skilaboð sem eru á öðru máli. */
export async function translateBatch(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) return {};
  try {
    const r = await fetch(`${API}/api/app/chat/translate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ ids: ids.slice(-40), lang: getLang() }),
    });
    const j = (await r.json()) as { translations?: Record<string, string | null> };
    return Object.fromEntries(Object.entries(j.translations ?? {}).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch { return {}; }
}

/** 'on' | 'off' | null (null = kveikt ef appið er ekki á íslensku). */
export async function getChatTranslate(): Promise<"on" | "off" | null> {
  const { data: auth } = await authUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from("users").select("chat_translate").eq("id", auth.user.id).maybeSingle();
  if (error) return null; // fyrir 0103
  const v = (data as { chat_translate?: string } | null)?.chat_translate;
  return v === "on" || v === "off" ? v : null;
}

export async function setChatTranslate(v: "on" | "off"): Promise<boolean> {
  const { data: auth } = await authUser();
  if (!auth.user) return false;
  return !(await supabase.from("users").update({ chat_translate: v }).eq("id", auth.user.id)).error;
}

export async function deleteMessage(messageId: string): Promise<void> {
  await supabase.from("messages").delete().eq("id", messageId);
}

/** Finna eða stofna einkaspjall við annan notanda. */
export async function startDM(me: Me, otherUserId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: auth } = await authUser();
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

/** Realtime: ný og breytt skilaboð + lestrarstöður (RLS sér um afmörkun). */
export type ReadRow = { channel_id: string; user_id: string; last_read_at: string };
export function subscribeChat(onMessage: (row: { id: string; channel_id: string; sender_id: string; body: string; kind: string; created_at: string; attachment_url: string | null; reply_to: string | null }) => void, onReads?: (row: ReadRow | null) => void, onEdit?: (row: { id: string; channel_id: string; body: string }) => void): RealtimeChannel {
  return supabase
    .channel("chat-live-" + Math.random().toString(36).slice(2, 8))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => onMessage(p.new as Parameters<typeof onMessage>[0]))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => onEdit?.(p.new as { id: string; channel_id: string; body: string }))
    .on("postgres_changes", { event: "*", schema: "public", table: "channel_reads" }, (p) => onReads?.((p.new ?? null) as ReadRow | null))
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
  const { data: auth } = await authUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data, error } = await supabase.from("messages").insert({ company_id: me.companyId, channel_id: channelId, sender_id: auth.user.id, body: "", kind: "image", attachment_url: url  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  markChannelRead(channelId).catch(() => {});
  if (data?.id) notifyServer("chat_message", data.id as string);
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
  const { data: auth } = await authUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data, error } = await supabase.from("messages").insert({ company_id: me.companyId, channel_id: channelId, sender_id: auth.user.id, body: fileName, kind: "file", attachment_url: url  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  markChannelRead(channelId).catch(() => {});
  if (data?.id) notifyServer("chat_message", data.id as string);
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
  const { data: auth } = await authUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { error } = await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", auth.user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Breyta heiti hóps (allir meðlimir — RLS channels_member_update). */
export async function renameChannel(channelId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const nm = name.trim();
  if (!nm) return { ok: false, error: "Sláðu inn heiti" };
  const { data, error } = await supabase.from("channels").update({ name: nm }).eq("id", channelId).eq("kind", "group").select("id");
  if (error) return { ok: false, error: error.message };
  return data?.length ? { ok: true } : { ok: false, error: "Ekki tókst að breyta heiti" };
}

/** Stofna hópspjall með nafni og meðlimum. */
export async function createGroup(me: Me, name: string, memberUserIds: string[]): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: auth } = await authUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data: ch, error } = await supabase.from("channels").insert({ company_id: me.companyId, name: name.trim(), kind: "group", created_by: auth.user.id }).select("id").single();
  if (error || !ch) return { ok: false, error: error?.message ?? "Villa" };
  const ids = Array.from(new Set([auth.user.id, ...memberUserIds]));
  const { error: mErr } = await supabase.from("channel_members").insert(ids.map((u) => ({ channel_id: ch.id, user_id: u })));
  if (mErr) return { ok: false, error: mErr.message };
  return { ok: true, id: ch.id as string };
}
