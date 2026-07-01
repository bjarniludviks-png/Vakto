import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionCompanyForUser } from "@/lib/provision";
import { sendWelcomeEmail } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// OAuth (Apple/Google/Microsoft) redirect target. Exchanges the code for a
// session and, for a brand-new OAuth signup with no company yet, provisions one
// automatically so the user lands in a working app.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/maelabord";
  const origin = url.origin;
  if (!code || !isSupabaseConfigured()) return NextResponse.redirect(`${origin}${next}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin.from("users").select("company_id").eq("id", user.id).maybeSingle();
      if (!profile?.company_id) {
        const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || (user.email?.split("@")[0] ?? "");
        const companyName = name ? `${name.split(/\s+/)[0]} — fyrirtæki` : "Mitt fyrirtæki";
        const prov = await provisionCompanyForUser(user.id, user.email ?? "", name, companyName);
        if (prov.ok && user.email) await sendWelcomeEmail(user.email, name, companyName);
      }
    } catch { /* land the user anyway; onboarding will guide them */ }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
