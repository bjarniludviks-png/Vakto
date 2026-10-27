"use server";

import { demoBlocked, demoResult } from "@/lib/demo.server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { nf } from "@/lib/format";
import { templateToPayRule, type RuleSet as TplRuleSet } from "@/lib/rules";
import { getTimeBank } from "../skyrslur/timebank.server";
import { sendContractEmail } from "@/lib/email";
import { inviteToCompany } from "@/lib/invite.server";
import type { CustomRules } from "@/lib/payrules";
import { headers } from "next/headers";
import { employerSign, metaFrom, notifyContractEmployee, resendTaktikalInvite, signedPdfPath, startTaktikalSigning, syncTaktikalContract, type TaktikalSyncResult } from "@/lib/esign.server";
import { taktikalEnabled } from "@/lib/taktikal.server";
import type { SignatureRecord } from "@/lib/contract-pdf";
import { userError } from "@/lib/user-error";
import { resolvePay, type PaySettings } from "@/lib/paysettings";
import { resolveOrlof } from "@/lib/payrules";
import type { PayslipDetail } from "@/lib/doc-pdf";
import { ytdFor, ytdRowFrom } from "@/lib/payslip-ytd";
import { normKennitala } from "@/lib/staff-import";
import { employeeBlock } from "@/lib/plan.server";

export type NewEmployeeInput = {
  fullName: string;
  kennitala?: string;
  email?: string;
  phone?: string;
  bankAccount?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  role: string; // label from the form
  position?: string;
  department?: string;
  location?: string;
  hireDate?: string;
  employmentRatio?: string;
  payType?: string; // "Tímakaup" | "Mánaðarlaun"
  rate?: string;
  union?: string;
  pensionFund?: string;
  monthlyHours?: string;
  // universal fields (0028) — written tolerantly until the migration runs
  ruleTemplateId?: string;
  contractType?: string;
  schedulePattern?: string; // SchedulePattern.kind
};

export type ActionResult = { ok: boolean; demo?: boolean; error?: string; id?: string; invited?: boolean; inviteError?: string;
  /** Taktikal (0062): vantar kennitölu/síma undirritara fyrir hönd vinnuveitanda. */
  needSigner?: { ssn: string; phone: string };
  /** Taktikal: undirritunartengill vinnuveitanda (opnast strax eftir sendingu). */
  employerUrl?: string };

const ROLE_MAP: Record<string, string> = {
  Starfsmaður: "employee",
  Vaktstjóri: "manager",
  Stjórnandi: "owner",
  Verktaki: "contractor",
};

function roleEnum(label: string): string {
  const key = Object.keys(ROLE_MAP).find((k) => label.startsWith(k));
  return key ? ROLE_MAP[key] : "employee";
}
function num(s: string | undefined, fallback = 0): number {
  if (!s) return fallback;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function companyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.company_id as string) ?? null;
}

async function lookupId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "departments" | "positions" | "locations",
  name: string | undefined,
  company: string,
): Promise<string | null> {
  if (!name) return null;
  // departments are scoped via locations; positions/locations carry company_id directly
  // limit(1) instead of maybeSingle — duplicate names must not null the lookup.
  if (table === "departments") {
    const { data } = await supabase
      .from("departments")
      .select("id, locations!inner(company_id)")
      .eq("name", name)
      .eq("locations.company_id", company)
      .limit(1);
    return (data?.[0]?.id as string) ?? null;
  }
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("name", name)
    .eq("company_id", company)
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

export async function createEmployee(input: NewEmployeeInput): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!input.fullName?.trim()) return { ok: false, error: "Nafn vantar" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };

  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki — tengdu reikninginn." };
    const eb = await employeeBlock(company); // Frítt: mest 5 starfsmenn (0089)
    if (eb) return { ok: false, error: eb };
    let tplRes = await resolveUnionTemplate(supabase, company, input.union);
    if (!tplRes.payRule && input.ruleTemplateId)
      tplRes = await resolveUnionTemplate(supabase, company, `tpl:${input.ruleTemplateId}`);

    const [department_id, position_id, location_id] = await Promise.all([
      lookupId(supabase, "departments", input.department, company),
      lookupId(supabase, "positions", input.position, company),
      lookupId(supabase, "locations", input.location, company),
    ]);

    const baseRow = {
      company_id: company,
      full_name: input.fullName.trim(),
      kennitala: input.kennitala || null,
      email: input.email || null,
      phone: input.phone || null,
      bank_account: input.bankAccount || null,
      pension_fund: input.pensionFund?.trim() || null,
      role: roleEnum(input.role),
      department_id,
      position_id,
      location_id,
      pay_type: input.payType === "Mánaðarlaun" ? "monthly" : "hourly",
      rate: num(input.rate, 2900),
      employment_ratio: num(input.employmentRatio, 100),
      union_agreement: tplRes.union || "Efling",
      ...(tplRes.payRule ? { pay_rule: tplRes.payRule } : {}),
      monthly_hours: input.monthlyHours ? num(input.monthlyHours, 0) || null : null,
      hire_date: input.hireDate || null,
      status: "active" as const,
    };
    // Universal fields (0028) — retry without them if the columns don't exist yet.
    const tplName = (tplRes.payRule as { templateName?: string } | undefined)?.templateName;
    const universal = {
      union_name: input.union?.startsWith("tpl:") || input.ruleTemplateId
        ? (tplName ?? "Eigin reglur")
        : (input.union || null),
      rule_template_id: input.ruleTemplateId || null,
      contract_type: input.contractType || null,
      schedule_pattern: input.schedulePattern ? { kind: input.schedulePattern } : null,
    };
    let { data: created, error } = await supabase.from("employees")
      .insert({ ...baseRow, ...universal }).select("id").maybeSingle();
    if (error && /column|schema/i.test(error.message)) {
      ({ data: created, error } = await supabase.from("employees").insert(baseRow).select("id").maybeSingle());
    }
    if (error) return { ok: false, error: userError(error) };
    // Heimilisfang (0059/0060) — sér uppfærsla svo stofnun virki þótt migration vanti.
    if (created?.id && (input.address || input.postalCode || input.city)) {
      const { error: adErr } = await supabase.from("employees").update({
        address: input.address?.trim() || null, postal_code: input.postalCode?.trim() || null, city: input.city?.trim() || null,
      }).eq("id", created.id);
      if (adErr) console.error("createEmployee address", adErr.message);
    }

    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.create", entity: "employee", detail: `Nýr starfsmaður — ${input.fullName.trim()}`,
    });
    // „Stofna & senda boð“: netfang → boð í VAKTO (eða tenging við aðgang sem er til).
    let invited = false, inviteError: string | undefined;
    if (input.email?.trim()) {
      const inv = await inviteToCompany(company, input.email, input.role ?? "Starfsmaður");
      invited = inv.ok && inv.sent;
      if (!inv.ok) inviteError = inv.error;
    }
    revalidatePath("/starfsfolk");
    return { ok: true, id: created?.id as string | undefined, invited, inviteError };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export type ImportRow = {
  fullName: string; kennitala?: string; email?: string; phone?: string; hireDate?: string; active?: boolean;
  role?: string; position?: string; department?: string; location?: string;
  payType?: string; rate?: string; employmentRatio?: string; union?: string; bankAccount?: string;
};
export type ImportResult = { ok: boolean; demo?: boolean; inserted?: number; skipped?: number; noRate?: number; error?: string };

