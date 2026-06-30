import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { initials } from "@/lib/employees";

export type StaffCard = {
  name: string;
  role: string;
  company: string;
  photoUrl: string | null;
  idCode: string;
  initials: string;
  color: string;
  live: boolean;
};

const DEMO: StaffCard = {
  name: "Mína Huong", role: "Vaktstjóri", company: "Kaffi Krónan",
  photoUrl: null, idCode: "demo", initials: "MÍ", color: "#5b50e6", live: false,
};

const ROLE_IS: Record<string, string> = {
  owner: "Stjórnandi", manager: "Vaktstjóri", employee: "Starfsmaður", contractor: "Verktaki", kiosk: "Kiosk",
};

/** The current user's digital staff card (Mitt svæði → Wallet). */
export async function getMyCard(): Promise<StaffCard> {
  if (!isSupabaseConfigured()) return DEMO;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEMO;

    const { data: profile } = await supabase
      .from("users").select("full_name, role, email, company_id, companies(name)").eq("id", user.id).maybeSingle();
    const company = ((Array.isArray(profile?.companies) ? profile?.companies[0] : profile?.companies) as { name?: string } | null)?.name ?? "VAKTO";

    const { data: emp } = await supabase
      .from("employees")
      .select("id, full_name, title, avatar_color, photo_url, positions(name)")
      .eq("user_id", user.id).maybeSingle();

    const name = (emp?.full_name as string)
      ?? (profile?.full_name as string)
      ?? (user.email ? user.email.split("@")[0] : "Starfsmaður");
    const position = ((Array.isArray(emp?.positions) ? emp?.positions[0] : emp?.positions) as { name?: string } | null)?.name;
    const role = position ?? (emp?.title as string) ?? ROLE_IS[(profile?.role as string) ?? "employee"] ?? "Starfsmaður";

    return {
      name,
      role,
      company,
      photoUrl: (emp?.photo_url as string) ?? null,
      idCode: (emp?.id as string) ?? user.id,
      initials: initials(name),
      color: (emp?.avatar_color as string) ?? "#e9700f",
      live: true,
    };
  } catch {
    return DEMO;
  }
}
