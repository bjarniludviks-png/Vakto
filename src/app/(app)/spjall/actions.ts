"use server";

import { demoBlocked, demoResult } from "@/lib/demo.server";
import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { initials } from "@/lib/employees";
import { colorFor } from "@/lib/avatar";
import { notifyEmployee } from "@/lib/push";
import { pushChatMessage } from "@/lib/chat-push.server";
import { userError } from "@/lib/user-error";

export type Conversation = {
  id: string; name: string; kind: string; av: string; color: string; last: string; lastAt: string | null; dm: boolean; photo: string | null;
  /** Bein skilaboð: notandi viðmælandans (staða „á vakt“/virk(ur) og prófíll). */
  peerId?: string | null;
  /** Unread messages from others (server-side, `channel_reads`). */
  unread: number;
  /** Kind of the last message ('text' | 'image' | 'audio' | 'file') and whether I sent it. */
  lastKind: string | null; lastMine: boolean;
  /** Röðun: síðustu skilaboð, annars stofndagur samtalsins. */
  sortAt: string;
};
/** Another member's read cursor in a channel (read receipts). */
export type ChannelRead = { userId: string; name: string; lastReadAt: string };
export type UnreadCounts = { counts: Record<string, number>; total: number };
export type ChatMessage = {
  id: string; sender: string; senderId: string; me: boolean; body: string; at: string; kind: string; url: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  createdAt: string;
  replyTo: { sender: string; body: string } | null;
  photo: string | null;
  /** Litur upphafsstafa-hrings sendanda (sami og á starfsmannasíðum). */
  color?: string;
};
export type Person = { userId: string; name: string; av: string; color: string; photo: string | null };
/** Flýtival í hópavali: „Allir í <deild>“ / „Allir á <stað>“ — fólk með aðgang (ekki ég). */
export type TeamPick = { key: string; kind: "dept" | "loc"; name: string; people: Person[] };
export type Members = { members: Person[]; adminId: string | null; meId: string };

// Sami litur og á starfsmannasíðum/í appinu: valinn litur starfsmanns, annars fastur litur út frá auðkenni.
const FALLBACK = "#5b50e6";
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

async function ctxOf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company };
}

const empColor = (e: { id?: unknown; avatar_color?: unknown }) => (e.avatar_color as string | null) ?? (e.id ? colorFor(String(e.id)) : FALLBACK);

/** user_id → {name, photo, color} from employees — names fall back here when a users
 * row is missing (invited accounts may carry the email), photos and colors only live here. */
async function empNameMap(supabase: Awaited<ReturnType<typeof createClient>>, company: string): Promise<Map<string, { name: string; photo: string | null; color: string }>> {
  const { data } = await supabase.from("coworkers").select("id, user_id, full_name, photo_url, avatar_color").eq("company_id", company).not("user_id", "is", null);
  return new Map((data ?? []).map((e) => [e.user_id as string, { name: e.full_name as string, photo: (e.photo_url as string | null) ?? null, color: empColor(e) }]));
}

type Sb = Awaited<ReturnType<typeof createClient>>;

/** Unread-per-channel for the caller via the `chat_unread_counts` RPC — {} when
 * the RPC is not there yet (schema not up to date). */
async function unreadMap(supabase: Sb): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase.rpc("chat_unread_counts");
    if (error || !data) return {};
    const out: Record<string, number> = {};
    for (const r of data as { channel_id: string; n: number | string }[]) out[r.channel_id] = Number(r.n) || 0;
    return out;
  } catch {
    return {};
  }
}

/** Unread counts for the sidebar badge + conversation list: { counts, total }. */
export async function getUnreadCounts(): Promise<UnreadCounts> {
  if (!isSupabaseConfigured()) return { counts: {}, total: 0 };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { counts: {}, total: 0 };
    const counts = await unreadMap(supabase);
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  } catch {
    return { counts: {}, total: 0 };
  }
}

/** "I have seen everything in this channel up to now" — upsert my read cursor. */
export async function markChannelRead(channelId: string): Promise<{ ok: boolean }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured() || !channelId) return { ok: false };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false };
    const { error } = await supabase.from("channel_reads")
      .upsert({ channel_id: channelId, user_id: ctx.userId, last_read_at: new Date().toISOString() }, { onConflict: "channel_id,user_id" });
    if (error) { console.error("markChannelRead:", error.message); return { ok: false }; }
    return { ok: true };
  } catch (e) {
    console.error("markChannelRead failed:", e);
    return { ok: false };
  }
}

