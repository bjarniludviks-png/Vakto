"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type Channel = { id: string; name: string; kind: string };
export type ChatMessage = { id: string; sender: string; me: boolean; body: string; at: string };

async function ctxOf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company };
}

/** Channels for the company (auto-creates "Almennt" the first time). */
export async function listChannels(): Promise<{ ok: boolean; channels: Channel[]; needsMigration?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, channels: [] };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, channels: [] };
    const res = await supabase.from("channels").select("id, name, kind").eq("company_id", ctx.company).order("created_at");
    if (res.error) return { ok: false, channels: [], needsMigration: true };
    let channels = res.data as Channel[];
    if (!channels.length) {
      const { data: created } = await supabase.from("channels")
        .insert({ company_id: ctx.company, name: "Almennt", kind: "general", created_by: ctx.userId })
        .select("id, name, kind").single();
      if (created) channels = [created as Channel];
    }
    return { ok: true, channels };
  } catch {
    return { ok: false, channels: [] };
  }
}

export async function listMessages(channelId: string): Promise<{ ok: boolean; messages: ChatMessage[] }> {
  if (!isSupabaseConfigured() || !channelId) return { ok: false, messages: [] };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, messages: [] };
    const { data } = await supabase
      .from("messages").select("id, body, created_at, sender_id, users(full_name)")
      .eq("company_id", ctx.company).eq("channel_id", channelId)
      .order("created_at").limit(200);
    const messages: ChatMessage[] = (data ?? []).map((m) => {
      const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { full_name?: string } | null;
      const d = new Date(m.created_at as string);
      return {
        id: m.id as string,
        sender: (u?.full_name ?? "—").split(/\s+/)[0],
        me: m.sender_id === ctx.userId,
        body: m.body as string,
        at: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      };
    });
    return { ok: true, messages };
  } catch {
    return { ok: false, messages: [] };
  }
}

export async function sendChatMessage(channelId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const text = body.trim();
  if (!text || !channelId) return { ok: false };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("messages").insert({ company_id: ctx.company, channel_id: channelId, sender_id: ctx.userId, body: text });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function createChannel(name: string): Promise<{ ok: boolean; channel?: Channel; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  const nm = name.trim();
  if (!nm) return { ok: false, error: "Sláðu inn heiti" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("channels")
      .insert({ company_id: ctx.company, name: nm, kind: "group", created_by: ctx.userId })
      .select("id, name, kind").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Villa" };
    await supabase.from("channel_members").insert({ channel_id: data.id, user_id: ctx.userId });
    return { ok: true, channel: data as Channel };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