/** Bulk-import employees (e.g. from a Payday Excel export). Chunked for large teams. */
export async function importEmployees(rows: ImportRow[]): Promise<ImportResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  const valid = rows.filter((r) => r.fullName?.trim()).map((r) => ({ ...r, kennitala: normKennitala(r.kennitala) }));
  const skipped = rows.length - valid.length;
  if (valid.length === 0) return { ok: false, error: "Engir gildir starfsmenn í skránni" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true, inserted: valid.length, skipped };
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };

    // Skip kennitölur that already exist (avoid duplicates on re-import).
    const kts = valid.map((r) => r.kennitala?.replace(/\D/g, "")).filter(Boolean) as string[];
    const existing = new Set<string>();
    if (kts.length) {
      const { data } = await supabase.from("employees").select("kennitala").eq("company_id", company);
      for (const e of data ?? []) {
        const k = (e.kennitala as string | null)?.replace(/\D/g, "");
        if (k) existing.add(k);
      }
    }

    // Staðir, deildir og starfsheiti úr skránni: tengjast ef þau eru til, annars stofnuð
    // (nýtt fyrirtæki er tómt og innlestur á ekki að týna deildunum).
    const uniq = (vals: (string | undefined)[]) => [...new Set(vals.map((v) => v?.trim()).filter(Boolean))] as string[];
    const locs = new Map<string, string | null>();
    const ensureLoc = async (name: string) => {
      const k = name.toLowerCase();
      if (locs.has(k)) return locs.get(k)!;
      let id = await lookupId(supabase, "locations", name, company);
      if (!id) id = ((await supabase.from("locations").insert({ company_id: company, name }).select("id").single()).data?.id as string) ?? null;
      locs.set(k, id); return id;
    };
    for (const n of uniq(valid.map((r) => r.location))) await ensureLoc(n);
    // Deild þarf stað: staður línunnar, annars fyrsti staður fyrirtækisins, annars „Aðalstöð“.
    let defaultLoc: string | null = null;
    const fallbackLoc = async () => {
      if (defaultLoc) return defaultLoc;
      const { data } = await supabase.from("locations").select("id").eq("company_id", company).order("created_at").limit(1);
      defaultLoc = (data?.[0]?.id as string) ?? await ensureLoc("Aðalstöð");
      return defaultLoc;
    };
    const deps = new Map<string, string | null>();
    for (const r of valid) {
      const n = r.department?.trim(); if (!n || deps.has(n.toLowerCase())) continue;
      let id = await lookupId(supabase, "departments", n, company);
      if (!id) {
        const loc = (r.location?.trim() ? locs.get(r.location.trim().toLowerCase()) : null) ?? await fallbackLoc();
        if (loc) id = ((await supabase.from("departments").insert({ location_id: loc, name: n }).select("id").single()).data?.id as string) ?? null;
      }
      deps.set(n.toLowerCase(), id);
    }
    const poss = new Map<string, string | null>();
    for (const n of uniq(valid.map((r) => r.position))) {
      let id = await lookupId(supabase, "positions", n, company);
      if (!id) id = ((await supabase.from("positions").insert({ company_id: company, name: n }).select("id").single()).data?.id as string) ?? null;
      poss.set(n.toLowerCase(), id);
    }
    const pick = (m: Map<string, string | null>, v?: string) => (v?.trim() ? (m.get(v.trim().toLowerCase()) ?? null) : null);

    // Stéttarfélag vantar: algengasta félagið í skránni (t.d. Afl fyrir austan), annars Efling.
    const unionCount = new Map<string, number>();
    for (const r of valid) { const u = r.union?.trim(); if (u) unionCount.set(u, (unionCount.get(u) ?? 0) + 1); }
    const defaultUnion = [...unionCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Efling";
    const fresh = valid.filter((r) => { const k = r.kennitala?.replace(/\D/g, ""); return !k || !existing.has(k); });
    const toInsert = fresh.map((r) => ({
        company_id: company,
        full_name: r.fullName.trim(),
        kennitala: normKennitala(r.kennitala) ?? null,
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        bank_account: r.bankAccount?.trim() || null,
        hire_date: r.hireDate || null,
        department_id: pick(deps, r.department),
        position_id: pick(poss, r.position),
        location_id: pick(locs, r.location),
        title: r.position?.trim() || null,
        pay_type: (r.payType ?? "").toLowerCase().startsWith("mán") ? ("monthly" as const) : ("hourly" as const),
        // Enginn taxti í skránni: sjálfgefið tímakaup (2.900) — mánaðarlaunafólk fær 0 svo það sjáist að vantar.
        rate: num(r.rate, (r.payType ?? "").toLowerCase().startsWith("mán") ? 0 : 2900),
        employment_ratio: num(r.employmentRatio, 100),
        union_agreement: r.union?.trim() || defaultUnion,
        role: roleEnum(r.role ?? "Starfsmaður"),
        status: r.active === false ? "inactive" : "active",
      }));

    const dupSkipped = valid.length - toInsert.length;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { error } = await supabase.from("employees").insert(chunk);
      if (error) return { ok: false, error: userError(error), inserted };
      inserted += chunk.length;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.import", entity: "employee", detail: `Flutti inn ${inserted} starfsmenn úr skrá`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true, inserted, skipped: skipped + dupSkipped, noRate: fresh.filter((r) => !num(r.rate)).length };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export type UploadDocResult = { ok: boolean; demo?: boolean; path?: string; error?: string };

/** Upload an employee document (data URL) to the documents bucket + create a row. */
export async function uploadDocument(
  input: { employeeId: string; fileName: string; dataUrl: string; type?: string },
): Promise<UploadDocResult> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (input.employeeId.startsWith("e") && input.employeeId.length <= 3) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };

    const m = /^data:([^;]+);base64,(.+)$/.exec(input.dataUrl);
    if (!m) return { ok: false, error: "Ógilt skjal" };
    const mime = m[1];
    const bytes = Buffer.from(m[2], "base64");
    const safe = input.fileName.replace(/[^\w.\-]+/g, "_");
    const path = `${company}/${input.employeeId}/${Date.now()}-${safe}`;

    const { error: upErr } = await supabase.storage
      .from("documents").upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) return { ok: false, error: userError(upErr) };

    const { error } = await supabase.from("documents").insert({
      company_id: company,
      employee_id: input.employeeId,
      name: input.fileName,
      type: input.type ?? null,
      url: path,
    });
    if (error) return { ok: false, error: userError(error) };

    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, company, user?.id ?? null, {
      action: "document.upload", entity: "document", detail: `Skjal hlaðið upp — ${input.fileName}`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export type DocRow = { id: string; name: string; type: string | null; path: string; created: string };

/** List an employee's documents (metadata only — files stay in the private bucket). */
export async function getDocuments(employeeId: string): Promise<{ live: boolean; rows: DocRow[] }> {
  if (!isSupabaseConfigured() || (employeeId.startsWith("e") && employeeId.length <= 3)) return { live: false, rows: [] };
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { live: false, rows: [] };
    const { data, error } = await supabase.from("documents")
      .select("id, name, type, url, created_at")
      .eq("company_id", company).eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    if (error) return { live: false, rows: [] };
    return { live: true, rows: (data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, type: (d.type as string) ?? null, path: d.url as string, created: (d.created_at as string) ?? "" })) };
  } catch {
    return { live: false, rows: [] };
  }
}

/** Short-lived signed URL to view/download a private document (60s). */
export async function getDocumentSignedUrl(path: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    // Path is company-scoped (company/employee/file); ensure it belongs to this company.
    if (!company || !path.startsWith(`${company}/`)) return { ok: false, error: "Óheimilt" };
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return { ok: false, error: userError(error, "Villa") };
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export type UpdateEmployeeInput = {
  email?: string;
  phone?: string;
  kennitala?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  nextOfKin?: string;
  bankAccount?: string;
  rate?: string;
  employmentRatio?: string;
  ratioVariable?: boolean;
  union?: string;
  payType?: string;
  monthlyHours?: string;
  pensionFund?: string;
  position?: string;
  department?: string;
  location?: string;
  hireDate?: string;
  payRule?: CustomRules | null;
  permissions?: Record<string, boolean> | null;
  benefits?: { name: string; type: string; amount: number }[] | null;
  orlof?: { mode: string; pct: number } | null;
  paySettings?: Partial<PaySettings> | null;
  ruleTemplateId?: string | null;
  contractType?: string | null;
  schedulePattern?: string | null;
};

/** Tolerant read of an employee's pension fund (null before 0039). */
export async function getEmployeePension(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employees").select("pension_fund").eq("id", id).maybeSingle();
    if (error) return null;
    return (data?.pension_fund as string) ?? null;
  } catch {
    return null;
  }
}

/** Launaliðir starfsmanns (0081) + sjálfgefin gildi fyrirtækis. null fyrir migration. */
export async function getEmployeePaySettings(id: string): Promise<{ own: Partial<PaySettings>; company: Partial<PaySettings> } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employees").select("pay_settings, company_id").eq("id", id).maybeSingle();
    if (error || !data) return null;
    const { data: co } = await supabase.from("companies").select("pay_defaults").eq("id", data.company_id as string).maybeSingle();
    return { own: (data.pay_settings as Partial<PaySettings>) ?? {}, company: ((co as { pay_defaults?: Partial<PaySettings> } | null)?.pay_defaults) ?? {} };
  } catch {
    return null;
  }
}

/** Tolerant read of an employee's orlof (vacation) settings (null before 0021). */
export async function getEmployeeOrlof(id: string): Promise<{ mode: string; pct: number } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employees").select("orlof").eq("id", id).maybeSingle();
    if (error) return null;
    return (data?.orlof as { mode: string; pct: number }) ?? null;
  } catch {
    return null;
  }
}

/** Tolerant read of an employee's benefits (null before 0016). */
export async function getEmployeeExtras(id: string): Promise<{ permissions: Record<string, boolean> | null; benefits: { name: string; type: string; amount: number }[] | null }> {
  if (!isSupabaseConfigured()) return { permissions: null, benefits: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employees").select("permissions, benefits").eq("id", id).maybeSingle();
    if (error) return { permissions: null, benefits: null };
    return { permissions: (data?.permissions as never) ?? null, benefits: (data?.benefits as never) ?? null };
  } catch {
    return { permissions: null, benefits: null };
  }
}

/** Tolerant read of an employee's custom pay-rule set (null before 0013). */
export async function getEmployeePayRule(id: string): Promise<CustomRules | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employees").select("pay_rule").eq("id", id).maybeSingle();
    if (error) return null;
    return (data?.pay_rule as CustomRules) ?? null;
  } catch {
    return null;
  }
}

