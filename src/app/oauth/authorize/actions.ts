"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eligibility, getClient, issueCode } from "@/lib/mcp.server";

/** Svar notandans á samþykktarsíðunni. Allt er sannreynt aftur hér — ekkert treyst úr forminu nema valið. */
export async function decide(form: FormData): Promise<void> {
  const f = (k: string) => String(form.get(k) ?? "");
  const client = await getClient(f("client_id"));
  const redirectUri = f("redirect_uri");
  if (!client || !client.redirect_uris.includes(redirectUri)) redirect("/oauth/authorize?error=client");
  const back = (q: Record<string, string>) => {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    if (f("state")) u.searchParams.set("state", f("state"));
    return u.toString();
  };
  if (f("choice") !== "allow") redirect(back({ error: "access_denied" }));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const el = await eligibility(user.id);
  if (!el.ok) redirect(back({ error: "access_denied", error_description: el.reason }));

  // Eigandi getur kveikt á tengdum forritum fyrir fyrirtækið um leið og hann samþykkir.
  if (!el.enabled) {
    if (el.role !== "owner" || f("enable") !== "1") redirect(back({ error: "access_denied", error_description: "Tengd forrit eru ekki virk hjá fyrirtækinu" }));
    const admin = createAdminClient();
    await admin.from("companies").update({ ai_external: true }).eq("id", el.companyId!);
    await admin.from("audit_log").insert({ company_id: el.companyId, user_id: user.id, action: "ai_app.enable", entity: "company", detail: "Kveikti á tengdum gervigreindarforritum" });
  }
  if (!/^[\w-]{43,128}$/.test(f("code_challenge"))) redirect(back({ error: "invalid_request", error_description: "PKCE vantar" }));
  const code = await issueCode({ clientId: client.id, userId: user.id, companyId: el.companyId!, redirectUri, challenge: f("code_challenge") });
  redirect(back({ code }));
}