/** Other members' read cursors in a channel (for "Séð" under my last message). */
export async function listChannelReads(channelId: string): Promise<ChannelRead[]> {
  if (!isSupabaseConfigured() || !channelId) return [];
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return [];
    return await channelReadsOf(supabase, ctx, channelId);
  } catch {
    return [];
  }
}

async function channelReadsOf(supabase: Sb, ctx: { userId: string; company: string }, channelId: string): Promise<ChannelRead[]> {
  try {
    const [{ data, error }, emps] = await Promise.all([
      supabase.from("channel_reads").select("user_id, last_read_at, users(full_name)").eq("channel_id", channelId).neq("user_id", ctx.userId),
      empNameMap(supabase, ctx.company),
    ]);
    if (error || !data) return [];
    return data.map((r) => {
      const u = (Array.isArray(r.users) ? r.users[0] : r.users) as { full_name?: string } | null;
      const name = emps.get(r.user_id as string)?.name ?? u?.full_name ?? "?";
      return { userId: r.user_id as string, name, lastReadAt: r.last_read_at as string };
    });
  } catch {
    return [];
  }
}

/** Conversations the user can see: their groups + their DMs (+ eldra „Almennt“ ef það hefur verið notað). */
export async function listConversations(): Promise<{ ok: boolean; items: Conversation[]; meId: string; meName: string; needsMigration?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, items: [], meId: "", meName: "" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, items: [], meId: "", meName: "" };

    // Spjall eins og Messenger: VAKTO stofnar engar rásir sjálft — fólk býr til hópa.
    // auto_key arrives with 0046, photo_url with 0042 — fall back to older shapes
    let chRes = await supabase.from("channels").select("id, name, kind, created_by, created_at, photo_url, auto_key").eq("company_id", ctx.company).order("created_at");
    if (chRes.error) chRes = (await supabase.from("channels").select("id, name, kind, created_by, created_at, photo_url").eq("company_id", ctx.company).order("created_at")) as unknown as typeof chRes;
    if (chRes.error) chRes = (await supabase.from("channels").select("id, name, kind, created_by, created_at").eq("company_id", ctx.company).order("created_at")) as unknown as typeof chRes;
    if (chRes.error) return { ok: false, items: [], meId: ctx.userId, meName: "", needsMigration: true };
    let channels = chRes.data as { id: string; name: string; kind: string; created_by: string; created_at?: string; photo_url?: string | null; auto_key?: string | null }[];
    const ids = channels.map((c) => c.id);

    // member names per channel (to resolve DM titles) + last message + unread
    const [{ data: mems }, { data: msgs }, emps, unread] = await Promise.all([
      supabase.from("channel_members").select("channel_id, user_id, users(full_name)").in("channel_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("messages").select("channel_id, body, kind, created_at, sender_id").in("channel_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false }).limit(400),
      empNameMap(supabase, ctx.company),
      unreadMap(supabase),
    ]);
    const memByCh = new Map<string, { id: string; name: string; photo: string | null; color: string }[]>();
    for (const m of mems ?? []) {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      if (!memByCh.has(m.channel_id as string)) memByCh.set(m.channel_id as string, []);
      const info = emps.get(m.user_id as string);
      memByCh.get(m.channel_id as string)!.push({ id: m.user_id as string, name: info?.name ?? u?.full_name ?? "?", photo: info?.photo ?? null, color: info?.color ?? FALLBACK });
    }
    // Only channels the user actually belongs to — eldra „Almennt“ nær til alls fyrirtækisins.
    // Without this, a left/deleted group would linger in everyone's list.
    channels = channels.filter((c) => c.kind === "general" || (memByCh.get(c.id) ?? []).some((m) => m.id === ctx.userId));
    const lastByCh = new Map<string, string>();
    const lastAtByCh = new Map<string, string>();
    const lastMeta = new Map<string, { kind: string; mine: boolean }>();
    for (const m of msgs ?? []) {
      if (lastByCh.has(m.channel_id as string)) continue;
      // Plain text — the list draws a line icon for media (no emoji in UI chrome).
      lastByCh.set(m.channel_id as string, m.kind === "image" ? "Mynd" : m.kind === "audio" ? "Talskilaboð" : m.kind === "file" ? ((m.body as string) || "Skjal") : (m.body as string));
      lastAtByCh.set(m.channel_id as string, m.created_at as string);
      lastMeta.set(m.channel_id as string, { kind: (m.kind as string) ?? "text", mine: m.sender_id === ctx.userId });
    }

    // Eldri sjálfvirkar rásir („Almennt“, deildar-/staðarrásir) eru nú venjuleg samtöl og
    // birtast aðeins hafi einhver skrifað í þær — ónotaðar tómar rásir hverfa úr listanum.
    const legacy = channels.filter((c) => (c.kind === "general" || !!c.auto_key) && !lastAtByCh.has(c.id));
    if (legacy.length) {
      const used = await Promise.all(legacy.map(async (c) => {
        const { data } = await supabase.from("messages").select("id").eq("channel_id", c.id).limit(1);
        return (data ?? []).length > 0 ? c.id : null;
      }));
      const keep = new Set(used.filter(Boolean) as string[]);
      channels = channels.filter((c) => !legacy.includes(c) || keep.has(c.id));
    }

    const items: Conversation[] = channels.map((c) => {
      const dm = c.kind === "dm";
      const others = (memByCh.get(c.id) ?? []).filter((m) => m.id !== ctx.userId);
      const name = c.kind === "general" ? "Almennt"
        : dm ? (others[0]?.name ?? "Bein skilaboð")
          : c.name;
      return {
        id: c.id, name, kind: c.kind, av: dm ? initials(name) : (c.kind === "general" ? "#" : initials(c.name)), color: dm ? (others[0]?.color ?? FALLBACK) : colorFor(c.id),
        last: lastByCh.get(c.id) ?? "", lastAt: lastAtByCh.get(c.id) ?? null, dm, photo: dm ? (others[0]?.photo ?? null) : (c.photo_url ?? null),
        peerId: dm ? (others[0]?.id ?? null) : null,
        unread: unread[c.id] ?? 0, sortAt: lastAtByCh.get(c.id) ?? c.created_at ?? "",
        lastKind: lastMeta.get(c.id)?.kind ?? null, lastMine: lastMeta.get(c.id)?.mine ?? false,
      };
    });
    // Nýjasta virkni efst — ekkert fest (nýr tómur hópur raðast eftir stofndegi).
    items.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
    const meName = emps.get(ctx.userId)?.name ?? (await supabase.from("users").select("full_name").eq("id", ctx.userId).maybeSingle()).data?.full_name ?? "";
    return { ok: true, items, meId: ctx.userId, meName: meName.includes("@") ? "" : meName };
  } catch (e) {
    console.error("listConversations failed:", e);
    return { ok: false, items: [], meId: "", meName: "" };
  }
}

