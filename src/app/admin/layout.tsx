// VAKTO Platform — the SaaS owner's own surface, deliberately OUTSIDE the
// customer app shell (no tenant sidebar/topbar). Lives on admin.vakto.is with
// its own session; vakto.is/admin redirects here in production.
import "@/styles/app.css";
import "./admin.css";
import { ToastHost } from "@/components/app/toast";
import AdminShell from "./admin-shell";
import { getPlatformIdentity } from "@/lib/vakto-admin.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "VAKTO Platform", robots: { index: false, follow: false } };

/** Samtöl þar sem gestur bíður svars — merkið á „Spjall“ í valmyndinni. */
async function unreadThreads(): Promise<number> {
  try {
    const db = createAdminClient();
    const { data: threads } = await db.from("support_threads").select("id, owner_seen_at").neq("status", "closed").order("updated_at", { ascending: false }).limit(40);
    const ids = (threads ?? []).map((t) => String(t.id));
    if (!ids.length) return 0;
    const { data: msgs } = await db.from("support_messages").select("thread_id, created_at").in("thread_id", ids).eq("role", "user").order("created_at", { ascending: false }).limit(400);
    const last = new Map<string, string>();
    for (const m of msgs ?? []) if (!last.has(String(m.thread_id))) last.set(String(m.thread_id), String(m.created_at));
    return (threads ?? []).filter((t) => { const at = last.get(String(t.id)); return !!at && (!t.owner_seen_at || at > String(t.owner_seen_at)); }).length;
  } catch {
    return 0;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Not staff (or the token-exchange landings mid sign-in) → bare page; each page redirects on its own.
  const me = await getPlatformIdentity();
  if (!me) return <div style={{ minHeight: "100dvh", background: "var(--bg, #f4f4f6)", padding: 22 }}>{children}<ToastHost /></div>;
  const unread = await unreadThreads();
  return (
    <>
      <AdminShell email={me.email} name={me.name} unread={unread}>{children}</AdminShell>
      <ToastHost />
    </>
  );
}