/** Deactivate (or reactivate) an employee — keeps all history. */
export async function setEmployeeStatus(id: string, active: boolean): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (id.startsWith("e") && id.length <= 3) return { ok: true, demo: true }; // demo row id
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("employees").update({ status: active ? "active" : "inactive" }).eq("id", id);
    if (error) return { ok: false, error: userError(error) };
    const { data: { user } } = await supabase.auth.getUser();
    const company = await companyId(supabase);
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.status", entity: "employee", entityId: id, detail: active ? "Starfsmaður virkjaður" : "Starfsmaður óvirkjaður",
    });
    // Endurráðning: starfslok (0088) falla úr gildi og innskráning opnast aftur (RLS staðfesti aðganginn hér að ofan).
    if (active && company) await (await import("@/lib/terminations-cron.server")).reopenAfterRehire(company, id, user?.id ?? null).catch((e) => console.error("[reopenAfterRehire]", e));
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Permanently delete an employee and all their records (cascades). */
export async function deleteEmployee(id: string): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (id.startsWith("e") && id.length <= 3) return { ok: true, demo: true }; // demo row id
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    // Employees with recorded history must never be hard-deleted — punches,
    // shifts and payroll history would cascade away. Deactivate instead.
    const [pu, ts] = await Promise.all([
      supabase.from("punches").select("id", { count: "exact", head: true }).eq("employee_id", id),
      supabase.from("shifts").select("id", { count: "exact", head: true }).eq("employee_id", id),
    ]);
    if ((pu.count ?? 0) > 0 || (ts.count ?? 0) > 0) {
      await supabase.from("employees").update({ status: "inactive" }).eq("id", id);
      return { ok: false, error: "Starfsmaðurinn á stimplanir eða vaktir — ekki er hægt að eyða, en hann var gerður óvirkur. Saga hans (tímar, laun) helst órofin." };
    }
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) return { ok: false, error: userError(error) };
    const { data: { user } } = await supabase.auth.getUser();
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.delete", entity: "employee", entityId: id, detail: "Starfsmanni eytt",
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (id.startsWith("e") && id.length <= 3) return { ok: true, demo: true }; // demo row id
  try {
    const supabase = await createClient();
    const companyU = await companyId(supabase);
    if (!companyU) return { ok: false, error: "Fyrirtæki fannst ekki" };
    const patch: Record<string, unknown> = {};
    if (input.email !== undefined) patch.email = input.email.trim() || null;
    if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
    if (input.kennitala !== undefined) patch.kennitala = input.kennitala.trim() || null;
    if (input.bankAccount !== undefined) patch.bank_account = input.bankAccount.trim() || null;
    if (input.address !== undefined) patch.address = input.address.trim() || null;
    if (input.nextOfKin !== undefined) patch.next_of_kin = input.nextOfKin.trim() || null;
    // Póstnúmer/staður (0060) — sér uppfærsla svo vistun virki þótt migration vanti.
    if (input.postalCode !== undefined || input.city !== undefined) {
      const pc: Record<string, string | null> = {};
      if (input.postalCode !== undefined) pc.postal_code = input.postalCode.trim() || null;
      if (input.city !== undefined) pc.city = input.city.trim() || null;
      const { error: pcErr } = await supabase.from("employees").update(pc).eq("id", id);
      if (pcErr) console.error("updateEmployee postal", pcErr.message);
    }
    if (input.rate) patch.rate = num(input.rate, 2900);
    if (input.employmentRatio) patch.employment_ratio = num(input.employmentRatio, 100);
    if (input.union) {
      const tplRes2 = await resolveUnionTemplate(supabase, companyU, input.union);
      patch.union_agreement = tplRes2.union ?? input.union;
      if (tplRes2.payRule) patch.pay_rule = tplRes2.payRule;
    }
    if (input.payType) patch.pay_type = input.payType === "Mánaðarlaun" ? "monthly" : "hourly";
    if (input.monthlyHours !== undefined) patch.monthly_hours = num(input.monthlyHours, 0) || null;
    if (input.pensionFund !== undefined) patch.pension_fund = input.pensionFund || null;
    if (input.hireDate) patch.hire_date = input.hireDate;
    if (input.position !== undefined) patch.position_id = await lookupId(supabase, "positions", input.position, companyU);
    if (input.department !== undefined) patch.department_id = await lookupId(supabase, "departments", input.department, companyU);
    if (input.location !== undefined) patch.location_id = await lookupId(supabase, "locations", input.location, companyU);

    if (Object.keys(patch).length) {
      const { error } = await supabase.from("employees").update(patch).eq("id", id);
      if (error) return { ok: false, error: userError(error) };
    }
    // Universal fields (0028) — best-effort until the migration runs.
    const uni: Record<string, unknown> = {};
    if (input.union !== undefined) {
      const tplName2 = input.union?.startsWith("tpl:")
        ? ((await resolveUnionTemplate(supabase, companyU, input.union)).payRule as { templateName?: string } | undefined)?.templateName
        : undefined;
      uni.union_name = input.union?.startsWith("tpl:") ? (tplName2 ?? "Eigin reglur") : (input.union || null);
    }
    if (input.ruleTemplateId !== undefined) {
      uni.rule_template_id = input.ruleTemplateId;
      if (input.ruleTemplateId) {
        const conv = await resolveUnionTemplate(supabase, companyU, `tpl:${input.ruleTemplateId}`);
        if (conv.payRule) { uni.pay_rule = conv.payRule; uni.union_agreement = conv.union; }
      }
    }
    if (input.contractType !== undefined) uni.contract_type = input.contractType;
    if (input.ratioVariable !== undefined) {
      const { error: rvErr } = await supabase.from("employees").update({ ratio_variable: input.ratioVariable }).eq("id", id);
      if (rvErr) console.error("updateEmployee ratio_variable", rvErr.message); // fyrir 0093
    }
    if (input.schedulePattern !== undefined) uni.schedule_pattern = input.schedulePattern ? { kind: input.schedulePattern } : null;
    if (Object.keys(uni).length) {
      await supabase.from("employees").update(uni).eq("id", id).then(() => {});
    }
    // Custom pay-rule set — best-effort (ignored before migration 0013).
    if (input.payRule !== undefined) {
      await supabase.from("employees").update({ pay_rule: input.payRule }).eq("id", id);
    }
    // Permissions + benefits — best-effort (ignored before migration 0016).
    if (input.permissions !== undefined) await supabase.from("employees").update({ permissions: input.permissions }).eq("id", id);
    if (input.benefits !== undefined) await supabase.from("employees").update({ benefits: input.benefits }).eq("id", id);
    if (input.orlof !== undefined) await supabase.from("employees").update({ orlof: input.orlof }).eq("id", id);
    if (input.paySettings !== undefined) {
      const { error: psErr } = await supabase.from("employees").update({ pay_settings: input.paySettings }).eq("id", id);
      if (psErr) return { ok: false, error: userError(psErr, "Tókst ekki að vista launaliði") };
    }
    if (!Object.keys(patch).length && input.payRule === undefined && input.permissions === undefined && input.benefits === undefined && input.orlof === undefined && input.paySettings === undefined) return { ok: true };

    const { data: { user } } = await supabase.auth.getUser();
    const company = await companyId(supabase);
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.update", entity: "employee", entityId: id, detail: "Launasnið uppfært",
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

const DEMO_DEPARTMENTS = ["Eldhús", "Sal", "Stjórnun"];

export type CompanyOptions = { departments: string[]; positions: string[]; locations: string[] };

/** Department name → color (for schedule/staff labels). Empty when 0038 hasn't run. */
export async function getDepartmentColors(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return {};
    const { data, error } = await supabase.from("departments")
      .select("name, color, locations!inner(company_id)")
      .eq("locations.company_id", company);
    if (error) return {};
    const out: Record<string, string> = {};
    for (const d of data ?? []) if (d.color) out[d.name as string] = d.color as string;
    return out;
  } catch {
    return {};
  }
}

/** Real select-options for the new-employee form (demo fallback). */
export async function getCompanyOptions(): Promise<CompanyOptions> {
  const demo: CompanyOptions = { departments: DEMO_DEPARTMENTS, positions: ["Kokkur", "Þjónn / Sal", "Bílstjóri"], locations: ["Reykjavík Asian", "Hotel Umi"] };
  if (!isSupabaseConfigured()) return demo;
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return demo;
    const [deps, pos, locs] = await Promise.all([
      supabase.from("departments").select("name, locations!inner(company_id)").eq("locations.company_id", company).order("name"),
      supabase.from("positions").select("name").eq("company_id", company).order("name"),
      supabase.from("locations").select("name").eq("company_id", company).order("name"),
    ]);
    const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter(Boolean))) as string[];
    return {
      departments: uniq((deps.data ?? []).map((d) => d.name as string)),
      positions: uniq((pos.data ?? []).map((d) => d.name as string)),
      locations: uniq((locs.data ?? []).map((d) => d.name as string)),
    };
  } catch {
    return demo;
  }
}

/** List the company's department names (for the oversight picker + filters). */
export async function getCompanyDepartments(): Promise<string[]> {
  if (!isSupabaseConfigured()) return DEMO_DEPARTMENTS;
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return DEMO_DEPARTMENTS;
    const { data } = await supabase
      .from("departments")
      .select("name, locations!inner(company_id)")
      .eq("locations.company_id", company)
      .order("name");
    const names = Array.from(new Set((data ?? []).map((d) => d.name as string).filter(Boolean)));
    return names; // tómt = engar deildir enn (ekki sýnidæmi)
  } catch {
    return DEMO_DEPARTMENTS;
  }
}

