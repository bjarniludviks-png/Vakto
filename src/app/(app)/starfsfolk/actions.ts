"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
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
  if (table === "departments") {
    const { data } = await supabase
      .from("departments")
      .select("id, locations!inner(company_id)")
      .eq("name", name)
      .eq("locations.company_id", company)
      .maybeSingle();
    return (data?.id as string) ?? null;
  }
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("name", name)
    .eq("company_id", company)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function createEmployee(input: NewEmployeeInput): Promise<ActionResult> {
  if (!input.fullName?.trim()) return { ok: false, error: "Nafn vantar" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };

  try {
    const supabase = await createClient();
    const company = await companyId(supabase);
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki — tengdu reikninginn." };

    const [department_id, position_id, location_id] = await Promise.all([
      lookupId(supabase, "departments", input.department, company),
      lookupId(supabase, "positions", input.position, company),
      lookupId(supabase, "locations", input.location, company),
    ]);

    const { data: created, error } = await supabase.from("employees").insert({
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
      union_agreement: input.union || "Efling",
      monthly_hours: input.monthlyHours ? num(input.monthlyHours, 0) || null : null,
      hire_date: input.hireDate || null,
      status: "active",
    }).select("id").maybeSingle();
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
  payRule?: CustomRules | null;
  permissions?: Record<string, boolean> | null;
  benefits?: { name: string; type: string; amount: number }[] | null;
  orlof?: { mode: string; pct: number } | null;
};

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
    const patch: Record<string, unknown> = {};
    if (input.rate) patch.rate = num(input.rate, 2900);
    if (input.employmentRatio) patch.employment_ratio = num(input.employmentRatio, 100);
    if (input.union) patch.union_agreement = input.union;
    if (input.payType) patch.pay_type = input.payType === "Mánaðarlaun" ? "monthly" : "hourly";

    if (Object.keys(patch).length) {
      const { error } = await supabase.from("employees").update(patch).eq("id", id);
      if (error) return { ok: false, error: error.message };
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