/** Employees in the company who have an account (for DM / group members). */
export async function searchPeople(q: string): Promise<Person[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return [];
    let query = supabase.from("coworkers").select("id, user_id, full_name, photo_url, avatar_color").eq("company_id", ctx.company).not("user_id", "is", null).limit(40);
    if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
    const { data } = await query;
    return (data ?? [])
      .filter((e) => e.user_id && e.user_id !== ctx.userId)
      .map((e) => ({ userId: e.user_id as string, name: e.full_name as string, av: initials(e.full_name as string), color: empColor(e), photo: (e.photo_url as string | null) ?? null }));
  } catch {
    return [];
  }
}

/** Deildir og staðir sem hafa starfsfólk með aðgang — til að bæta öllum hópnum í einu. */
export async function listTeamPicks(): Promise<TeamPick[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return [];
    const { data } = await supabase.from("coworkers").select("id, user_id, full_name, photo_url, avatar_color, status, department_id, location_id, departments(name), locations(name)")
      .eq("company_id", ctx.company).not("user_id", "is", null);
    const by = new Map<string, TeamPick>();
    for (const e of data ?? []) {
      if (!e.user_id || e.user_id === ctx.userId || e.status === "inactive") continue;
      const dep = (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } | null;
      const loc = (Array.isArray(e.locations) ? e.locations[0] : e.locations) as { name?: string } | null;
      const full = e.full_name as string;
      const person: Person = { userId: e.user_id as string, name: full, av: initials(full), color: empColor(e), photo: (e.photo_url as string | null) ?? null };
      const add = (key: string, kind: TeamPick["kind"], name?: string) => {
        if (!name) return;
        const t = by.get(key) ?? { key, kind, name, people: [] };
        if (!t.people.some((x) => x.userId === person.userId)) t.people.push(person);
        by.set(key, t);
      };
      if (e.department_id) add(`dept:${e.department_id}`, "dept", dep?.name);
      if (e.location_id) add(`loc:${e.location_id}`, "loc", loc?.name);
    }
    // Deildir fyrst, svo staðir; tvær deildir með sama heiti (á ólíkum stöðum) sameinast ekki.
    return [...by.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "is") : a.kind === "dept" ? -1 : 1));
  } catch {
    return [];
  }
}

