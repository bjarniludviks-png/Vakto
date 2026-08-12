"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { templateToPayRule, type RuleSet as TplRuleSet } from "@/lib/rules";
import { getTimeBank } from "../skyrslur/timebank.server";
import { sendContractEmail } from "@/lib/email";
import type { CustomRules } from "@/lib/payrules";

export type NewEmployeeInput = {
  fullName: string;
  kennitala?: string;
  email?: string;
  phone?: string;
  bankAccount?: string;
  role: string; // label from the form
  position?: string;
  department?: string;
  location?: string;
  hireDate?: string;
  employmentRatio?: string;
  payType?: string; // "Tímakaup" | "Mánaðarlaun"
  rate?: string;
  union?: string;
  monthlyHours?: string;
  // universal fields (0028) — written tolerantly until the migration runs
  ruleTemplateId?: string;
  contractType?: string;
  schedulePattern?: string; // SchedulePattern.kind
};

export type ActionResult = { ok: boolean; demo?: boolean; error?: string; id?: string };

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
  if (!input.fullName?.trim()) return { ok: false, error: "Nafn vantar" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };

  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki — tengdu reikninginn." };
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
    if (error) return { ok: false, error: error.message };

    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.create", entity: "employee", detail: `Nýr starfsmaður — ${input.fullName.trim()}`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true, id: created?.id as string | undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type ImportRow = { fullName: string; kennitala?: string; email?: string; phone?: string; hireDate?: string; active?: boolean };
export type ImportResult = { ok: boolean; demo?: boolean; inserted?: number; skipped?: number; error?: string };

