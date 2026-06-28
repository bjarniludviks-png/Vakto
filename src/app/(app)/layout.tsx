import "@/styles/app.css";
import AppShell, { type Account } from "@/components/app/app-shell";
import { LangProvider } from "@/components/app/lang";
import type { Role } from "@/components/app/nav";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "VK";
}

// Demo identity used before Supabase is connected so screens stay viewable.
const DEMO: Account = {
  initials: "BL",
  name: "Bjarni Lúðvíksson",
  company: "Kaffi Krónan",
  role: "owner",
};

async function getAccount(): Promise<Account> {
  if (!isSupabaseConfigured()) return DEMO;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEMO;

    const { data: profile } = await supabase
      .from("users")
      .select("full_name, role, company_id, companies(name)")
      .eq("id", user.id)
      .maybeSingle();

    const name = profile?.full_name || user.email || "Notandi";
    const company =
      (profile?.companies as { name?: string } | null)?.name ?? "VAKTO";
    return {
      initials: initials(name),
      name,
      company,
      role: (profile?.role as Role) ?? "owner",
    };
  } catch {
    return DEMO;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getAccount();
  return (
    <LangProvider>
      <AppShell account={account}>{children}</AppShell>
    </LangProvider>
  );
}
