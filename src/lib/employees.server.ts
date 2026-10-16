import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_EMPLOYEES, type Employee } from "@/lib/employees";
import type { PaySettings } from "@/lib/paysettings";
import type { OrlofSet } from "@/lib/payrules";
import { colorFor } from "@/lib/avatar";

type Row = {
  id: string;
  full_name: string;
  user_id?: string | null;
  title: string | null;
  pay_type: "hourly" | "monthly";
  rate: number;
  monthly_hours: number | null;
  employment_ratio: number;
  union_agreement: string | null;
  status: string;
  avatar_color: string | null;
  email: string | null;
  kennitala: string | null;
  phone: string | null;
  bank_account: string | null;
  role: string;
  departments: { name: string } | null;
  positions: { name: string } | null;
  locations: { name: string } | null;
};

/** Is this a signed-in but empty (new) company? Demo mode → not empty. */
export async function getCompanyData(): Promise<{ empty: boolean; live: boolean; count: number }> {
  const { employees, live } = await getEmployees();
  return { empty: live && employees.length === 0, live, count: employees.length };
}

/** Fetch employees from Supabase; fall back to demo data if not connected.
 * Wrapped in React cache() so repeated calls within one request are deduped. */
export const getEmployees = cache(async (): Promise<{ employees: Employee[]; live: boolean }> => {
  if (!isSupabaseConfigured()) return { employees: DEMO_EMPLOYEES, live: false };
  try {
    const supabase = await createClient();
    // Demo only before sign-in. Once authenticated, show that company's real
    // data — even if empty (a newly created company starts with no employees).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { employees: DEMO_EMPLOYEES, live: false };

    const { data, error } = await supabase
      .from("employees")
      .select(
        "id, full_name, title, pay_type, rate, monthly_hours, employment_ratio, union_agreement, status, avatar_color, email, kennitala, phone, bank_account, role, user_id, departments(name), positions(name), locations(name)",
      )
      .order("full_name");

    if (error) {
      return { employees: DEMO_EMPLOYEES, live: false };
    }

    const rows = (data ?? []) as unknown as Row[];
    // Heimilisfang + aðstandandi (0059) — sér fyrirspurn svo listinn virki þótt migration vanti.
    type Extra = { address: string | null; next_of_kin: string | null; postal_code?: string | null; city?: string | null; hire_date?: string | null };
    let ex = await supabase.from("employees").select("id, address, next_of_kin, postal_code, city, hire_date");
    if (ex.error) ex = await supabase.from("employees").select("id, address, next_of_kin, hire_date") as typeof ex; // fyrir 0060
    const extra = new Map((ex.error ? [] : ex.data ?? []).map((x) => [x.id as string, x as Extra]));
    // Launaliðir (0081) + orlof (0021): sér fyrirspurn svo listinn virki þótt migration vanti.
    const paq = await supabase.from("employees").select("id, pay_settings, orlof, benefits");
    const payOf = new Map((paq.error ? [] : paq.data ?? []).map((x) => [x.id as string, x as { pay_settings: Partial<PaySettings> | null; orlof: Partial<OrlofSet> | null; benefits: Employee["benefits"] }]));
    let coDefaults: Partial<PaySettings> | null = null;
    if (!paq.error) {
      const { data: me } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
      if (me?.company_id) {
        const cd = await supabase.from("companies").select("pay_defaults").eq("id", me.company_id).maybeSingle();
        coDefaults = (cd.data as { pay_defaults?: Partial<PaySettings> | null } | null)?.pay_defaults ?? null;
      }
    }
    const employees: Employee[] = rows.map((r) => ({
      pay: { ...(coDefaults ?? {}), ...(payOf.get(r.id)?.pay_settings ?? {}) },
      orlof: payOf.get(r.id)?.orlof ?? (coDefaults as { orlof?: Partial<OrlofSet> } | null)?.orlof ?? null,
      benefits: payOf.get(r.id)?.benefits ?? null,
      address: extra.get(r.id)?.address ?? null,
      nextOfKin: extra.get(r.id)?.next_of_kin ?? null,
      postalCode: extra.get(r.id)?.postal_code ?? null,
      city: extra.get(r.id)?.city ?? null,
      hireDate: extra.get(r.id)?.hire_date ?? null,
      id: r.id,
      fullName: r.full_name,
      title: r.title,
      department: r.departments?.name ?? null,
      position: r.positions?.name ?? null,
      location: r.locations?.name ?? null,
      payType: r.pay_type,
      rate: Number(r.rate),
      monthlyHours: r.monthly_hours != null ? Number(r.monthly_hours) : null,
      employmentRatio: Number(r.employment_ratio),
      union: r.union_agreement,
      status: r.status,
      avatarColor: r.avatar_color ?? colorFor(r.id),
      email: r.email,
      kennitala: r.kennitala,
      phone: r.phone,
      bankAccount: r.bank_account,
      role: r.role,
      hasAccount: !!r.user_id,
    }));
    return { employees, live: true };
  } catch {
    return { employees: DEMO_EMPLOYEES, live: false };
  }
});
