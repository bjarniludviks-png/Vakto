import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
export type AssistantUser = { userId: string; companyId: string; company: string; name: string; role: "owner" | "manager" };

/** VAKTO AI er aðeins fyrir stjórnendur og vaktstjóra (aðgerðirnar sjálfar athuga bara fyrirtækið). */
export async function assistantUser(supabase: Db): Promise<AssistantUser | { error: string; status: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)", status: 401 };
  const { data: u } = await supabase.from("users").select("role, company_id, full_name").eq("id", user.id).maybeSingle();
  if (!u?.company_id) return { error: "Fyrirtæki fannst ekki", status: 403 };
  if (u.role !== "owner" && u.role !== "manager") return { error: "VAKTO AI er fyrir stjórnendur og vaktstjóra", status: 403 };
  const { data: co } = await supabase.from("companies").select("name").eq("id", u.company_id).maybeSingle();
  return { userId: user.id, companyId: u.company_id as string, company: (co?.name as string) ?? "", name: ((u.full_name as string) ?? "").split(/\s+/)[0] || "", role: u.role };
}

// Einföld takmörkun per notanda og tilviki (30 fyrirspurnir á 10 mín) — ver gegn óvart lykkjum og misnotkun.
const hits = new Map<string, number[]>();
export function rateLimited(userId: string, max = 30, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(userId, arr);
  return arr.length > max;
}
