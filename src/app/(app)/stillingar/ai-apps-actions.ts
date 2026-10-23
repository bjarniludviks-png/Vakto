"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteGrant, eligibility } from "@/lib/mcp.server";
import { demoBlocked, demoResult } from "@/lib/demo.server";

// Stillingar → Tengingar → „Tengd forrit“: slóð MCP-þjónsins, rofi eiganda og tengingar fyrirtækisins.
// Töflurnar eru aðeins fyrir service-role, svo hér er hlutverk og fyrirtæki athugað áður en lesið er.

export type AiAppsView = {
  url: string; enabled: boolean; isOwner: boolean; blocked: string | null;
  grants: { id: string; client: string; user: string; created: string; lastUsed: string | null; mine: boolean }[];
};

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const el = await eligibility(user.id);
  return { userId: user.id, el };
}

export async function getAiApps(): Promise<AiAppsView | null> {
  const m = await me();
  if (!m) return null;
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "www.vakto.is"}/api/mcp`;
  if (!m.el.ok) return { url, enabled: false, isOwner: false, blocked: m.el.reason, grants: [] };
  const db = createAdminClient();
  const isOwner = m.el.role === "owner";
  let q = db.from("mcp_grants").select("id, client_name, user_id, created_at, last_used_at").eq("company_id", m.el.companyId!).order("created_at", { ascending: false });
  if (!isOwner) q = q.eq("user_id", m.userId);
  const { data: rows } = await q;
  const ids = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  const { data: users } = ids.length ? await db.from("users").select("id, full_name").in("id", ids) : { data: [] };
  const name = new Map((users ?? []).map((u) => [u.id as string, (u.full_name as string) ?? ""]));
  return {
    url, enabled: m.el.enabled, isOwner, blocked: null,
    grants: (rows ?? []).map((r) => ({ id: r.id as string, client: r.client_name as string, user: name.get(r.user_id as string) ?? "", created: r.created_at as string, lastUsed: (r.last_used_at as string | null) ?? null, mine: r.user_id === m.userId })),
  };
}

/** Eigandi kveikir/slekkur. Slökkt = öll tengd forrit fyrirtækisins aftengd. */
export async function setAiExternal(on: boolean): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult();
  const m = await me();
  if (!m?.el.ok) return { ok: false, error: m?.el.ok === false ? m.el.reason : "Ekki innskráð(ur)" };
  if (m.el.role !== "owner") return { ok: false, error: "Aðeins eigandi getur breytt þessu" };
  const db = createAdminClient();
  const { error } = await db.from("companies").update({ ai_external: on }).eq("id", m.el.companyId!);
  if (error) return { ok: false, error: "Tókst ekki að vista" };
  if (!on) {
    const { data: gs } = await db.from("mcp_grants").select("id").eq("company_id", m.el.companyId!);
    await Promise.all((gs ?? []).map((g) => deleteGrant(g.id as string)));
  }
  await db.from("audit_log").insert({ company_id: m.el.companyId, user_id: m.userId, action: on ? "ai_app.enable" : "ai_app.disable", entity: "company", detail: on ? "Kveikti á tengdum gervigreindarforritum" : "Slökkti á tengdum gervigreindarforritum (öll aftengd)" });
  return { ok: true };
}

/** Aftengja: eigin tengingu, eða hvaða tengingu fyrirtækisins sem er ef eigandi. */
export async function disconnectAiApp(id: string): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult();
  const m = await me();
  if (!m?.el.ok) return { ok: false, error: "Ekki heimilt" };
  const db = createAdminClient();
  const { data: g } = await db.from("mcp_grants").select("id, user_id, company_id, client_name").eq("id", id).maybeSingle();
  if (!g || g.company_id !== m.el.companyId || (g.user_id !== m.userId && m.el.role !== "owner")) return { ok: false, error: "Tenging fannst ekki" };
  await deleteGrant(id);
  await db.from("audit_log").insert({ company_id: m.el.companyId, user_id: m.userId, action: "ai_app.disconnect", entity: "mcp_grant", detail: `Aftengdi ${g.client_name}` });
  return { ok: true };
}
