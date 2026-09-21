import { redirect } from "next/navigation";
import { isVaktoAdmin } from "@/lib/vakto-admin.server";
import { createAdminClient } from "@/lib/supabase/admin";
import SupportScreen, { type SupportThread } from "./support-screen";

export const dynamic = "force-dynamic";

// Samtöl úr spjallgaurnum á heimasíðunni — eigandinn tekur við og svarar hér.
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  if (!(await isVaktoAdmin())) redirect("/maelabord");
  const sp = await searchParams;
  const admin = createAdminClient();
  const { data: threads, error } = await admin.from("support_threads")
    .select("id, name, email, lang, status, page, created_at, updated_at, owner_seen_at")
    .order("updated_at", { ascending: false }).limit(200);
  const ids = (threads ?? []).map((t) => t.id as string);
  const { data: msgs } = ids.length
    ? await admin.from("support_messages").select("id, thread_id, role, body, created_at").in("thread_id", ids).order("created_at")
    : { data: [] as { id: string; thread_id: string; role: string; body: string; created_at: string }[] };
  const byThread = new Map<string, { id: string; role: "user" | "assistant" | "owner"; body: string; at: string }[]>();
  for (const m of msgs ?? []) {
    const list = byThread.get(m.thread_id as string) ?? [];
    list.push({ id: m.id as string, role: m.role as "user" | "assistant" | "owner", body: m.body as string, at: m.created_at as string });
    byThread.set(m.thread_id as string, list);
  }
  const items: SupportThread[] = (threads ?? []).map((t) => {
    const list = byThread.get(t.id as string) ?? [];
    const lastUser = [...list].reverse().find((m) => m.role === "user");
    return {
      id: t.id as string, name: (t.name as string) ?? "", email: (t.email as string) ?? "", lang: (t.lang as string) ?? "is",
      status: t.status as "bot" | "human" | "closed", page: (t.page as string) ?? "",
      createdAt: t.created_at as string, updatedAt: t.updated_at as string,
      unread: !!lastUser && (!t.owner_seen_at || (lastUser.at > (t.owner_seen_at as string))),
      messages: list,
    };
  });
  return <SupportScreen threads={items} initialId={sp.t ?? null} needsMigration={!!error} />;
}
