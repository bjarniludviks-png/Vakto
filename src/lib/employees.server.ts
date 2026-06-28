import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_EMPLOYEES, type Employee } from "@/lib/employees";

type Row = {
  id: string;
  full_name: string;
  title: string | null;
  pay_type: "hourly" | "monthly";
  rate: number;
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

/** Fetch employees from Supabase; fall back to demo data if not connected. */
export async function getEmployees(): Promise<{ employees: Employee[]; live: boolean }> {
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
        "id, full_name, title, pay_type, rate, employment_ratio, union_agreement, status, avatar_color, email, kennitala, phone, bank_account, role, departments(name), positions(name), locations(name)",
      )
      .order("full_name");

    if (error) {
      return { employees: DEMO_EMPLOYEES, live: false };
    }

    const rows = (data ?? []) as unknown as Row[];
    const employees: Employee[] = rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      title: r.title,
      department: r.departments?.name ?? null,
      position: r.positions?.name ?? null,
      location: r.locations?.name ?? null,
      payType: r.pay_type,
      rate: Number(r.rate),
      employmentRatio: Number(r.employment_ratio),
      union: r.union_agreement,
      status: r.status,
      avatarColor: r.avatar_color ?? "#5b50e6",
      email: r.email,
      kennitala: r.kennitala,
      phone: r.phone,
      bankAccount: r.bank_account,
      role: r.role,
    }));
    return { employees, live: true };
  } catch {
    return { employees: DEMO_EMPLOYEES, live: false };
  }
}