/** Bulk-import employees (e.g. from a Payday Excel export). Chunked for large teams. */
export async function importEmployees(rows: ImportRow[]): Promise<ImportResult> {
  const valid = rows.filter((r) => r.fullName?.trim());
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

    const toInsert = valid
      .filter((r) => { const k = r.kennitala?.replace(/\D/g, ""); return !k || !existing.has(k); })
      .map((r) => ({
        company_id: company,
        full_name: r.fullName.trim(),
        kennitala: r.kennitala?.trim() || null,
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        hire_date: r.hireDate || null,
        pay_type: "hourly" as const,
        rate: 2900,
        employment_ratio: 100,
        union_agreement: "Efling",
        role: "employee",
        status: r.active === false ? "inactive" : "active",
      }));

    const dupSkipped = valid.length - toInsert.length;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { error } = await supabase.from("employees").insert(chunk);
      if (error) return { ok: false, error: error.message, inserted };
      inserted += chunk.length;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.import", entity: "employee", detail: `Flutti inn ${inserted} starfsmenn úr skrá`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true, inserted, skipped: skipped + dupSkipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type UploadDocResult = { ok: boolean; demo?: boolean; path?: string; error?: string };

/** Upload an employee document (data URL) to the documents bucket + create a row. */
export async function uploadDocument(
  input: { employeeId: string; fileName: string; dataUrl: string; type?: string },
): Promise<UploadDocResult> {
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
    if (upErr) return { ok: false, error: upErr.message };

    const { error } = await supabase.from("documents").insert({
      company_id: company,
      employee_id: input.employeeId,
      name: input.fileName,
      type: input.type ?? null,
      url: path,
    });
    if (error) return { ok: false, error: error.message };

    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, company, user?.id ?? null, {
      action: "document.upload", entity: "document", detail: `Skjal hlaðið upp — ${input.fileName}`,
    });
    revalidatePath("/starfsfolk");
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
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
    if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? "Villa" };
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export type UpdateEmployeeInput = {
  rate?: string;
  employmentRatio?: string;
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
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (id.startsWith("e") && id.length <= 3) return { ok: true, demo: true }; // demo row id
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("employees").update({ status: active ? "active" : "inactive" }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    const { data: { user } } = await supabase.auth.getUser();
    const company = await companyId(supabase);
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.status", entity: "employee", entityId: id, detail: active ? "Starfsmaður virkjaður" : "Starfsmaður óvirkjaður",
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Permanently delete an employee and all their records (cascades). */
export async function deleteEmployee(id: string): Promise<ActionResult> {
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
    if (error) return { ok: false, error: error.message };
    const { data: { user } } = await supabase.auth.getUser();
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.delete", entity: "employee", entityId: id, detail: "Starfsmanni eytt",
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (id.startsWith("e") && id.length <= 3) return { ok: true, demo: true }; // demo row id
  try {
    const supabase = await createClient();
    const companyU = await companyId(supabase);
    if (!companyU) return { ok: false, error: "Fyrirtæki fannst ekki" };
    const patch: Record<string, unknown> = {};
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
      if (error) return { ok: false, error: error.message };
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
    if (!Object.keys(patch).length && input.payRule === undefined && input.permissions === undefined && input.benefits === undefined && input.orlof === undefined) return { ok: true };

    const { data: { user } } = await supabase.auth.getUser();
    const company = await companyId(supabase);
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.update", entity: "employee", entityId: id, detail: "Launasnið uppfært",
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
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
    return names.length ? names : DEMO_DEPARTMENTS;
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
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (employeeId.startsWith("e") && employeeId.length <= 3) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    // Best-effort — column exists only after migration 0025.
    const { error } = await supabase.from("employees").update({ oversees_departments: names }).eq("id", employeeId);
    if (error) return { ok: false, error: "Keyrðu migration 0025" };
    const { data: { user } } = await supabase.auth.getUser();
    const company = await companyId(supabase);
    if (company) await logAudit(supabase, company, user?.id ?? null, {
      action: "employee.update", entity: "employee", entityId: employeeId,
      detail: names.length ? `Umsjón deilda: ${names.join(", ")}` : "Umsjón deilda: allar",
    });
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
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
};

function contractMarkdown(e: Record<string, unknown>, c: Record<string, unknown>, extras: { unionName?: string; contractType?: string; locationName?: string }): string {
  const line = (k: string, v: unknown) => (v ? `**${k}:** ${v}\n\n` : "");
  // Official-form fields render even when empty (filled in by hand / later).
  const alw = (k: string, v: unknown) => `**${k}:** ${v || "____________"}\n\n`;
  const ctLabel: Record<string, string> = {
    fulltime: "Ótímabundið — fullt starf / Permanent, full-time",
    parttime: "Ótímabundið — hlutastarf / Permanent, part-time",
    temporary: "Tímabundið / Temporary",
    contractor: "Verktakasamningur / Contractor agreement",
    custom: "Annað / Other",
  };
  const orlof = e.orlof as { mode?: string; pct?: number } | null;
  const orlofTxt = orlof?.pct ? `${String(orlof.pct).replace(".", ",")}% ${orlof.mode === "pay_out" ? "greitt út með launum / paid out with wages" : "áunnið skv. kjarasamningi / accrued per agreement"}` : "Samkvæmt kjarasamningi / According to the collective agreement";
  const terms = (c.contract_terms as string | null)?.trim();
  return `# Ráðningarsamningur / Employment contract

## Vinnuveitandi / Employer
${alw("Fyrirtæki", c.name)}${alw("Kennitala", c.kennitala)}${alw("Heimilisfang", c.address)}${alw("Sími", c.phone)}${alw("Netfang", c.email)}
## Starfsmaður / Employee
${alw("Nafn", e.full_name)}${alw("Kennitala", e.kennitala)}${alw("Heimilisfang", (e as { address?: string }).address)}${alw("Netfang", e.email)}${alw("Sími", e.phone)}${line("Bankareikningur", e.bank_account)}
## Starfið / The role
${line("Starfsheiti", e.title)}${alw("Vinnustaður / heimilisfang", c.address ? `${c.name}, ${c.address}` : c.name)}${extras.locationName && extras.locationName !== c.name ? line("Starfsstöð (ef önnur)", extras.locationName) : ""}${line("Ráðningarform", extras.contractType ? (ctLabel[extras.contractType] ?? extras.contractType) : "Ótímabundið / Permanent")}${line("Ráðningardagur / fyrsti starfsdagur", e.hire_date)}${line("Starfshlutfall", e.employment_ratio ? `${e.employment_ratio}%` : "")}${line("Vinnustundir á mánuði (fullt starf)", e.monthly_hours ? String(e.monthly_hours).replace(".", ",") : "173,33")}
## Laun og kjör / Wages and terms
${line("Launafyrirkomulag", e.pay_type === "monthly" ? "Mánaðarlaun / Monthly salary" : "Tímakaup / Hourly wages")}${line(e.pay_type === "monthly" ? "Grunnlaun á mánuði" : "Tímakaup (grunntaxti)", e.rate ? `${e.rate} kr` : "")}${line("Orlof", orlofTxt)}${line("Greiðsla launa", "Mánaðarlega, inn á bankareikning starfsmanns / Monthly, into the employee's bank account")}
## Lífeyrissjóður og stéttarfélag / Pension fund and union
${line("Lífeyrissjóður", (e.pension_fund as string) || "Skv. vali starfsmanns eða kjarasamningi / Per the employee's choice or agreement")}${line("Stéttarfélag / kjarasamningur", extras.unionName)}
## Uppsagnarfrestur, orlof og veikindi / Notice period, holiday and sick pay
Fer eftir gildandi kjarasamningi og lögum á starfsstað, þ.m.t. áunnin réttindi miðað við starfsaldur. / According to the applicable collective agreement and local law, including earned rights based on tenure.
${terms ? `\n## Sérákvæði fyrirtækisins / Company provisions\n${terms}\n` : ""}
## Annað / Other
Um starfið gilda að öðru leyti þær vinnureglur sem fyrirtækið hefur skilgreint í VAKTO
(yfirvinna, álög, hvíldartími, orlof og veikindaréttur skv. völdu reglusniðmáti) og
gildandi lög á starfsstað. / The role is otherwise governed by the working rules the
company has defined in VAKTO and applicable local law.

_Undirritun / Signatures:_

Vinnuveitandi: ______________________　Dags: ________

Starfsmaður: ______________________　Dags: ________
`;
}

/** Generate a contract draft from employee + company data. */
export async function generateContract(employeeId: string): Promise<ActionResult & { content?: string }> {
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
    let locationName: string | undefined;
    if (emp.location_id) {
      const { data: loc } = await supabase.from("locations").select("name").eq("id", emp.location_id).maybeSingle();
      locationName = (loc?.name as string) ?? undefined;
    }
    const content = contractMarkdown(emp, comp ?? {}, {
      unionName: (emp.union_name as string) || (emp.union_agreement as string) || undefined,
      contractType: (emp.contract_type as string) || undefined,
      locationName,
    });
    const { data: { user } } = await supabase.auth.getUser();
    const { data: created, error } = await supabase.from("contracts").insert({
      company_id: company,
      employee_id: employeeId,
      template: "universal-v1",
      title: `Ráðningarsamningur — ${emp.full_name}`,
      content,
      status: "draft",
      created_by: user?.id ?? null,
    }).select("id").maybeSingle();
    if (error) return { ok: false, error: /contracts/.test(error.message) ? "Keyrðu migration 0028 í Supabase fyrst." : error.message, content };
    await logAudit(supabase, company, user?.id ?? null, { action: "contract.create", entity: "contracts", detail: `Samningur búinn til — ${emp.full_name}` });
    revalidatePath("/starfsfolk");
    return { ok: true, id: created?.id as string | undefined, content };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function listContracts(employeeId: string): Promise<{ contracts: ContractRow[]; live: boolean }> {
  if (!isSupabaseConfigured()) return { contracts: [], live: false };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("contracts")
      .select("id, title, template, status, content, created_at, signed_at")
      .eq("employee_id", employeeId).order("created_at", { ascending: false });
    if (error) return { contracts: [], live: false };
    return {
      live: true,
      contracts: (data ?? []).map((r) => ({
        id: r.id as string, title: r.title as string, template: r.template as string | null,
        status: r.status as ContractRow["status"], content: r.content as string,
        created: String(r.created_at).slice(0, 10), signed_at: r.signed_at ? String(r.signed_at).slice(0, 10) : null,
      })),
    };
  } catch {
    return { contracts: [], live: false };
  }
}

/** Save edited draft content — review-before-send flow. Drafts only. */
export async function updateContractContent(id: string, content: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const { data: c } = await supabase.from("contracts").select("status").eq("id", id).maybeSingle();
    if (!c) return { ok: false, error: "Samningur fannst ekki" };
    if (c.status !== "draft") return { ok: false, error: "Aðeins er hægt að breyta drögum — gerðu nýjan samning." };
    const { error } = await supabase.from("contracts").update({ content }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function deleteContract(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const { data: c } = await supabase.from("contracts").select("company_id, title, status").eq("id", id).maybeSingle();
    if (!c) return { ok: false, error: "Samningur fannst ekki" };
    if (c.status === "signed") return { ok: false, error: "Undirritaðum samningi verður ekki eytt — merktu hann ógildan (void) og gerðu nýjan." };
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    const { data: { user } } = await supabase.auth.getUser();
    await logAudit(supabase, c.company_id as string, user?.id ?? null, {
      action: "contract.delete", entity: "contracts", entityId: id, detail: `Samningi eytt — ${c.title}`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

export async function setContractStatus(id: string, status: "draft" | "sent" | "signed" | "void"): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "signed") patch.signed_at = new Date().toISOString();
    const { data: row, error } = await supabase.from("contracts").update(patch).eq("id", id)
      .select("employee_id, employees(full_name, email), companies(name)").maybeSingle();
    if (error) return { ok: false, error: error.message };
    // "Sent" → tell the employee a contract awaits their signature (best-effort).
    if (status === "sent" && row) {
      const emp = (Array.isArray(row.employees) ? row.employees[0] : row.employees) as { full_name?: string; email?: string } | null;
      const co = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as { name?: string } | null;
      if (emp?.email) void sendContractEmail(emp.email, emp.full_name ?? "", co?.name ?? "Fyrirtækið þitt");
    }
    revalidatePath("/starfsfolk");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}

/** Employee ids that have NO signed contract (for the missing-contracts chip). */
export async function getContractStatusMap(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return {};
    const { data, error } = await supabase.from("contracts")
      .select("employee_id, status").eq("company_id", company);
    if (error) return {};
    const map: Record<string, string> = {};
    for (const r of data ?? []) {
      const cur = map[r.employee_id as string];
      // signed wins over sent wins over draft
      const rank: Record<string, number> = { signed: 3, sent: 2, draft: 1, void: 0 };
      if (!cur || (rank[r.status as string] ?? 0) > (rank[cur] ?? 0)) map[r.employee_id as string] = r.status as string;
    }
    return map;
  } catch {
    return {};
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