/** Find or create a 1:1 DM with another user. */
export async function startDM(otherUserId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
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
    if (error || !ch) return { ok: false, error: userError(error, "Villa") };
    await supabase.from("channel_members").insert([{ channel_id: ch.id, user_id: ctx.userId }, { channel_id: ch.id, user_id: otherUserId }]);
    return { ok: true, id: ch.id as string };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function createGroup(name: string, memberUserIds: string[]): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const nm = name.trim();
  if (!nm) return { ok: false, error: "Sláðu inn heiti" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: ch, error } = await supabase.from("channels")
      .insert({ company_id: ctx.company, name: nm, kind: "group", created_by: ctx.userId }).select("id").single();
    if (error || !ch) return { ok: false, error: userError(error, "Villa") };
    const uniq = Array.from(new Set([ctx.userId, ...memberUserIds]));
    await supabase.from("channel_members").insert(uniq.map((u) => ({ channel_id: ch.id, user_id: u })));
    return { ok: true, id: ch.id as string };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
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
      const info = emps.get(m.user_id as string);
      const name = info?.name ?? u?.full_name ?? "?";
      return { userId: m.user_id as string, name, av: initials(name), color: info?.color ?? FALLBACK, photo: info?.photo ?? null };
    });
    return { members, adminId: (ch?.created_by as string) ?? null, meId: ctx.userId };
  } catch {
    return empty;
  }
}

