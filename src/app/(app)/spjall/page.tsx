import ChatScreen from "./chat-screen";
import { listConversations } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isDemoCompany } from "@/lib/demo.server";
import { currentPlan } from "@/lib/plan.server";
import { planAllows } from "@/lib/plan-features";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";

/** VAKTO AI sem fest samtal: sömu reglur og fljótandi spjallið — aðeins stjórnendur og vaktstjórar
 * (sjá assistantUser í lib/ai/assistant-auth.ts, sem /api/assistant athugar líka). */
async function aiAccess(): Promise<{ enabled: boolean; demo: boolean }> {
  if (!isSupabaseConfigured()) return { enabled: false, demo: false };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { enabled: false, demo: false };
    const { data: u } = await supabase.from("users").select("role, company_id").eq("id", user.id).maybeSingle();
    return { enabled: u?.role === "owner" || u?.role === "manager", demo: isDemoCompany(u?.company_id as string | undefined) };
  } catch {
    return { enabled: false, demo: false };
  }
}

export default async function SpjallPage() {
  const plan = await currentPlan(); // áskriftarleið (0089)
  if (plan && !planAllows(plan, "chat")) return <UpgradePrompt feature="chat" />;
  const [initial, ai] = await Promise.all([listConversations(), aiAccess()]);
  return <ChatScreen initial={initial} ai={ai} />;
}
