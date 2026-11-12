"use server";

// Kjarasamningasafn (0113): nota afbrigði sem staðal fyrirtækisins eða á valið starfsfólk, eigin reglur úr safni/AI
// á starfsfólk, og launalyklar fyrirtækisins. Laun starfsmanns breytast AÐEINS þegar stjórnandi velur hann hér.
// Aðgangur: eigandi, eða stjórnandi með aðgang að Launakeyrslum (sama og launatímabil).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { CUSTOM_UNION, UNION_PRESETS, agreementFor, type PayKeys } from "@/lib/payrules";
import { normalizePayKeys } from "@/lib/pay-keys";
import { templateToPayRule, type RuleSet } from "@/lib/rules";
import { agreementForPreset } from "@/lib/agreements";

type Result = { ok: boolean; demo?: boolean; error?: string; count?: number; needsMigration?: boolean };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: me } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!me?.company_id) return { error: "Fyrirtæki fannst ekki" as const };
  if (me.role !== "owner") {
    const { data: ok } = await supabase.rpc("has_perm", { p_area: "launakeyrslur" });
    if (ok !== true) return { error: "Aðeins eigandi eða stjórnandi með aðgang að launakeyrslum getur breytt launareglum" as const };
  }
  return { supabase, company: me.company_id as string, userId: user.id };
}

export type AgreementTarget = { id: string; name: string; union: string; used: string; custom: boolean; templateName?: string };
export type AgreementSetup = { canEdit: boolean; payKeys: PayKeys; defaultAgreement: string | null; employees: AgreementTarget[]; migrated: boolean };

/** Starfsfólk (virkt, ekki verktakar) með reglunni sem það er reiknað eftir núna + launalyklar og staðall fyrirtækisins. */
export async function getAgreementSetup(): Promise<AgreementSetup> {
  const empty: AgreementSetup = { canEdit: false, payKeys: {}, defaultAgreement: null, employees: [], migrated: false };
  if (!isSupabaseConfigured()) return empty;
  try {
    const c = await ctx();
    if ("error" in c) return empty;
    const [{ data: emps }, co] = await Promise.all([
      c.supabase.from("employees").select("id, full_name, union_agreement, pay_rule, status, role")
        .eq("company_id", c.company).neq("role", "contractor").order("full_name"),
      c.supabase.from("companies").select("pay_keys, default_agreement").eq("id", c.company).maybeSingle(),
    ]);
    const employees = (emps ?? []).filter((e) => (e.status ?? "active") === "active").map((e) => {
      const union = (e.union_agreement as string | null) ?? "";
      const pr = (e.pay_rule as Record<string, unknown> | null) ?? null;
      const custom = union === CUSTOM_UNION;
      return {
        id: e.id as string, name: e.full_name as string, union, custom,
        used: custom ? CUSTOM_UNION : agreementFor(union, pr as never),
        templateName: custom ? ((pr?.templateName as string | undefined) ?? undefined) : undefined,
      };
    });
    return {
      canEdit: true, employees, migrated: !co.error,
      payKeys: co.error ? {} : normalizePayKeys(co.data?.pay_keys),
      defaultAgreement: co.error ? null : ((co.data?.default_agreement as string | null) ?? null),
    };
  } catch (e) {
    console.error("[agreements] setup", e);
    return empty;
  }
}