export async function addMembers(channelId: string, userIds: string[]): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("channel_members").upsert(userIds.map((u) => ({ channel_id: channelId, user_id: u })), { onConflict: "channel_id,user_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: userError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function removeMember(channelId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: ch } = await supabase.from("channels").select("created_by").eq("id", channelId).maybeSingle();
    if ((ch?.created_by as string) !== ctx.userId) return { ok: false, error: "Aðeins stofnandi getur fjarlægt" };
    const { error } = await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", userId);
    if (error) return { ok: false, error: userError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function leaveChannel(channelId: string): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", ctx.userId);
    if (error) return { ok: false, error: userError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Page size of a thread fetch: the NEWEST `CHAT_PAGE` messages; older pages via a cursor. */
const CHAT_PAGE = 100;
/** Cursor for "Sýna eldri skilaboð": the oldest message currently loaded. */
export type MessageCursor = { createdAt: string; id: string };
export type MessagesPage = { ok: boolean; messages: ChatMessage[]; reads: ChannelRead[]; hasMore: boolean };
type MsgRow = { id: string; body: string | null; kind: string | null; attachment_url: string | null; created_at: string; sender_id: string; reply_to?: string | null; users: unknown };

/** A thread's newest page — or, with `before`, the page right before that
 * cursor — returned oldest-first for display. `hasMore` = older ones exist. */
export async function listMessages(channelId: string, before?: MessageCursor | null): Promise<MessagesPage> {
  const empty: MessagesPage = { ok: false, messages: [], reads: [], hasMore: false };
  if (!isSupabaseConfigured() || !channelId) return empty;
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return empty;
    const readsP = before ? Promise.resolve([] as ChannelRead[]) : channelReadsOf(supabase, ctx, channelId);
    // Newest first + limit (one extra row says whether older ones exist), then
    // reversed for display. Keyset cursor on (created_at, id): equal stamps never skip.
    const page = (cols: string) => {
      let q = supabase.from("messages").select(cols).eq("company_id", ctx.company).eq("channel_id", channelId);
      if (before) q = q.or(`created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt.${before.id})`);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(CHAT_PAGE + 1);
    };
    // reply_to arrives with 0042 — fall back to the old shape before it runs
    let res = await page("id, body, kind, attachment_url, created_at, sender_id, reply_to, users(full_name)");
    if (res.error) res = await page("id, body, kind, attachment_url, created_at, sender_id, users(full_name)");
    if (res.error) console.error("listMessages:", res.error.message);
    const rows = (res.data ?? []) as unknown as MsgRow[];
    const hasMore = rows.length > CHAT_PAGE;
    const data = rows.slice(0, CHAT_PAGE).reverse();

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

    // employees carry both the real name (users.full_name may hold an email for
    // invited accounts) and the profile photo shown next to bubbles.
    const usersName = (m: (typeof data)[number]) =>
      ((Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null)?.full_name;
    const emps = await empNameMap(supabase, ctx.company);
    const senderOf = (m: (typeof data)[number]) => {
      const u = usersName(m);
      const best = !u || u.includes("@") ? (emps.get(m.sender_id as string)?.name ?? u) : u;
      return (best ?? "—").split(/\s+/)[0];
    };
    const byId = new Map<string, MsgRow>(data.map((m) => [m.id, m]));
    // Quoted messages older than the loaded page: fetch just those rows so the
    // quote still renders (a deleted target simply shows no quote).
    const missing = [...new Set(data.map((m) => m.reply_to).filter((x): x is string => !!x && !byId.has(x)))];
    if (missing.length) {
      const { data: extra } = await supabase.from("messages")
        .select("id, body, kind, attachment_url, created_at, sender_id, users(full_name)")
        .eq("company_id", ctx.company).in("id", missing);
      for (const r of (extra ?? []) as unknown as MsgRow[]) byId.set(r.id, r);
    }
    const messages: ChatMessage[] = data.map((m) => {
      const rt = "reply_to" in m && m.reply_to ? byId.get(m.reply_to as string) : undefined;
      return {
        id: m.id as string, sender: senderOf(m), senderId: m.sender_id as string,
        me: m.sender_id === ctx.userId, body: (m.body as string) ?? "", at: hhmm(m.created_at as string),
        kind: (m.kind as string) ?? "text", url: (m.attachment_url as string) ?? null,
        createdAt: m.created_at as string,
        reactions: (reactByMsg.get(m.id as string) ?? []).sort((a, b) => b.count - a.count),
        replyTo: rt ? { sender: senderOf(rt), body: rt.kind === "image" ? "📷 Mynd" : rt.kind === "audio" ? "🎤 Talskilaboð" : ((rt.body as string) ?? "") } : null,
        photo: emps.get(m.sender_id as string)?.photo ?? null,
        color: emps.get(m.sender_id as string)?.color,
      };
    });
    return { ok: true, messages, reads: await readsP, hasMore };
  } catch (e) {
    console.error("listMessages failed:", e);
    return empty;
  }
}

/** Media & files in a thread (newest first) for the details panel. RLS scopes to channels I can read. */
export type ChatMedia = { id: string; kind: string; url: string; name: string; createdAt: string };
export async function listChatMedia(channelId: string): Promise<ChatMedia[]> {
  if (!isSupabaseConfigured() || !channelId) return [];
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return [];
    const { data } = await supabase.from("messages")
      .select("id, kind, body, attachment_url, created_at")
      .eq("company_id", ctx.company).eq("channel_id", channelId).not("attachment_url", "is", null)
      .order("created_at", { ascending: false }).limit(36);
    return (data ?? []).map((m) => ({ id: m.id as string, kind: (m.kind as string) ?? "file", url: m.attachment_url as string, name: (m.body as string) ?? "", createdAt: m.created_at as string }));
  } catch {
    return [];
  }
}

/** Search one thread's text messages (newest first, max 30). */
export type ChatHit = { id: string; sender: string; body: string; createdAt: string };
export async function searchChannelMessages(channelId: string, q: string): Promise<ChatHit[]> {
  const term = q.trim().slice(0, 80);
  if (!isSupabaseConfigured() || !channelId || term.length < 2) return [];
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return [];
    // ILIKE wildcards in the term are literal characters
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const [{ data }, emps] = await Promise.all([
      supabase.from("messages").select("id, body, sender_id, created_at")
        .eq("company_id", ctx.company).eq("channel_id", channelId).eq("kind", "text").ilike("body", like)
        .order("created_at", { ascending: false }).limit(30),
      empNameMap(supabase, ctx.company),
    ]);
    return (data ?? []).map((m) => ({
      id: m.id as string, body: (m.body as string) ?? "", createdAt: m.created_at as string,
      sender: m.sender_id === ctx.userId ? "Ég" : (emps.get(m.sender_id as string)?.name ?? "—").split(/\s+/)[0],
    }));
  } catch {
    return [];
  }
}

export async function sendChatMessage(channelId: string, body: string, kind: "text" | "image" | "audio" = "text", attachmentUrl?: string, replyTo?: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
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
    let inserted: { id: string } | null = null;
    if (replyTo) {
      ({ data: inserted, error } = await supabase.from("messages").insert({ ...row, reply_to: replyTo } as never).select("id").single());
      if (error) ({ data: inserted, error } = await supabase.from("messages").insert(row).select("id").single());
    } else {
      ({ data: inserted, error } = await supabase.from("messages").insert(row).select("id").single());
    }
    if (error) return { ok: false, error: userError(error) };
    // Push to the other channel members AFTER the response is sent — the sender
    // never waits for the member lookup or the push provider.
    if (inserted?.id) { const mid = inserted.id; after(() => pushChatMessage(mid)); }
    return { ok: true, id: inserted?.id };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** One emoji reaction per user per message — emoji sets/updates, null removes. */
export async function setMessageReaction(messageId: string, emoji: string | null): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (emoji) {
      const { error } = await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: ctx.userId, company_id: ctx.company, emoji });
      if (error) return { ok: false, error: "Viðbrögð eru ekki virk" };
    } else {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", ctx.userId);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Villa" };
  }
}

