// Tilkynna efni og loka á notendur (krafa app-verslana fyrir efni frá notendum).
// Tilkynningar fara til stjórnenda fyrirtækisins; lokun felur efni viðkomandi hjá þér einum.
import { supabase } from "../supabase";
import { notifyServer } from "./notify";
import type { Me } from "./me";

export type ReportKind = "message" | "post" | "comment";

export async function reportContent(me: Me, kind: ReportKind, refId: string, authorId: string | null, excerpt: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data, error } = await supabase.from("content_reports")
    .upsert({ company_id: me.companyId, reporter_id: auth.user.id, kind, ref_id: refId, author_id: authorId, excerpt: excerpt.slice(0, 300) }, { onConflict: "reporter_id,kind,ref_id" })
    .select("id").maybeSingle();
  if (error) return { ok: false, error: "Tókst ekki að senda tilkynningu" };
  if (data?.id) void notifyServer("content_report", data.id as string);
  return { ok: true };
}

let cache: Set<string> | null = null;
/** Notendur sem þú hefur lokað á (auth-auðkenni). */
export async function blockedUsers(force = false): Promise<Set<string>> {
  if (cache && !force) return cache;
  const { data, error } = await supabase.from("user_blocks").select("blocked_user_id");
  cache = new Set(error ? [] : (data ?? []).map((r) => r.blocked_user_id as string));
  return cache;
}
export async function blockUser(userId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.id === userId) return false;
  const { error } = await supabase.from("user_blocks").upsert({ user_id: auth.user.id, blocked_user_id: userId });
  if (!error) (cache ??= new Set()).add(userId);
  return !error;
}
export async function unblockAll(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { error } = await supabase.from("user_blocks").delete().eq("user_id", auth.user.id);
  if (!error) cache = new Set();
  return !error;
}

export type Report = { id: string; kind: ReportKind; excerpt: string; at: string };
/** Opnar tilkynningar fyrirtækisins (stjórnendur). */
export async function openReports(companyId: string): Promise<Report[]> {
  const { data, error } = await supabase.from("content_reports").select("id, kind, excerpt, created_at").eq("company_id", companyId).eq("status", "open").order("created_at", { ascending: false }).limit(20);
  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id as string, kind: r.kind as ReportKind, excerpt: (r.excerpt as string) ?? "", at: r.created_at as string }));
}
export async function resolveReport(id: string): Promise<boolean> {
  const { error } = await supabase.from("content_reports").update({ status: "resolved" }).eq("id", id);
  return !error;
}