/** The departments a manager oversees (empty = all). */
export async function getOverseenDepartments(employeeId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("employees").select("oversees_departments").eq("id", employeeId).maybeSingle();
    return (data?.oversees_departments as string[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Assign which departments a manager oversees. Empty array = sees everything. */
export async function setOverseenDepartments(employeeId: string, names: string[]): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (employeeId.startsWith("e") && employeeId.length <= 3) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    // Best-effort — column exists only after migration 0025.
    const { error } = await supabase.from("employees").update({ oversees_departments: names }).eq("id", employeeId);
    if (error) return { ok: false, error: "Aðgerðin tókst ekki — reyndu aftur eða hafðu samband við VAKTO." };
    const { data: { user } } = await supabase.auth.getUser();
    const company = await companyId(supabase);
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.update", entity: "employee", entityId: employeeId,
      detail: names.length ? `Umsjón deilda: ${names.join(", ")}` : "Umsjón deilda: allar",
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

// ============================================================
// Employment contracts (0028) — generate from employee data, track status.
// Universal template: works for any country; e-signature comes later
// (status flow draft → sent → signed covers the manual path today).
// ============================================================

export type ContractRow = {
  id: string;
  title: string;
  template: string | null;
  status: "draft" | "sent" | "signed" | "void";
  content: string;
  created: string;
  signed_at: string | null;
  signed_via?: string | null;
};

/** Skyldureitur sem vantar — samningur er ekki sendur fyrr en hann er fylltur (sjá CONTRACT_BLANK í setContractStatus). */
const CONTRACT_BLANK = "____________";

/** Samningstexti úr NÚVERANDI gögnum starfsmanns og fyrirtækis (starf og vinnustaður leyst upp eftir id). */
async function contractContentFor(supabase: Awaited<ReturnType<typeof createClient>>, emp: Record<string, unknown>, comp: Record<string, unknown>, kind?: "employment" | "contractor"): Promise<string> {
  let positionName: string | undefined;
  if (emp.position_id) {
    const { data: pos } = await supabase.from("positions").select("name").eq("id", emp.position_id as string).maybeSingle();
    positionName = (pos?.name as string) ?? undefined;
  }
  let locationName: string | undefined;
  if (emp.location_id) {
    const { data: loc } = await supabase.from("locations").select("name").eq("id", emp.location_id as string).maybeSingle();
    locationName = (loc?.name as string) ?? undefined;
  }
  if (kind ? kind === "contractor" : isContractor(emp)) return contractorMarkdown(emp, comp, { locationName, positionName });
  return contractMarkdown(emp, comp, {
    unionName: (emp.union_name as string) || (emp.union_agreement as string) || undefined,
    contractType: (emp.contract_type as string) || undefined,
    locationName,
    positionName,
  });
}

/** Fyllir AUÐA skyldureiti í geymdum drögum úr nýjum texta (sami merkimiði). Annað í drögunum helst óbreytt. */
function fillBlankFields(stored: string, fresh: string): string {
  const freshVal = new Map<string, string>();
  for (const m of fresh.matchAll(/\*\*([^*]+?):\*\*[ \t]*([^\n]*)/g)) freshVal.set(m[1], m[2].trim());
  return stored.replace(/\*\*([^*]+?):\*\*[ \t]*_{6,}/g, (all, label: string) => {
    const v = freshVal.get(label);
    return v && !/^_{6,}$/.test(v) ? `**${label}:** ${v}` : all;
  });
}

const isContractor = (e: Record<string, unknown>) => e.contract_type === "contractor" || e.role === "contractor";

/**
 * Verksamningur (verktaki, ekki launþegi) — sama snið og ráðningarsamningurinn (tvítyngd heiti, skyldureitir).
 * Lykilatriði: sjálfstæði verktaka (engin launatengd réttindi, hann ber sjálfur skatta og gjöld), þóknun og
 * reikningar án VSK, trúnaður, hugverk og uppsögn. Sniðmátið kemur ekki í stað lögfræðiráðgjafar.
 */
function contractorMarkdown(e: Record<string, unknown>, c: Record<string, unknown>, extras: { locationName?: string; positionName?: string }): string {
  const req = (k: string, v: unknown) => `**${k}:** ${v == null || v === "" ? CONTRACT_BLANK : v}\n\n`;
  const opt = (k: string, v: unknown) => `**${k}:** ${v == null || v === "" ? "—" : v}\n\n`;
  const kr = (n: unknown) => `${nf(Math.round(Number(n) || 0))} kr.`;
  const dmy = (iso: unknown) => { const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]}.${+m[2]}.${m[1]}` : ""; };
  const address = [c.address, [c.postal_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const place = [extras.locationName && extras.locationName !== c.name ? extras.locationName : c.name, address].filter(Boolean).join(", ");
  const monthly = e.pay_type === "monthly";
  return `# Verksamningur / Contractor agreement

## Verkkaupi / Client
${req("Nafn / Name", c.name)}${req("Kennitala / ID No.", c.kennitala)}${req("Lögheimili / Address", address)}${opt("Sími / Telephone", c.phone)}${opt("Netfang / Email", c.email)}
## Verktaki / Contractor
${req("Nafn / Name", e.full_name)}${req("Kennitala / ID No.", e.kennitala)}${req("Heimilisfang / Address", [e.address, [e.postal_code, e.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))}${opt("Netfang / Email", e.email)}${opt("Sími / Telephone", e.phone)}${opt("Bankareikningur / Bank account", e.bank_account)}
## Verkefni / Scope of work
${req("Lýsing á verki / Description of work", e.title || extras.positionName)}${req("Vinnustaður / Place of work", place)}${req("Upphaf / Start date", dmy(e.hire_date))}${req("Gildistími / Term", "Ótímabundinn, uppsegjanlegur skv. kaflanum Uppsögn / Until further notice, terminable as set out under Termination")}
## Þóknun og reikningar / Fee and invoicing
${monthly ? req("Fast mánaðargjald án VSK / Fixed monthly fee excl. VAT", e.rate ? kr(e.rate) : "") : req("Tímagjald án VSK / Hourly rate excl. VAT", e.rate ? kr(e.rate) : "")}${req("Virðisaukaskattur / VAT", "Bætist við ef verktaki er virðisaukaskattsskyldur / Added if the contractor is VAT-registered")}${req("Reikningar / Invoicing", monthly ? "Verktaki gefur út reikning mánaðarlega / The contractor invoices monthly" : "Verktaki gefur út reikning mánaðarlega fyrir unnar stundir skv. tímaskráningu í VAKTO / The contractor invoices monthly for hours registered in VAKTO")}${req("Greiðslufrestur / Payment terms", "14 dagar frá dagsetningu reiknings / 14 days from the invoice date")}
## Sjálfstæði verktaka / Independent contractor
Verktaki er sjálfstæður atvinnurekandi en ekki launþegi verkkaupa. Hann ber sjálfur ábyrgð á staðgreiðslu skatta, tryggingagjaldi, lífeyrisgreiðslum og tryggingum vegna starfseminnar. Verktaki á ekki rétt á orlofi, veikindalaunum eða öðrum launatengdum réttindum frá verkkaupa. Hann ræður sjálfur hvernig verkið er unnið innan ramma samningsins, leggur til eigin búnað eftir því sem við á og er frjálst að vinna fyrir aðra. / The contractor is self-employed and not an employee of the client. The contractor is responsible for their own income tax, social security contributions, pension and insurance. The contractor is not entitled to holiday pay, sick pay or other employment rights from the client, decides how the work is carried out within this agreement, provides their own equipment where relevant and is free to work for others.

## Trúnaður / Confidentiality
Verktaki skal gæta trúnaðar um öll viðskipta- og persónuleg málefni verkkaupa, viðskiptavina hans og starfsfólks sem hann fær vitneskju um. Trúnaðarskyldan helst eftir að samningi lýkur. / The contractor shall keep confidential all business and personal matters of the client, its customers and staff that come to their knowledge. This duty continues after the agreement ends.

## Afurðir verksins / Work product
Afurðir verksins verða eign verkkaupa þegar greitt hefur verið fyrir þær, nema um annað sé samið skriflega. / Work product becomes the property of the client once paid for, unless otherwise agreed in writing.

## Uppsögn / Termination
${req("Uppsagnarfrestur / Notice period", "14 dagar, skriflega / 14 days, in writing")}Hvor aðili getur rift samningnum fyrirvaralaust ef hinn vanefnir hann verulega. Unnin verk til uppsagnardags skulu greidd. / Either party may terminate without notice if the other materially breaches the agreement. Work performed up to the termination date shall be paid for.

## Lög og varnarþing / Governing law
Um samninginn gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjavíkur. / This agreement is governed by Icelandic law. Disputes shall be brought before the District Court of Reykjavík.

_Undirritun / Signatures:_

Verkkaupi: ______________________　Dags: ________

Verktaki: ______________________　Dags: ________
`;
}

/**
 * Ráðningarsamningur eftir formi Vinnumálastofnunar (nóv. 2021) — sömu kaflar, sama röð,
 * tvítyngd heiti. Formið tilgreinir 9 lágmarksatriði (91/533/EBE): aðila, starfsstöð,
 * starfsheiti, upphaf og lengd, orlof, laun, starfshlutfall og vinnutíma, lífeyrissjóð og
 * kjarasamning/stéttarfélag. Skyldureitir sem VAKTO hefur ekki gögn í verða CONTRACT_BLANK;
 * valkvæðir verða „—“. Álagsprósentur fara EKKI inn (þær eru óstaðfestar í VAKTO) —
 * yfirvinna og vaktaálag eru „skv. kjarasamningi“ eins og formið gerir ráð fyrir.
 */
function contractMarkdown(e: Record<string, unknown>, c: Record<string, unknown>, extras: { unionName?: string; contractType?: string; locationName?: string; positionName?: string }): string {
  const req = (k: string, v: unknown) => `**${k}:** ${v == null || v === "" ? CONTRACT_BLANK : v}\n\n`;
  const opt = (k: string, v: unknown) => `**${k}:** ${v == null || v === "" ? "—" : v}\n\n`;
  const kr = (n: unknown) => `${nf(Math.round(Number(n) || 0))} kr.`;
  const dmy = (iso: unknown) => { const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]}.${+m[2]}.${m[1]}` : ""; };

  const full = String(e.full_name ?? "").trim();
  const parts = full.split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  const ratio = Number(e.employment_ratio) || 0; // autt → skyldureitur, aldrei sjálfgefið „fullt starf“
  const variable = e.ratio_variable === true;
  const hrs = e.monthly_hours ? String(e.monthly_hours).replace(".", ",") : "";
  const ratioText = variable
    ? `Breytilegt – tímavinna eftir vaktaplani${hrs ? `, að meðaltali um ${hrs} klst. á mánuði` : ratio > 0 && ratio < 100 ? `, viðmið um ${ratio}% starf` : ""} / Variable – hourly work according to the shift schedule${hrs ? `, on average about ${hrs} hours per month` : ratio > 0 && ratio < 100 ? `, approx. ${ratio}% position` : ""}`
    : !ratio ? "" : ratio >= 100 ? "Fullt starf 100% / Full position 100%" : `Hlutastarf ${ratio}% / Part time ${ratio}%`;
  const monthly = e.pay_type === "monthly";
  const temporary = extras.contractType === "temporary";
  const pattern = ((e.schedule_pattern as { kind?: string } | null)?.kind) ?? "";
  const dayWork = pattern === "weekdays";
  const union = extras.unionName;
  const orlof = e.orlof as { mode?: string; pct?: number } | null;
  const orlofPct = orlof?.pct ? `${String(orlof.pct).replace(".", ",")}%` : "";
  const orlofTxt = orlof?.mode === "pay_out" ? `Greitt út með launum${orlofPct ? ` (${orlofPct})` : ""} / Paid out with wages`
    : orlof?.mode === "to_bank" ? `Lagt inn á orlofsreikning${orlofPct ? ` (${orlofPct})` : ""} / Paid into a holiday account`
    : orlofPct ? `Áunnið orlof ${orlofPct} skv. kjarasamningi / Accrued acc. to collective agreement`
    : "Skv. kjarasamningi og lögum nr. 30/1987 um orlof / Acc. to collective agreement and the Holiday Act";
  const benefits = (e.benefits as { name: string; amount?: number }[] | null) ?? [];
  const address = [c.address, [c.postal_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const place = [extras.locationName && extras.locationName !== c.name ? extras.locationName : c.name, address].filter(Boolean).join(", ");
  const terms = (c.contract_terms as string | null)?.trim();

  return `# Ráðningarsamningur / Contract of employment

## Vinnuveitandi / Employer
${req("Nafn / Name", c.name)}${req("Kennitala / ID No.", c.kennitala)}${req("Lögheimili / Address", address)}${opt("Sími / Telephone", c.phone)}${opt("Netfang / Email", c.email)}
## Starfsmaður / Employee
${req("Skírnarnafn / First name", first)}${req("Eftirnafn / Surname", last)}${req("Kennitala eða fæðingardagur / ID No. or date of birth", e.kennitala)}${req("Heimili á Íslandi / Address in Iceland", [e.address, [e.postal_code, e.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))}${opt("Aðsetur ef annað / Temporary address", "")}${opt("Netfang / Email", e.email)}${opt("Sími / Telephone", e.phone)}${opt("Nánasti aðstandandi og sími / Closest family member and tel.", e.next_of_kin)}
## Starfssvið / Field of work
${req("Starfsheiti og stutt lýsing á starfi / Job designation and short description", e.title || extras.positionName)}${req("Vinnustaður / Place of work", place)}${opt("Vinna á mismunandi vinnustöðum / Work at more than one place", "Nei / No")}
## Vinnutími / Working time
${req("Starfshlutfall / Work ratio", ratioText)}${req("Fyrirkomulag / Arrangement", dayWork ? "Dagvinna / Daytime work" : "Vaktavinna / Shift work")}${opt("Vinnustundir á mánuði / Hours per month", e.monthly_hours ? String(e.monthly_hours).replace(".", ",") : "")}${opt("Annað / Other information", "Vaktir eru birtar í vaktaplani VAKTO. / Shifts are published in the VAKTO schedule.")}
## Ráðningartími / Length of engagement
${req("Ráðning / Engagement", temporary ? "Tímabundin / Temporary" : "Ótímabundin / Unlimited")}${req("Fyrsti starfsdagur / Starting date", dmy(e.hire_date))}${temporary ? req("Til / To", "") : ""}
## Laun / Wages
${req("Launaákvörðun / Wage basis", union ? "Skv. kjarasamningi / Acc. to collective agreement" : "Skv. samkomulagi / By agreement")}${opt("Launaflokkur og þrep / Payscale group and step", "")}${monthly ? req("Laun kr./mán. / Wage ISK/month", e.rate ? kr(e.rate) : "") : req("Dagvinna kr./klst. / Daytime work ISK/hr", e.rate ? kr(e.rate) : "")}${req("Yfirvinna kr./klst. / Overtime ISK/hr", "Skv. kjarasamningi / Acc. to collective agreement")}${req("Vaktaálag / Shift supplement", "Skv. kjarasamningi / Acc. to collective agreement")}${opt("Aðrar greiðslur / Other payments", "")}${opt("Hlunnindi / Perquisites", benefits.length ? benefits.map((b) => b.amount ? `${b.name} (${kr(b.amount)})` : b.name).join(", ") : "Engin / None")}${req("Fyrirkomulag orlofsgreiðslna / Holiday entitlement", orlofTxt)}${req("Greiðslufyrirkomulag / Method of payment", "Mánaðarlega, á reikning starfsmanns / Monthly, into the employee's bank account")}${opt("Bankareikningur / Bank account", e.bank_account)}
## Uppsagnarfrestur, orlof og veikindagreiðslur / Notice period, holiday pay and sick-leave pay
${req("Fyrirkomulag / Arrangement", "Samkvæmt neðanskráðum kjarasamningi / Acc. to collective agreement named below")}${opt("Sérákvæði / Special provision", "")}
## Áunnin réttindi samkvæmt kjarasamningi* / Earned rights acc. to collective agreement*
${opt("Miðað við fyrri ráðningu hjá fyrirtækinu / Based on previous engagement with company", "")}${opt("Miðað við starfsgrein / Based on occupation", "")}${opt("Annað / Other", "")}
* Átt er við áunnin réttindi samkv. kjarasamningi eða samkv. reglum sem byggja á ákvæðum samningsins um Evrópska efnahagssvæðið. / Refers to earned rights acc. to collective agreement or according to rules based on the EEA Agreement.

## Kjarasamningur / Collective agreement
Um réttindi og skyldur fer að öðru leyti skv. kjarasamningi. Samningar um lakari kjör en almennir kjarasamningar ákveða eru ógildir (1. gr. laga nr. 55/1980). / All other rights and obligations acc. to the collective agreement. Agreements on poorer terms than the general collective agreements are void (Art. 1, Act No. 55/1980).

${req("Kjarasamningur / Collective agreement", union)}${req("Stéttarfélag / Trade union", union)}${req("Lífeyrissjóður / Pension fund", e.pension_fund)}${terms ? `\n## Sérákvæði / Special provisions\n${terms}\n` : ""}
_Undirritun / Signatures:_

Vinnuveitandi: ______________________　Dags: ________

Starfsmaður: ______________________　Dags: ________
`;
}

/** Generate a contract draft from employee + company data. */
/** `kind` velur samningsgerð; sjálfgefið eftir hlutverki (verktaki → verksamningur). */
export async function generateContract(employeeId: string, kind?: "employment" | "contractor"): Promise<ActionResult & { content?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };
    const [{ data: emp }, { data: comp }] = await Promise.all([
      supabase.from("employees").select("*").eq("id", employeeId).maybeSingle(),
      supabase.from("companies").select("*").eq("id", company).maybeSingle(),
    ]);
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const verk = kind ? kind === "contractor" : isContractor(emp);
    const content = await contractContentFor(supabase, emp, comp ?? {}, verk ? "contractor" : "employment");
    const { data: { user } } = await supabase.auth.getUser();
    const { data: created, error } = await supabase.from("contracts").insert({
      company_id: company,
      employee_id: employeeId,
      template: verk ? "verktaki-2026" : "vmst-2021",
      title: `${verk ? "Verksamningur" : "Ráðningarsamningur"} — ${emp.full_name}`,
      content,
      status: "draft",
      created_by: user?.id ?? null,
    }).select("id").maybeSingle();
    if (error) return { ok: false, error: /contracts/.test(error.message) ? "Aðgerðin tókst ekki — reyndu aftur eða hafðu samband við VAKTO." : userError(error), content };
    await logAudit(supabase, company, user?.id ?? null, { action: "contract.create", entity: "contracts", detail: `Samningur búinn til — ${emp.full_name}` });
    revalidatePath("/starfsfolk");
    return { ok: true, id: created?.id as string | undefined, content };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function listContracts(employeeId: string): Promise<{ contracts: ContractRow[]; live: boolean }> {
  if (!isSupabaseConfigured()) return { contracts: [], live: false };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("contracts")
      .select("id, title, template, status, content, created_at, signed_at, signed_via")
      .eq("employee_id", employeeId).order("created_at", { ascending: false });
    if (error) return { contracts: [], live: false };
    return {
      live: true,
      contracts: (data ?? []).map((r) => ({
        id: r.id as string, title: r.title as string, template: r.template as string | null,
        status: r.status as ContractRow["status"], content: r.content as string,
        created: String(r.created_at).slice(0, 10), signed_at: r.signed_at ? String(r.signed_at).slice(0, 10) : null,
        signed_via: (r.signed_via as string | null) ?? null,
      })),
    };
  } catch {
    return { contracts: [], live: false };
  }
}

/** Save edited draft content — review-before-send flow. Drafts only. */
export async function updateContractContent(id: string, content: string): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const { data: c } = await supabase.from("contracts").select("status").eq("id", id).maybeSingle();
    if (!c) return { ok: false, error: "Samningur fannst ekki" };
    if (c.status !== "draft") return { ok: false, error: "Aðeins er hægt að breyta drögum — gerðu nýjan samning." };
    const { error } = await supabase.from("contracts").update({ content }).eq("id", id);
    if (error) return { ok: false, error: userError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function deleteContract(id: string): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const { data: c } = await supabase.from("contracts").select("company_id, title, status").eq("id", id).maybeSingle();
    if (!c) return { ok: false, error: "Samningur fannst ekki" };
    // Undirritaðan samning má líka eyða (undirritað PDF í Skjöl starfsmannsins stendur eftir); skráð í atvikaskrá.
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) return { ok: false, error: userError(error) };
    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, c.company_id as string, user?.id ?? null, {
      action: "contract.delete", entity: "contracts", entityId: id, detail: `Samningi eytt — ${c.title}${c.status === "signed" ? " (var undirritaður)" : ""}`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Virkja ógiltan samning aftur: undirritaður áður → „undirritað“, annars aftur í drög. */
export async function restoreContract(id: string): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const { data: c } = await supabase.from("contracts").select("company_id, title, status, signed_at").eq("id", id).maybeSingle();
    if (!c) return { ok: false, error: "Samningur fannst ekki" };
    if (c.status !== "void") return { ok: false, error: "Samningurinn er ekki óvirkur" };
    const status = c.signed_at ? "signed" : "draft";
    const { error } = await supabase.from("contracts").update({ status, ...(status === "draft" ? { sent_at: null } : {}) }).eq("id", id);
    if (error) return { ok: false, error: userError(error) };
    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, c.company_id as string, user?.id ?? null, {
      action: "contract.restore", entity: "contracts", entityId: id, detail: `Samningur virkjaður aftur — ${c.title}`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function setContractStatus(
  id: string, status: "draft" | "sent" | "signed" | "void",
  signer?: { ssn: string; phone?: string },
): Promise<ActionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    // Taktikal (0062): fyrirtækið notar rafræn skilríki → þarf kennitölu undirritara áður en sent er.
    let useTaktikal = false;
    if (status === "sent" && taktikalEnabled()) {
      const cid = await companyId(supabase);
      const { data: co } = cid ? await supabase.from("companies").select("esign_provider").eq("id", cid).maybeSingle() : { data: null };
      useTaktikal = co?.esign_provider === "taktikal";
      if (useTaktikal && !signer?.ssn) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: me } = user ? await supabase.from("employees").select("kennitala, phone").eq("user_id", user.id).maybeSingle() : { data: null };
        return { ok: false, needSigner: { ssn: (me?.kennitala as string) ?? "", phone: (me?.phone as string) ?? "" } };
      }
    }
    // Skyldureitir (lágmarksatriði 91/533/EBE) verða að vera fylltir áður en samningur er sendur.
    if (status === "sent") {
      const { data: cur } = await supabase.from("contracts").select("content, employee_id, company_id, status, template").eq("id", id).maybeSingle();
      let content = String(cur?.content ?? "");
      // Drögin voru búin til áður en t.d. heimilisfang eða lífeyrissjóður var skráður → fylla auða reiti úr nýjustu gögnum.
      if (/\*\*[^*]+?:\*\*\s*_{6,}/.test(content) && cur?.employee_id && cur.status === "draft") {
        const [{ data: emp }, { data: comp }] = await Promise.all([
          supabase.from("employees").select("*").eq("id", cur.employee_id as string).maybeSingle(),
          supabase.from("companies").select("*").eq("id", cur.company_id as string).maybeSingle(),
        ]);
        if (emp) {
          const filled = fillBlankFields(content, await contractContentFor(supabase, emp, comp ?? {}, cur.template === "verktaki-2026" ? "contractor" : "employment"));
          if (filled !== content) {
            await supabase.from("contracts").update({ content: filled }).eq("id", id);
            content = filled;
          }
        }
      }
      const WHERE: Record<string, string> = {
        "Heimili á Íslandi": "flipinn Persónulegt", "Kennitala eða fæðingardagur": "flipinn Persónulegt",
        "Starfsheiti og stutt lýsing á starfi": "starf í flipanum Vinna", "Vinnustaður": "staður í flipanum Vinna",
        "Starfshlutfall": "flipinn Laun", "Lífeyrissjóður": "flipinn Laun", "Kjarasamningur": "flipinn Laun", "Stéttarfélag": "flipinn Laun",
        "Heimilisfang": "flipinn Persónulegt", "Kennitala": "flipinn Persónulegt", "Lýsing á verki": "starf í flipanum Vinna",
        "Upphaf": "upphafsdagur í flipanum Vinna", "Tímagjald án VSK": "taxti í flipanum Laun", "Fast mánaðargjald án VSK": "flipinn Laun",
      };
      const missing = [...content.matchAll(/\*\*([^*]+?):\*\*\s*_{6,}/g)].map((m) => { const k = m[1].split(" / ")[0]; return WHERE[k] ? `${k} (${WHERE[k]})` : k; });
      if (missing.length) return { ok: false, error: `Fylltu út áður en samningurinn er sendur: ${missing.join(", ")}` };
    }
    const patch: Record<string, unknown> = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "signed") patch.signed_at = new Date().toISOString();
    const { data: row, error } = await supabase.from("contracts").update(patch).eq("id", id)
      .select("employee_id, employees(full_name, email), companies(name)").maybeSingle();
    if (error) return { ok: false, error: userError(error) };
    if (status === "void") {
      const { data: c } = await supabase.from("contracts").select("company_id, title").eq("id", id).maybeSingle();
      const { data: { user } } = await supabase.auth.getUser();
      if (c) await logAudit(supabase, c.company_id as string, user?.id ?? null, {
        action: "contract.void", entity: "contracts", entityId: id, detail: `Samningur óvirkjaður — ${c.title}`,
      });
    }
    // Taktikal: stofna undirritunarferli (vinnuveitandi skrifar fyrst með rafrænum skilríkjum).
    if (status === "sent" && row && useTaktikal && signer) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: u } = user ? await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle() : { data: null };
      try {
        const r = await startTaktikalSigning(id, {
          userId: user?.id ?? "", name: (u?.full_name as string) || user?.email || "Vinnuveitandi", email: user?.email ?? "",
          ssn: signer.ssn, phone: signer.phone,
        });
        if (!r.ok) { await supabase.from("contracts").update({ status: "draft", sent_at: null }).eq("id", id); return { ok: false, error: r.error }; }
        revalidatePath("/starfsfolk");
        return { ok: true, employerUrl: r.employerUrl };
      } catch (e) {
        console.error("startTaktikalSigning", e);
        await supabase.from("contracts").update({ status: "draft", sent_at: null }).eq("id", id);
        return { ok: false, error: "Tókst ekki að stofna undirritun hjá Taktikal — reyndu aftur" };
      }
    }
    // "Sent" → vinnuveitandi undirritar (lota + IP/tæki + fingrafar skjals, 0058).
    if (status === "sent" && row) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: me } = await supabase.from("employees").select("full_name").eq("user_id", user.id).maybeSingle();
          const { data: u } = await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle();
          const name = (u?.full_name as string) || (me?.full_name as string) || user.email || "Vinnuveitandi";
          await employerSign(id, { userId: user.id, name, email: user.email ?? null }, metaFrom(await headers()));
        }
      } catch (e) { console.error("employerSign", e); }
    }
    // "Sent" → tell the employee a contract awaits their signature (best-effort).
    if (status === "sent" && row) {
      const emp = (Array.isArray(row.employees) ? row.employees[0] : row.employees) as { full_name?: string; email?: string } | null;
      const co = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as { name?: string } | null;
      if (emp?.email) void sendContractEmail(emp.email, emp.full_name ?? "", co?.name ?? "Fyrirtækið þitt");
      await notifyContractEmployee(id, "sign"); // push í appið (opnar samninginn); kastar aldrei
    }
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Sendir undirritunarbeiðni samnings aftur á skráð netfang starfsmanns (VAKTO AI: resend_contract).
 *  Nýjasti óundirritaði samningurinn: „sendur“ → boðið endursent (sama póstur / sama Taktikal-ferli, engin ný
 *  undirskrift); „drög“ → venjuleg sending (setContractStatus: undirritun fyrirtækis + póstur). Undirritaður → villa. */
export async function resendContract(employeeId: string, contractId?: string): Promise<ActionResult & { signedAt?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (await demoBlocked()) return demoResult(); // opið demo: enginn póstur / Taktikal (sjá líka þröskuldana)
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };
    const { data: rows, error } = await supabase.from("contracts")
      .select("id, title, status, signed_at, signed_via, employees(full_name, email), companies(name)")
      .eq("employee_id", employeeId).eq("company_id", company).neq("status", "void").order("created_at", { ascending: false });
    if (error) return { ok: false, error: userError(error) };
    const open = contractId
      ? (rows ?? []).find((r) => r.id === contractId && (r.status === "sent" || r.status === "draft"))
      : (rows ?? []).find((r) => r.status === "sent") ?? (rows ?? []).find((r) => r.status === "draft");
    if (!open) {
      const signed = (rows ?? []).find((r) => r.status === "signed");
      if (signed) return { ok: false, signedAt: String(signed.signed_at ?? "").slice(0, 10), error: `Samningurinn er þegar undirritaður${signed.signed_at ? ` (${String(signed.signed_at).slice(0, 10)})` : ""} — undirritað afrit er í skjalasafni starfsmannsins.` };
      return { ok: false, error: "Enginn samningur til — búðu hann til í Starfsfólk → Samningar." };
    }
    const emp = (Array.isArray(open.employees) ? open.employees[0] : open.employees) as { full_name?: string; email?: string } | null;
    if (!emp?.email) return { ok: false, error: `Ekkert netfang skráð á ${emp?.full_name ?? "starfsmanninn"} — skráðu það í flipanum Persónulegt.` };
    if (open.status === "draft") {
      const r = await setContractStatus(open.id as string, "sent");
      if (r.needSigner) return { ok: false, error: "Fyrirtækið notar rafræn skilríki — opnaðu samninginn í Starfsfólk → Samningar og skrifaðu undir þar." };
      return r;
    }
    if (open.signed_via === "taktikal") {
      // Webhook gæti hafa misfarist: uppfæra stöðuna frá Taktikal fyrst (býður starfsmanni ef fyrirtækið hefur undirritað).
      const synced = await syncTaktikalContract(open.id as string).catch(() => null);
      if (synced?.changes?.includes("employee_invited")) return { ok: true };
      if (synced?.changes?.includes("contract_signed")) return { ok: false, error: "Samningurinn reyndist þegar undirritaður — staðan hefur verið uppfærð." };
      const r = await resendTaktikalInvite(open.id as string);
      if (!r.ok) return r;
    } else {
      const co = (Array.isArray(open.companies) ? open.companies[0] : open.companies) as { name?: string } | null;
      await sendContractEmail(emp.email, emp.full_name ?? "", co?.name ?? "Fyrirtækið þitt");
      await notifyContractEmployee(open.id as string, "sign");
    }
    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, company, user?.id ?? null, { action: "contract.resend", entity: "contracts", entityId: open.id as string, detail: `Samningur sendur aftur — ${emp.full_name ?? ""} (${emp.email})` });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Samningsstaða starfsmanns fyrir lista Starfsfólks (smá merki á hverri röð).
 *  signed = undirritað · employee = bíður starfsmanns · company = bíður fyrirtækis (drög eða fyrirtækið á eftir að undirrita). */
export type EmployeeContractState = "signed" | "employee" | "company";
export async function getContractStatusMap(): Promise<Record<string, EmployeeContractState>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return {};
    const { data, error } = await supabase.from("contracts")
      .select("employee_id, status, employer_signed_at").eq("company_id", company).neq("status", "void");
    if (error) return {};
    const rank: Record<EmployeeContractState, number> = { signed: 3, employee: 2, company: 1 };
    const map: Record<string, EmployeeContractState> = {};
    for (const r of data ?? []) {
      const st: EmployeeContractState = r.status === "signed" ? "signed" : r.status === "sent" && r.employer_signed_at ? "employee" : "company";
      const cur = map[r.employee_id as string];
      if (!cur || rank[st] > rank[cur]) map[r.employee_id as string] = st;
    }
    return map;
  } catch {
    return {};
  }
}

/** Samningur í fyrirtæki kallandans — aðeins stjórnendur/vaktstjórar (RLS + hlutverk). */
async function managedContract(contractId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!me?.company_id || !["owner", "manager"].includes(me.role as string)) return null;
  const { data: c } = await supabase.from("contracts").select("id, employee_id, company_id").eq("id", contractId).eq("company_id", me.company_id as string).maybeSingle();
  return c ? { supabase, user, company: me.company_id as string, contract: c } : null;
}

export type ContractProgress = {
  id: string;
  /** Aðferð: Taktikal (rafræn skilríki) eða kóði í tölvupósti / handvirkt. */
  method: "taktikal" | "email_otp" | "manual" | null;
  sentAt: string | null;
  employer: { name: string | null; at: string } | null;
  employee: { name: string | null; at: string } | null;
  pdfStored: boolean;
  /** contract_taktikal.status (created/employer_signed/…/canceled/expired) */
  taktikalStatus: string | null;
  /** Síðast athugað hjá Taktikal / síðasta webhook. */
  checkedAt: string | null;
};

/** Undirritunarferill hvers samnings starfsmanns: sent → fyrirtæki → starfsmaður → PDF vistað. */
export async function getContractProgress(employeeId: string): Promise<Record<string, ContractProgress>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return {};
    const { data: rows } = await supabase.from("contracts")
      .select("id, status, signed_via, sent_at, created_at, signed_at, signed_by_name, employer_signed_at, employer_signed_by")
      .eq("company_id", company).eq("employee_id", employeeId);
    if (!rows?.length) return {};
    const ids = rows.map((r) => r.id as string);
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const [{ data: sigs }, { data: tk }, { data: docs }] = await Promise.all([
      supabase.from("contract_signatures").select("contract_id, signer_role, signer_name, method, signed_at").in("contract_id", ids),
      admin.from("contract_taktikal").select("contract_id, status, updated_at").in("contract_id", ids),
      admin.from("documents").select("url, name, type, created_at").eq("company_id", company).eq("employee_id", employeeId),
    ]);
    const out: Record<string, ContractProgress> = {};
    for (const r of rows) {
      const id = r.id as string;
      const mine = (sigs ?? []).filter((s) => s.contract_id === id);
      const emr = mine.find((s) => s.signer_role === "employer");
      const eme = mine.find((s) => s.signer_role === "employee");
      const t = (tk ?? []).find((x) => x.contract_id === id);
      const via = (r.signed_via as string | null) ?? (eme?.method as string | undefined) ?? null;
      const method = via === "taktikal" || eme?.method === "taktikal_qes" ? "taktikal" : via === "email_otp" ? "email_otp" : r.status === "signed" ? "manual" : via ? "email_otp" : null;
      const employerAt = (emr?.signed_at as string | undefined) ?? (r.employer_signed_at as string | null) ?? null;
      const employeeAt = (eme?.signed_at as string | undefined) ?? (r.status === "signed" ? (r.signed_at as string | null) : null) ?? null;
      out[id] = {
        id, method,
        sentAt: (r.sent_at as string | null) ?? null,
        employer: employerAt ? { name: (emr?.signer_name as string | undefined) ?? (r.employer_signed_by as string | null) ?? null, at: employerAt } : null,
        employee: employeeAt ? { name: (eme?.signer_name as string | undefined) ?? (r.signed_by_name as string | null) ?? null, at: employeeAt } : null,
        pdfStored: (docs ?? []).some((d) => String(d.url ?? "").startsWith(`${company}/${employeeId}/${id}-`))
          || (r.status === "signed" && (docs ?? []).some((d) => d.type === "Samningur" && /undirrit/i.test(String(d.name ?? "")) && String(d.created_at ?? "") >= String(r.created_at ?? ""))),
        taktikalStatus: (t?.status as string | undefined) ?? null,
        checkedAt: (t?.updated_at as string | undefined) ?? null,
      };
    }
    return out;
  } catch (e) {
    console.error("[getContractProgress]", e);
    return {};
  }
}

/** „Uppfæra stöðu frá Taktikal“ — sækir stöðu ferlisins og keyrir sömu stöðuvél og webhookið.
 *  auto=true (við opnun samningsspjalds): hægt á — í mesta lagi einu sinni á mínútu per samning. */
export async function syncContractStatus(contractId: string, auto = false): Promise<TaktikalSyncResult> {
  if (await demoBlocked()) return { ok: false, error: "Þetta er ekki í boði í demo" };
  if (!isSupabaseConfigured()) return { ok: false };
  try {
    const m = await managedContract(contractId);
    if (!m) return { ok: false, error: "Samningur fannst ekki" };
    const r = await syncTaktikalContract(contractId, { minIntervalMs: auto ? 60_000 : 0 });
    if (r.changes?.length) {
      await logAudit(m.supabase, m.company, m.user.id, { action: "contract.sync", entity: "contracts", entityId: contractId, detail: `Staða samnings uppfærð frá Taktikal: ${r.changes.join(", ")}` });
    }
    return r;
  } catch (e) {
    console.error("[syncContractStatus]", e);
    return { ok: false, error: "Tókst ekki að uppfæra stöðuna" };
  }
}

/** Opnar undirritaða PDF-ið (úr skjalasafni starfsmannsins) — stuttur signed URL. */
export async function openSignedContractPdf(contractId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  try {
    const m = await managedContract(contractId);
    if (!m) return { ok: false, error: "Samningur fannst ekki" };
    const path = await signedPdfPath(contractId);
    if (!path) return { ok: false, error: "Undirritað PDF hefur ekki verið vistað enn" };
    const { data, error } = await m.supabase.storage.from("documents").createSignedUrl(path, 120);
    if (error || !data?.signedUrl) return { ok: false, error: "Tókst ekki að opna skjalið" };
    return { ok: true, url: data.signedUrl };
  } catch {
    return { ok: false, error: "Tókst ekki að opna skjalið" };
  }
}


/** Resolve a "tpl:<id>" union value into (union label, pay_rule). */
async function resolveUnionTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>, company: string, union: string | undefined,
): Promise<{ union?: string; payRule?: unknown }> {
  if (!union?.startsWith("tpl:")) return { union };
  const id = union.slice(4);
  const { data: tpl } = await supabase
    .from("rule_templates").select("name, rules").eq("id", id).eq("company_id", company).maybeSingle();
  if (!tpl) return { union: "Eigin reglur" };
  return { union: "Eigin reglur", payRule: { ...templateToPayRule(tpl.rules as TplRuleSet), templateName: tpl.name as string } };
}


export type EmployeeTimebank = { live: boolean; balance: number; months: { label: string; required: number; actual: number; delta: number }[] };

/** Time-bank summary for one employee — same running-balance model as Innsýn. */
export async function getEmployeeTimebank(employeeId: string): Promise<EmployeeTimebank | null> {
  try {
    const tb = await getTimeBank(6);
    if (!tb.live) return null;
    const row = tb.rows.find((r) => r.id === employeeId);
    if (!row) return { live: true, balance: 0, months: [] };
    return { live: true, balance: row.balance, months: row.months };
  } catch {
    return null;
  }
}

/** Undirritunarskrá samnings (0058) — fyrir PDF með undirritunarskrá. RLS: stjórnandi/eigandi samnings. */
export async function getContractSignatures(id: string): Promise<SignatureRecord[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("contract_signatures")
      .select("signer_role, signer_name, signer_email, method, signed_at, ip, user_agent, doc_sha256")
      .eq("contract_id", id).order("signed_at");
    if (error) return [];
    return (data ?? []).map((s) => ({
      role: s.signer_role as "employer" | "employee", name: s.signer_name as string, email: (s.signer_email as string | null) ?? null,
      method: s.method as string, signedAt: s.signed_at as string, ip: (s.ip as string | null) ?? null,
      userAgent: (s.user_agent as string | null) ?? null, sha256: s.doc_sha256 as string,
    }));
  } catch {
    return [];
  }
}

/** Opnar undirritunartengil vinnuveitanda aftur (Taktikal), t.d. ef glugganum var lokað. */
export async function taktikalEmployerLink(contractId: string): Promise<{ ok: boolean; url?: string; status?: string; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false };
  try {
    const supabase = await createClient();
    const { data: c } = await supabase.from("contracts").select("id").eq("id", contractId).maybeSingle(); // RLS: stjórnandi fyrirtækisins
    if (!c) return { ok: false, error: "Samningur fannst ekki" };
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: t } = await createAdminClient().from("contract_taktikal").select("employer_url, status").eq("contract_id", contractId).maybeSingle();
    if (!t) return { ok: false };
    return { ok: true, url: t.employer_url as string, status: t.status as string };
  } catch {
    return { ok: false };
  }
}

/** Stjórnandi setur prófílmynd á starfsmann (avatars-fötu fyrirtækisins; RLS leyfir stjórnendum). */
export async function uploadEmployeePhoto(employeeId: string, dataUrl: string): Promise<ActionResult & { url?: string }> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const company = await companyId(supabase);
    if (!user || !company) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: emp } = await supabase.from("employees").select("id").eq("id", employeeId).eq("company_id", company).maybeSingle();
    if (!emp) return { ok: false, error: "Starfsmaður fannst ekki" };
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) return { ok: false, error: "Veldu JPG, PNG eða WebP mynd" };
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 5 * 1024 * 1024) return { ok: false, error: "Myndin má mest vera 5 MB" };
    const ext = m[1].split("/")[1].replace("jpeg", "jpg");
    const path = `${company}/${employeeId}/photo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: m[1], upsert: true });
    if (upErr) { console.error("[uploadEmployeePhoto]", upErr.message); return { ok: false, error: "Tókst ekki að hlaða myndinni upp" }; }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("employees").update({ photo_url: url }).eq("id", employeeId).eq("company_id", company);
    if (error) { console.error("[uploadEmployeePhoto]", error.message); return { ok: false, error: "Tókst ekki að vista myndina" }; }
    await logAudit(supabase, company, user.id, { action: "employee.photo", entity: "employee", entityId: employeeId, detail: "Prófílmynd uppfærð" });
    revalidatePath("/starfsfolk", "layout");
    return { ok: true, url };
  } catch (e) {
    console.error("[uploadEmployeePhoto]", e);
    return { ok: false, error: "Tókst ekki að vista myndina" };
  }
}

export type InviteEmployeesResult = { ok: boolean; sent?: number; linked?: number; failed?: { name: string; error: string }[]; error?: string };
const ROLE_LABEL: Record<string, string> = { employee: "Starfsmaður", manager: "Vaktstjóri", owner: "Stjórnandi", contractor: "Verktaki" };

/** Sendir boð í appið á starfsfólk sem hefur netfang en engan aðgang (t.d. eftir Excel-innlestur).
 *  ids = tiltekið starfsfólk; án ids = allt virkt starfsfólk án aðgangs. Aðeins stjórnendur og vaktstjórar. */
export async function inviteEmployees(ids?: string[]): Promise<InviteEmployeesResult> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, sent: 0 };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: me } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
    const company = me?.company_id as string | undefined;
    if (!company || !["owner", "manager"].includes(me?.role as string)) return { ok: false, error: "Aðeins stjórnendur geta sent boð" };
    let q = supabase.from("employees").select("id, full_name, email, role")
      .eq("company_id", company).is("user_id", null).neq("status", "inactive").not("email", "is", null);
    if (ids?.length) q = q.in("id", ids.slice(0, 500));
    const { data: emps, error } = await q;
    if (error) return { ok: false, error: userError(error) };
    let sent = 0, linked = 0;
    const failed: { name: string; error: string }[] = [];
    for (const e of emps ?? []) {
      const email = String(e.email ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { failed.push({ name: e.full_name as string, error: "Ógilt netfang" }); continue; }
      const inv = await inviteToCompany(company, email, ROLE_LABEL[e.role as string] ?? "Starfsmaður");
      if (!inv.ok) failed.push({ name: e.full_name as string, error: inv.error ?? "Villa" });
      else if (inv.sent) sent++; else linked++;
    }
    await logAudit(supabase, company, user.id, { action: "employee.invite", entity: "employee", detail: `Boð í appið: ${sent} send, ${linked} tengd` });
    revalidatePath("/starfsfolk");
    return { ok: true, sent, linked, failed };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Allir launaseðlar starfsmanns úr vistuðum launakeyrslum VAKTO (nýjast fyrst) — Laun-flipinn.
 *  Sama sundurliðun og launaseðill keyrslunnar; taxti/hlutföll eru núverandi stillingar starfsmanns. */
export type EmployeePayslip = { runId: string; status: string; d: PayslipDetail };
export async function listEmployeePayslips(employeeId: string): Promise<EmployeePayslip[]> {
  if (!isSupabaseConfigured() || (employeeId.startsWith("e") && employeeId.length <= 3)) return [];
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return [];
    const [{ data: lines }, { data: emp }, { data: co }] = await Promise.all([
      supabase.from("payroll_lines").select("*, payroll_runs!inner(id, company_id, period_start, period_end, status, created_at)")
        .eq("employee_id", employeeId).eq("payroll_runs.company_id", company),
      supabase.from("employees").select("*, positions(name)").eq("id", employeeId).eq("company_id", company).maybeSingle(),
      supabase.from("companies").select("name, kennitala").eq("id", company).maybeSingle(),
    ]);
    if (!lines?.length || !emp) return [];
    const pay = resolvePay(emp.pay_settings as Partial<PaySettings> | null);
    const pos = (Array.isArray(emp.positions) ? emp.positions[0] : emp.positions) as { name?: string } | null;
    const nice = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d}.${m}.${y}`; };
    type Run = { id: string; period_start: string; period_end: string; status: string; created_at: string };
    const runOf = (l: Record<string, unknown>) => (Array.isArray(l.payroll_runs) ? l.payroll_runs[0] : l.payroll_runs) as Run;
    const ytdRows = lines.map((l) => ytdRowFrom(l, runOf(l)));
    return lines.map((l) => {
      const r = runOf(l);
      const n = (k: string) => Number((l as Record<string, unknown>)[k] ?? 0);
      return {
        runId: r.id, status: r.status,
        d: {
          name: emp.full_name as string, kennitala: (emp.kennitala as string) ?? null, title: (emp.title as string) || pos?.name || null,
          union: (emp.union_agreement as string) ?? null, bankAccount: (emp.bank_account as string) ?? null,
          company: (co?.name as string) ?? "", companyKt: (co?.kennitala as string) ?? null,
          period: `${nice(r.period_start)} – ${nice(r.period_end)}`, from: r.period_start, to: r.period_end,
          payType: emp.pay_type === "monthly" ? "monthly" : "hourly", rate: Number(emp.rate) || 0,
          hours: n("hours"), dayPay: n("day_pay"), premiums: n("premiums"), overtime: n("overtime"), uppbot: n("uppbot"),
          gross: n("gross"), pension: n("pension"), unionFee: n("union_fee"), withholding: n("withholding"), net: n("net"),
          orlof: n("orlof"), orlofToBank: n("orlof_to_bank"), extraPension: n("extra_pension"), allowanceUsed: n("allowance_used"),
          benefits: n("benefits"), benefitsInKind: n("benefits_in_kind"), benefitsFree: n("benefits_free"),
          pensionPct: pay.pensionPct, extraPensionPct: pay.extraPensionPct, unionFeePct: pay.unionFeePct,
          orlofPct: resolveOrlof(emp.orlof as never).pct,
          ytd: ytdFor(ytdRows, employeeId, r.period_start),
        } satisfies PayslipDetail,
      };
    }).sort((a, b) => b.d.from.localeCompare(a.d.from));
  } catch {
    return [];
  }
}
