"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { nf } from "@/lib/format";
import { emailConfigured, sendInviteEmail } from "@/lib/email";

export type SyncResult = { ok: boolean; demo?: boolean; amount?: number; error?: string };
export type SettingsResult = { ok: boolean; demo?: boolean; error?: string };

/** Resolve the signed-in user's company + id. */
async function companyCtx(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company };
}

function num(s: string | undefined, fallback = 0): number {
  if (!s) return fallback;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Pull today's revenue from Inventra/POS into the revenue table. Mocked here as
 * a single revenue row; in production this calls the Inventra API. Feeds labor%. */
export async function syncInventraRevenue(): Promise<SyncResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true, amount: 612000 };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };

    const { data: loc } = await supabase.from("locations").select("id").eq("company_id", company).limit(1).maybeSingle();
    if (!loc) return { ok: false, error: "Staður fannst ekki" };

    const amount = 612000;
    const { error } = await supabase.from("revenue").insert({
      location_id: loc.id,
      date: new Date().toISOString().slice(0, 10),
      amount,
      source: "inventra",
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, company, user.id, {
      action: "inventra.sync", entity: "revenue", detail: `Velta sótt frá Inventra — ${nf(amount)} kr`,
    });
    revalidatePath("/maelabord");
    return { ok: true, amount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Manually record a revenue figure (for users without Inventra/POS). Feeds labor%. */
export async function addRevenue(
  input: { amount: string; date?: string; locationName?: string },
): Promise<SyncResult> {
  const amount = num(input.amount);
  if (amount <= 0) return { ok: false, error: "Sláðu inn upphæð" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true, amount };
  try {
    const supabase = await createClient();
    const ctx = await companyCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };

    const { data: locs } = await supabase
      .from("locations").select("id, name").eq("company_id", ctx.company);
    const loc = input.locationName
      ? locs?.find((l) => (l.name as string) === input.locationName)
      : locs?.[0];
    if (!loc) return { ok: false, error: "Staður fannst ekki" };

    const date = input.date || new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("revenue").insert({
      location_id: loc.id, date, amount, source: "manual",
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "revenue.manual", entity: "revenue", detail: `Velta skráð handvirkt — ${nf(amount)} kr (${date})`,
    });
    revalidatePath("/maelabord");
    return { ok: true, amount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Read the company's average revenue per weekday (0=Sun … 6=Sat), or null. */
export async function getWeekdayRevenue(): Promise<Record<string, number> | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const ctx = await companyCtx(supabase);
    if ("error" in ctx) return null;
    const { data, error } = await supabase.from("companies").select("weekday_revenue").eq("id", ctx.company).maybeSingle();
    if (error) return null;
    return (data?.weekday_revenue as Record<string, number>) ?? null;
  } catch {
    return null;
  }
}

/** Save average revenue per weekday (used to estimate laun% without a POS link).
 * map keys "0".."6" (0=Sun … 6=Sat) → kr. Needs migration 0018. */
export async function setWeekdayRevenue(map: Record<string, number>): Promise<SettingsResult> {
  const clean: Record<string, number> = {};
  for (let d = 0; d < 7; d++) clean[String(d)] = Math.max(0, Math.round(Number(map[String(d)]) || 0));
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("companies").update({ weekday_revenue: clean }).eq("id", ctx.company);
    if (error) return { ok: false, error: error.message.includes("weekday_revenue") ? "Keyrðu migration 0018" : error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "revenue.weekday", entity: "company", detail: "Meðalvelta per vikudag uppfærð",
    });
    revalidatePath("/maelabord");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Add a location (staður) to the company. */
export async function addLocation(input: { name: string }): Promise<SettingsResult> {
  if (!input.name?.trim()) return { ok: false, error: "Nafn vantar" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("locations").insert({
      company_id: ctx.company, name: input.name.trim(),
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "location.create", entity: "location", detail: `Nýr staður — ${input.name.trim()}`,
    });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Add a position (staða) with an optional base rate. */
export async function addPosition(input: { name: string; baseRate?: string }): Promise<SettingsResult> {
  if (!input.name?.trim()) return { ok: false, error: "Nafn vantar" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("positions").insert({
      company_id: ctx.company, name: input.name.trim(), base_rate: num(input.baseRate, 2900),
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "position.create", entity: "position", detail: `Ný staða — ${input.name.trim()}`,
    });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Save (confirm) a pay rule's premium % for the company. */
export async function savePayRule(
  input: { code: string; label: string; kind: string; pct: string; confirmed: boolean },
): Promise<SettingsResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const pct = Number(input.pct.replace(",", ".").replace(/[^\d.]/g, ""));
    const { error } = await supabase.from("pay_rules").upsert({
      company_id: ctx.company,
      code: input.code,
      label: input.label,
      kind: input.kind,
      pct: Number.isFinite(pct) ? pct : 0,
      confirmed: input.confirmed,
    }, { onConflict: "company_id,code" });
    if (error) return { ok: false, error: error.message };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "payrule.save", entity: "pay_rule", detail: `Launaregla staðfest — ${input.label} ${pct}%`,
    });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

const INVITE_ROLE: Record<string, string> = {
  Starfsmaður: "employee", Vaktstjóri: "manager", Stjórnandi: "owner", Verktaki: "contractor",
};

/** Invite a teammate by email (admin auth invite) and link them to the company. */
export async function inviteUser(input: { email: string; role: string }): Promise<SettingsResult> {
  if (!input.email?.trim()) return { ok: false, error: "Netfang vantar" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const role = INVITE_ROLE[Object.keys(INVITE_ROLE).find((k) => input.role.startsWith(k)) ?? "Starfsmaður"] ?? "employee";

    const admin = createAdminClient();
    const emailAddr = input.email.trim();
    const { data: comp } = await admin.from("companies").select("name").eq("id", ctx.company).maybeSingle();
    const companyName = (comp?.name as string) ?? "VAKTO";

    let userId: string | undefined;
    if (emailConfigured()) {
      // Branded VAKTO invite via Resend (generateLink doesn't send its own email).
      const { data: gen, error } = await admin.auth.admin.generateLink({ type: "invite", email: emailAddr, options: { data: { role, company_id: ctx.company } } });
      if (error) return { ok: false, error: error.message };
      userId = gen?.user?.id;
      const link = gen?.properties?.action_link;
      if (link) await sendInviteEmail(emailAddr, companyName, input.role, link);
    } else {
      // Supabase sends its default invite email.
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(emailAddr, { data: { role, company_id: ctx.company } });
      if (error) return { ok: false, error: error.message };
      userId = invited?.user?.id;
    }
    if (userId) {
      await admin.from("users").update({ company_id: ctx.company, role }).eq("id", userId);
      // Record membership so the invited user can switch to this company (0023).
      await admin.from("company_members").upsert({ user_id: userId, company_id: ctx.company, role });
    }
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "user.invite", entity: "user", detail: `Notanda boðið — ${input.email.trim()} (${role})`,
    });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