/** Unsend: delete your own message (RLS-enforced). */
export async function deleteMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", ctx.userId).select("id");
    if (error) return { ok: false, error: userError(error) };
    if (!data?.length) return { ok: false, error: "Ekki tókst að eyða skilaboðunum" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Rename a group (any member — RLS `channels_member_update`). */
export async function renameChannel(channelId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const nm = name.trim();
  if (!nm) return { ok: false, error: "Sláðu inn heiti" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("channels").update({ name: nm }).eq("id", channelId).eq("kind", "group").select("id");
    if (error) return { ok: false, error: userError(error) };
    if (!data?.length) return { ok: false, error: "Ekki tókst að breyta heiti" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Set a group photo: upload (base64 data URL) to the chat bucket + save on the channel. */
export async function setChannelPhoto(channelId: string, dataUrl: string, ext: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (await demoBlocked()) return demoResult();
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
    if (up.error) return { ok: false, error: userError(up.error) };
    const { data: pub } = supabase.storage.from("chat").getPublicUrl(path);
    const { data, error } = await supabase.from("channels").update({ photo_url: pub.publicUrl }).eq("id", channelId).select("id");
    if (error) return { ok: false, error: "Ekki tókst að vista mynd" };
    if (!data?.length) return { ok: false, error: "Ekki tókst að vista mynd" };
    return { ok: true, url: pub.publicUrl };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Upload an image/voice clip (base64 data URL) to the chat bucket; returns public URL. */
export async function uploadChatMedia(dataUrl: string, ext: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (await demoBlocked()) return demoResult();
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
    if (error) return { ok: false, error: userError(error) };
    const { data } = supabase.storage.from("chat").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/* ---------- news feed (posts + likes + comments) ---------- */

export type FeedComment = { id: string; sender: string; av: string; color: string; body: string; at: string; atISO: string; photo: string | null; parentId: string | null };
export type FeedAudience = { kind: "all" | "department" | "location"; id: string | null; name: string };
export type FeedPost = {
  id: string; sender: string; av: string; color: string; me: boolean; photo: string | null;
  audience: string | null; // "Eldhús" / "Laugavegur" / null = allir
  body: string; at: string; atISO: string; pinned: boolean; system: boolean;
  imageUrl: string | null; fileUrl: string | null; fileName: string | null;
  reactions: { emoji: string; count: number }[];
  myReaction: string | null;
  comments: FeedComment[];
};

/** Latest 50 posts with likes + comments, newest first. */
export async function listPosts(): Promise<{ ok: boolean; posts: FeedPost[]; meId: string; canPin: boolean; canPost: boolean; audiences: FeedAudience[]; mePhoto: string | null }> {
  if (!isSupabaseConfigured()) return { ok: false, posts: [], meId: "", canPin: false, canPost: false, audiences: [], mePhoto: null };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, posts: [], meId: "", canPin: false, canPost: false, audiences: [], mePhoto: null };
    const { data: meRow } = await supabase.from("users").select("role").eq("id", ctx.userId).maybeSingle();
    const canPin = meRow?.role === "owner" || meRow?.role === "manager";
    // 0054: birtingarheimild + markhópar (þolir grunn án dálkanna)
    const polRes = await supabase.from("companies").select("feed_post_policy").eq("id", ctx.company).maybeSingle();
    const policy = polRes.error ? "everyone" : ((polRes.data?.feed_post_policy as string) ?? "everyone");
    const canPost = canPin || policy === "everyone";
    const [{ data: deps }, { data: locs }] = await Promise.all([
      supabase.from("departments").select("id, name, locations!inner(company_id, name)").eq("locations.company_id", ctx.company).order("name"),
      supabase.from("locations").select("id, name").eq("company_id", ctx.company).order("name"),
    ]);
    const depLabel = (d: { name: unknown; locations?: unknown }) => {
      const dup = (deps ?? []).filter((x) => x.name === d.name).length > 1;
      const loc = (Array.isArray(d.locations) ? d.locations[0] : d.locations) as { name?: string } | null;
      return dup && loc?.name ? `${d.name} · ${loc.name}` : (d.name as string);
    };
    const audiences: FeedAudience[] = [{ kind: "all", id: null, name: "Allir" }];
    if (canPin) {
      for (const d of deps ?? []) audiences.push({ kind: "department", id: d.id as string, name: depLabel(d) });
      if ((locs ?? []).length > 1) for (const l of locs ?? []) audiences.push({ kind: "location", id: l.id as string, name: l.name as string });
    }
    const audName = (kind: unknown, id: unknown): string | null =>
      kind === "department" ? (() => { const d = (deps ?? []).find((x) => x.id === id); return d ? depLabel(d) : "Deild"; })()
      : kind === "location" ? ((locs ?? []).find((l) => l.id === id)?.name as string) ?? "Staður" : null;
    let rowsRes = await supabase
      .from("posts").select("id, sender_id, body, created_at, image_url, file_url, file_name, pinned, audience_kind, audience_id, users!posts_sender_id_fkey(full_name)")
      .eq("company_id", ctx.company).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
    if (rowsRes.error) rowsRes = (await supabase
      .from("posts").select("id, sender_id, body, created_at, image_url, file_url, file_name, pinned, users!posts_sender_id_fkey(full_name)")
      .eq("company_id", ctx.company).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50)) as unknown as typeof rowsRes;
    const rows = rowsRes.data as ({ audience_kind?: string; audience_id?: string | null } & Record<string, unknown>)[] | null;
    const ids = (rows ?? []).map((r) => r.id as string);
    const [{ data: likes }, { data: comments }, empNames] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id, reaction").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_comments").select("id, post_id, sender_id, body, created_at, parent_id, users!post_comments_sender_id_fkey(full_name)").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at")
        // parent_id arrives with 0048 — fall back to flat comments before it runs
        .then(async (r) => r.error ? await supabase.from("post_comments").select("id, post_id, sender_id, body, created_at, users!post_comments_sender_id_fkey(full_name)").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at") : r),
      empNameMap(supabase, ctx.company),
    ]);
    // Prefer the employee's real name — users.full_name can hold the email
    // (or nothing) for invited accounts.
    const nameOf = (u: unknown, senderId?: unknown) =>
      (senderId ? empNames.get(String(senderId))?.name : undefined) ??
      ((Array.isArray(u) ? u[0] : u) as { full_name?: string } | null)?.full_name ?? "Notandi";
    const posts: FeedPost[] = (rows ?? []).map((r) => {
      const system = !r.sender_id;
      const name = system ? "VAKTO" : nameOf(r.users, r.sender_id);
      const pLikes = (likes ?? []).filter((l) => l.post_id === r.id);
      const byEmoji = new Map<string, number>();
      for (const l of pLikes) byEmoji.set((l.reaction as string) || "❤️", (byEmoji.get((l.reaction as string) || "❤️") ?? 0) + 1);
      return {
        id: r.id as string, sender: name,
        audience: audName(r.audience_kind, r.audience_id),
        av: system ? "VK" : initials(name),
        photo: system ? null : (empNames.get(String(r.sender_id))?.photo ?? null),
        color: system ? "#e9700f" : (empNames.get(String(r.sender_id))?.color ?? FALLBACK),
        pinned: !!r.pinned, system,
        me: r.sender_id === ctx.userId,
        body: r.body as string, at: hhmm(r.created_at as string) + " · " + new Date(r.created_at as string).toLocaleDateString("de-DE").replace(/\./g, "."), atISO: String(r.created_at),
        imageUrl: (r.image_url as string) ?? null, fileUrl: (r.file_url as string) ?? null, fileName: (r.file_name as string) ?? null,
        reactions: [...byEmoji.entries()].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count),
        myReaction: (pLikes.find((l) => l.user_id === ctx.userId)?.reaction as string) ?? null,
        comments: (comments ?? []).filter((cm) => cm.post_id === r.id).map((cm) => {
          const cn = nameOf(cm.users, cm.sender_id);
          return { id: cm.id as string, sender: cn, av: initials(cn), color: empNames.get(String(cm.sender_id))?.color ?? FALLBACK, body: cm.body as string, at: hhmm(cm.created_at as string), atISO: String(cm.created_at), photo: empNames.get(String(cm.sender_id))?.photo ?? null, parentId: ("parent_id" in cm ? (cm.parent_id as string | null) : null) ?? null };
        }),
      };
    });
    return { ok: true, posts, meId: ctx.userId, canPin, canPost, audiences, mePhoto: empNames.get(ctx.userId)?.photo ?? null };
  } catch {
    return { ok: false, posts: [], meId: "", canPin: false, canPost: false, audiences: [], mePhoto: null };
  }
}