/** Nota afbrigði (UNION_PRESETS-lykil) eða eigin reglu (rule_templates.id) á starfsfólk, og/eða sem staðal fyrir nýtt starfsfólk. */
export async function applyAgreement(input: { preset?: string; templateId?: string; employeeIds: string[]; makeDefault?: boolean }): Promise<Result> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  const ids = [...new Set((input.employeeIds ?? []).filter((x) => typeof x === "string"))].slice(0, 2000);
  if (!input.preset && !input.templateId) return { ok: false, error: "Veldu reglu" };
  if (input.preset && !UNION_PRESETS[input.preset]) return { ok: false, error: "Óþekkt regla" };
  if (input.templateId && input.makeDefault) return { ok: false, error: "Aðeins kjarasamning úr safninu má gera að staðli" };
  if (!ids.length && !input.makeDefault) return { ok: false, error: "Veldu starfsfólk" };
  try {
    const c = await ctx();
    if ("error" in c) return { ok: false, error: c.error };
    let label = input.preset ?? "";
    let tplRule: Record<string, unknown> | null = null;
    if (input.templateId) {
      const { data: tpl } = await c.supabase.from("rule_templates").select("id, name, rules").eq("id", input.templateId).eq("company_id", c.company).maybeSingle();
      if (!tpl) return { ok: false, error: "Reglan fannst ekki" };
      label = tpl.name as string;
      tplRule = { ...templateToPayRule(tpl.rules as RuleSet), templateName: tpl.name as string };
    }
    let count = 0;
    if (ids.length) {
      const { data: emps, error } = await c.supabase.from("employees").select("id, union_agreement, pay_rule").eq("company_id", c.company).in("id", ids);
      if (error) return { ok: false, error: userError(error) };
      const unionName = input.preset ? agreementForPreset(input.preset)?.unionName ?? input.preset : CUSTOM_UNION;
      for (const e of emps ?? []) {
        const cur = (e.pay_rule as Record<string, unknown> | null) ?? {};
        const union = (e.union_agreement as string | null) ?? "";
        let patch: Record<string, unknown>;
        if (tplRule) {
          patch = { union_agreement: CUSTOM_UNION, pay_rule: tplRule };
        } else {
          // Félag starfsmanns helst (aðild); afbrigðið fer í pay_rule.agreement. Án félags, eða á eigin reglum,
          // fær hann félag afbrigðisins — eigin reglurnar haldast í pay_rule svo hægt sé að skipta til baka.
          const keepUnion = union && union !== CUSTOM_UNION && !union.startsWith("tpl:");
          patch = { pay_rule: { ...cur, agreement: input.preset }, ...(keepUnion ? {} : { union_agreement: unionName }) };
        }
        const { data: upd, error: uerr } = await c.supabase.from("employees").update(patch).eq("id", e.id as string).select("id");
        if (uerr) return { ok: false, error: userError(uerr), count };
        count += upd?.length ?? 0;
        // rule_template_id (0028) — best-effort, svo starfsmannaspjaldið sýni sniðmátið.
        await c.supabase.from("employees").update({ rule_template_id: input.templateId ?? null }).eq("id", e.id as string).then(() => {}, () => {});
      }
      if (ids.length && count === 0) return { ok: false, error: "Engum starfsmanni var breytt — athugaðu aðganginn þinn." };
    }
    if (input.makeDefault && input.preset) {
      const { error } = await createAdminClient().from("companies").update({ default_agreement: input.preset }).eq("id", c.company);
      if (error) {
        if (/default_agreement/.test(error.message)) return { ok: false, needsMigration: true, count, error: "Staðall fyrirtækisins verður virkur eftir næstu uppfærslu." };
        return { ok: false, error: userError(error), count };
      }
    }
    await logAudit(c.supabase, c.company, c.userId, {
      action: "agreement.apply", entity: "employees",
      detail: `Launaregla „${label}“${count ? ` sett á ${count} starfsmenn` : ""}${input.makeDefault ? " · staðall fyrir nýtt starfsfólk" : ""}`,
    });
    revalidatePath("/stillingar"); revalidatePath("/starfsfolk"); revalidatePath("/launakeyrslur");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að vista") };
  }
}

/** Launalyklar fyrirtækisins (heiti launaliða í Payday) per launaþátt. */
export async function savePayKeys(keys: PayKeys): Promise<Result> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const c = await ctx();
    if ("error" in c) return { ok: false, error: c.error };
    const clean = normalizePayKeys(keys);
    const { error } = await createAdminClient().from("companies").update({ pay_keys: Object.keys(clean).length ? clean : null }).eq("id", c.company);
    if (error) {
      if (/pay_keys/.test(error.message)) return { ok: false, needsMigration: true, error: "Launalyklar verða virkir eftir næstu uppfærslu." };
      return { ok: false, error: userError(error) };
    }
    await logAudit(c.supabase, c.company, c.userId, { action: "company.pay_keys", entity: "companies", detail: `Launalyklar: ${Object.entries(clean).map(([k, v]) => `${k}=${v}`).join(", ") || "sjálfgefnir"}` });
    revalidatePath("/stillingar"); revalidatePath("/launakeyrslur");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að vista") };
  }
}
