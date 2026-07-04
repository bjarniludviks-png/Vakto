"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { appleConfigured, googleConfigured } from "@/lib/wallet";

/** Whether each wallet provider is configured (to label the buttons) + the current
 * employee's clock token (QR content for the on-screen ID card). */
export async function getWalletStatus(): Promise<{ apple: boolean; google: boolean; token: string | null }> {
  const apple = appleConfigured(), google = googleConfigured();
  if (!isSupabaseConfigured()) return { apple, google, token: "demo-token" };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { apple, google, token: null };
    const { data: emp } = await supabase.from("employees").select("clock_token, id").eq("user_id", user.id).maybeSingle();
    return { apple, google, token: (emp?.clock_token as string) ?? (emp?.id as string) ?? null };
  } catch {
    return { apple, google, token: null };
  }
}
