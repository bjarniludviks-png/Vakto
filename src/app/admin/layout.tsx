// VAKTO Platform — the SaaS owner's own surface, deliberately OUTSIDE the
// customer app shell (no tenant sidebar/topbar). Lives on admin.vakto.is with
// its own session; vakto.is/admin redirects here in production.
import "@/styles/app.css";
import { ToastHost } from "@/components/app/toast";
import AdminShell from "./admin-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "VAKTO Platform", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let email = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? "";
  } catch { /* unauthenticated → page/middleware handle it */ }
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f4f4f6)" }}>
      <AdminShell email={email}>{children}</AdminShell>
      <ToastHost />
    </div>
  );
}
