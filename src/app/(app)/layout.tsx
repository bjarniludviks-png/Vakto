import "@/styles/app.css";
import AppShell, { type Account } from "@/components/app/app-shell";
import { LangProvider } from "@/components/app/lang";
import { CountryProvider } from "@/components/app/country";
import type { Role } from "@/components/app/nav";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isVaktoAdmin } from "@/lib/vakto-admin.server";

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

async function getAccount(): Promise<Account & { country: string }> {
  if (!isSupabaseConfigured()) return { ...DEMO, country: "IS" };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ...DEMO, country: "IS" };

    // country column added in migration 0022 — fall back to name-only if absent.
    let profile = (await supabase
      .from("users")
      .select("full_name, role, company_id, companies(name, country)")
      .eq("id", user.id)
      .maybeSingle()).data as { full_name?: string; role?: string; companies?: { name?: string; country?: string } | null } | null;
    if (!profile) {
      profile = (await supabase
        .from("users")
        .select("full_name, role, company_id, companies(name)")
        .eq("id", user.id)
        .maybeSingle()).data as typeof profile;
    }

    const name = profile?.full_name || user.email || "Notandi";
    const comp = profile?.companies as { name?: string; country?: string } | null;
    return {
      initials: initials(name),
      name,
      company: comp?.name ?? "VAKTO",
      role: (profile?.role as Role) ?? "owner",
      country: comp?.country ?? "IS",
    };
  } catch {
    return { ...DEMO, country: "IS" };
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ country, ...account }, vaktoAdmin] = await Promise.all([getAccount(), isVaktoAdmin()]);
  return (
    <LangProvider>
      <CountryProvider value={country}>
        <AppShell account={{ ...account, vaktoAdmin }}>{children}</AppShell>
      </CountryProvider>
    </LangProvider>
  );
}
