"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import { BC_PAY_ACCOUNTS, type BcPayAccounts } from "@/lib/integrations/bc-payroll";

// Business Central: bókhaldslyklar fyrir launabókun — companies.bc_payaccounts (0092).
export type BcPaySettings = { accounts: BcPayAccounts; chart: { number: string; name: string }[]; chartError: string | null };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!u?.company_id || (u.role !== "owner" && u.role !== "manager")) return null;
  return { supabase, company: u.company_id as string, userId: user.id };
}

const acc = (v: unknown) => (typeof v === "string" ? v.trim().replace(/[^\w.-]/g, "").slice(0, 20) : "");

export async function getBcPaySettings(): Promise<BcPaySettings | null> {
  const c = await ctx(); if (!c) return null;
  const db = createAdminClient();
  const [{ data: co }, { data: integ }] = await Promise.all([
    db.from("companies").select("bc_payaccounts").eq("id", c.company).maybeSingle(),
    db.from("company_integrations").select("site, secret_enc").eq("company_id", c.company).eq("provider", "businesscentral").maybeSingle(),
  ]);
  let chart: BcPaySettings["chart"] = [], chartError: string | null = null;
  if (integ?.secret_enc) {
    try {
      const { bcAccountList, decrypt } = await import("@/lib/integrations/providers.server");
      chart = await bcAccountList(integ.site as string, decrypt(integ.secret_enc as string));
    } catch (e) { chartError = e instanceof Error ? e.message : "Náði ekki í bókhaldslykilinn"; }
  }
  return { accounts: (co?.bc_payaccounts as BcPayAccounts | null) ?? {}, chart, chartError };
}

export async function saveBcPayAccounts(input: BcPayAccounts): Promise<{ ok: boolean; error?: string }> {
  if (await demoBlocked()) return demoResult();
  const c = await ctx(); if (!c) return { ok: false, error: "Aðeins stjórnendur og vaktstjórar" };
  const out: BcPayAccounts = {};
  for (const { k } of BC_PAY_ACCOUNTS) { const v = acc(input[k]); if (v) out[k] = v; }
  const batch = acc(input.batch).toUpperCase().slice(0, 10);
  out.batch = batch || "VAKTO";
  try {
    const { error } = await createAdminClient().from("companies").update({ bc_payaccounts: out }).eq("id", c.company);
    if (error) throw error;
  } catch (e) { return { ok: false, error: userError(e, "Tókst ekki að vista reikningana") }; }
  await logAudit(c.supabase, c.company, c.userId, { action: "integration.bc_accounts", entity: "companies", detail: "Bókhaldslyklar fyrir launabókun í Business Central vistaðir" });
  revalidatePath("/stillingar"); revalidatePath("/launakeyrslur");
  return { ok: true };
}
