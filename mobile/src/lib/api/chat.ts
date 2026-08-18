// Spjall — direct-Supabase port of the web chat (channels/channel_members/messages).
// Same polling model as the web (no realtime configured on the project).
import { supabase } from "../supabase";
import type { Me } from "./me";

export type Conversation = {
  id: string;
  name: string;
  kind: "general" | "group" | "dm";
  last: string | null;
  lastAt: string | null;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  sender: string;
  me: boolean;
  body: string;
  at: string; // HH:MM
  kind: "text" | "image" | "audio";
  url: string | null;
  createdAt: string;
};

async function nameMap(companyId: string): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("employees")
    .select("user_id, full_name")
    .eq("company_id", companyId)
    .not("user_id", "is", null);
  const m = new Map<string, string>();
  for (const r of data ?? []) m.set(r.user_id as string, r.full_name);
  return m;
}

export async function listConversations(me: Me): Promise<Conversation[]> {
  const { data: chs } = await supabase
    .from("channels")
    .select("id, name, kind, created_at")
    .eq("company_id", me.companyId);
  const channels = chs ?? [];
  if (!channels.length) return [];

  const ids = channels.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("channel_id, body, kind, created_at")
    .in("channel_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);

  const lastBy = new Map<string, { body: string; kind: string; at: string }>();
  for (const m of msgs ?? []) {
    if (!lastBy.has(m.channel_id)) {
      lastBy.set(m.channel_id, { body: m.body, kind: m.kind, at: m.created_at });
    }
  }

  // DM labels = the other member's name
  const dmIds = channels.filter((c) => c.kind === "dm").map((c) => c.id);
  const dmName = new Map<string, string>();
  if (dmIds.length) {
    const [{ data: members }, names] = await Promise.all([
      supabase.from("channel_members").select("channel_id, user_id").in("channel_id", dmIds),
      nameMap(me.companyId),
    ]);
    const { data: auth } = await supabase.auth.getUser();
    const myId = auth.user?.id;
    for (const m of members ?? []) {
      if (m.user_id !== myId) {
        dmName.set(m.channel_id, names.get(m.user_id) ?? "Samtal");
      }
    }
  }

  const conv: Conversation[] = channels.map((c) => {
    const last = lastBy.get(c.id);
    return {
      id: c.id,
      name: c.kind === "dm" ? (dmName.get(c.id) ?? "Samtal") : c.name,
      kind: c.kind as Conversation["kind"],
      last: last ? (last.kind === "text" ? last.body : last.kind === "image" ? "Mynd" : "Hljóðskilaboð") : null,
      lastAt: last?.at ?? null,
    };
  });

  // Almennt pinned first, then by activity (like the web)
  return conv.sort((a, b) => {
    if (a.kind === "general" !== (b.kind === "general")) return a.kind === "general" ? -1 : 1;
    return (b.lastAt ?? "") < (a.lastAt ?? "") ? -1 : 1;
  });
}

export async function listMessages(me: Me, channelId: string): Promise<ChatMessage[]> {
  const [{ data: msgs }, names, { data: auth }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, kind, attachment_url, created_at")
      .eq("channel_id", channelId)
      .order("created_at")
      .limit(300),
    nameMap(me.companyId),
    supabase.auth.getUser(),
  ]);
  const myId = auth.user?.id;
  return (msgs ?? []).map((m) => {
    const full = names.get(m.sender_id) ?? "Notandi";
    return {
      id: m.id,
      senderId: m.sender_id,
      sender: full.split(/\s+/)[0],
      me: m.sender_id === myId,
      body: m.body,
      at: new Date(m.created_at).toTimeString().slice(0, 5),
      kind: (m.kind ?? "text") as ChatMessage["kind"],
      url: m.attachment_url,
      createdAt: m.created_at,
    };
  });
}

export async function sendChatMessage(
  me: Me,
  channelId: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { error } = await supabase.from("messages").insert({
    company_id: me.companyId,
    channel_id: channelId,
    sender_id: auth.user.id,
    body,
    kind: "text",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