/** Pin/unpin an announcement (managers + owners only — checked server-side). */
export async function setPostPinned(postId: string, pinned: boolean): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: meRow } = await supabase.from("users").select("role").eq("id", ctx.userId).maybeSingle();
    if (meRow?.role !== "owner" && meRow?.role !== "manager") return { ok: false, error: "Aðeins stjórnendur geta fest tilkynningar" };
    const { error } = await supabase.from("posts").update({ pinned }).eq("id", postId).eq("company_id", ctx.company);
    return error ? { ok: false, error: userError(error) } : { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function createPost(body: string, media?: { imageUrl?: string; fileUrl?: string; fileName?: string }, audience?: { kind: "all" | "department" | "location"; id: string | null }): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!body.trim() && !media?.imageUrl && !media?.fileUrl) return { ok: false, error: "Skrifaðu eitthvað fyrst" };
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const base = {
      company_id: ctx.company, sender_id: ctx.userId, body: body.trim(),
      image_url: media?.imageUrl ?? null, file_url: media?.fileUrl ?? null, file_name: media?.fileName ?? null,
    };
    const aud = audience && audience.kind !== "all" && audience.id ? { audience_kind: audience.kind, audience_id: audience.id } : {};
    let { error } = await supabase.from("posts").insert({ ...base, ...aud });
    if (error && /column|schema/i.test(error.message)) ({ error } = await supabase.from("posts").insert(base));
    if (error) return { ok: false, error: /policy|permission|violates/i.test(error.message) ? "Aðeins stjórnendur mega birta í fréttaveituna" : userError(error) };
    // Manager/owner posts push to the team (best-effort, capped).
    const { data: meRow } = await supabase.from("users").select("role, full_name").eq("id", ctx.userId).maybeSingle();
    if (meRow?.role === "owner" || meRow?.role === "manager") {
      let teamQ = supabase.from("employees").select("id, user_id").eq("company_id", ctx.company).eq("status", "active").limit(100);
      if (audience?.kind === "department" && audience.id) teamQ = teamQ.eq("department_id", audience.id);
      if (audience?.kind === "location" && audience.id) teamQ = teamQ.eq("location_id", audience.id);
      const { data: team } = await teamQ;
      const preview = body.trim().slice(0, 80) || "Ný færsla á fréttaveitunni";
      for (const m of team ?? []) {
        if (m.user_id === ctx.userId) continue;
        void notifyEmployee(m.id as string, { title: `📣 ${(meRow.full_name as string) ?? "Stjórnandi"}`, body: preview, url: "/frettaveita", tag: "feed" });
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** One reaction per user per post — emoji sets/updates it, null removes it. */
export async function setPostReaction(postId: string, emoji: string | null): Promise<{ ok: boolean }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
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

export async function addPostComment(postId: string, body: string, parentId?: string | null): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!body.trim()) return { ok: false, error: "Skrifaðu athugasemd" };
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const row: Record<string, string> = { post_id: postId, company_id: ctx.company, sender_id: ctx.userId, body: body.trim() };
    let { error } = await supabase.from("post_comments").insert(parentId ? { ...row, parent_id: parentId } : row);
    // parent_id column arrives with 0048 — post the reply as a plain comment before it runs
    if (error && parentId && /parent_id/.test(error.message)) ({ error } = await supabase.from("post_comments").insert(row));
    if (error) { console.error("addPostComment:", error.message); return { ok: false, error: "Tókst ekki að senda athugasemd" }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
