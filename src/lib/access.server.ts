import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveAccess, type Area } from "@/lib/user-permissions";

type Sb = Awaited<ReturnType<typeof createClient>>;

/** Má innskráður notandi opna svæðið? Sama regla og middleware (canAccess) og SQL has_perm()
 * (0095). Notað í server actions/fetcherum svo ekki sé hægt að fara framhjá síðuvörðinum
 * með því að kalla aðgerðina beint. Þolir að permissions-dálkinn vanti (= sjálfgefið). */
export async function hasPerm(area: Area, client?: Sb): Promise<boolean> {
  try {
    const supabase = client ?? (await createClient());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: u } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    const role = (u?.role as string) ?? "employee";
    if (role !== "manager") return resolveAccess(role)[area];
    const pr = await supabase.from("users").select("permissions").eq("id", user.id).maybeSingle();
    return resolveAccess(role, pr.error ? null : pr.data?.permissions)[area];
  } catch {
    return false;
  }
}
