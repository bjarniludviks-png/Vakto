"use server";

// Planið — read-only team schedule + coworkers directory for every role.
// Employees resolve their identity via employees.user_id (works even when the
// users row is missing); managers/owners via users.company_id.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { initials } from "@/lib/employees";

export type PlanShift = {
  id: string;
  date: string; // ISO
  start: string | null; // HH:MM
  end: string | null;
  hours: number;
  typeName: string | null;
  color: string;
  empId: string | null;
  empName: string | null;
  dept: string | null;
  mine: boolean;
  open: boolean;
};

export type Coworker = {
  id: string;
  name: string;
  av: string;
  color: string;
  title: string | null;
  dept: string | null;
  phone: string | null;
  email: string | null;
  photo: string | null;
};

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

function hoursOf(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  let h =
    parseInt(end.slice(0, 2), 10) + parseInt(end.slice(3, 5), 10) / 60 -
    parseInt(start.slice(0, 2), 10) - parseInt(start.slice(3, 5), 10) / 60;
  if (h < 0) h += 24;
  return Math.round(h * 10) / 10;
}

async function planCtx(supabase: Awaited<ReturnType<typeof createClient>>): Promise<
  { userId: string; company: string; empId: string | null } | { error: string }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" };
  const { data: emp } = await supabase
    .from("employees").select("id, company_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (emp) return { userId: user.id, company: emp.company_id as string, empId: emp.id as string };
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  if (profile?.company_id) return { userId: user.id, company: profile.company_id as string, empId: null };
  return { error: "Fyrirtæki fannst ekki" };
}

export async function getPlan(weekStartISO: string): Promise<{ live: boolean; shifts: PlanShift[] }> {
  if (!isSupabaseConfigured()) return { live: false, shifts: [] };
  try {
    const supabase = await createClient();
    const ctx = await planCtx(supabase);
    if ("error" in ctx) return { live: false, shifts: [] };
    const from = weekStartISO;
    const endD = new Date(weekStartISO + "T12:00:00");
    endD.setDate(endD.getDate() + 6);
    const to = endD.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("shifts")
      .select("id, date, start_time, end_time, employee_id, employees(full_name, avatar_color, departments(name, color)), shift_types(name, color)")
      .eq("company_id", ctx.company)
      .gte("date", from).lte("date", to)
      .order("date").order("start_time");

    const shifts: PlanShift[] = (data ?? []).map((s) => {
      const emp = (Array.isArray(s.employees) ? s.employees[0] : s.employees) as
        | { full_name?: string; avatar_color?: string; departments?: { name?: string; color?: string } | { name?: string; color?: string }[] }
        | null;
      const dep = emp?.departments ? (Array.isArray(emp.departments) ? emp.departments[0] : emp.departments) : null;
      const st = (Array.isArray(s.shift_types) ? s.shift_types[0] : s.shift_types) as { name?: string; color?: string } | null;
      const start = hm(s.start_time);
      const end = hm(s.end_time);
      return {
        id: s.id as string,
        date: s.date as string,
        start, end,
        hours: hoursOf(start, end),
        typeName: st?.name ?? null,
        color: st?.color ?? dep?.color ?? emp?.avatar_color ?? "#e9700f",
        empId: (s.employee_id as string) ?? null,
        empName: emp?.full_name ?? null,
        dept: dep?.name ?? null,
        mine: !!ctx.empId && s.employee_id === ctx.empId,
        open: !s.employee_id,
      };
    });
    return { live: true, shifts };
  } catch {
    return { live: false, shifts: [] };
  }
}

export async function getCoworkers(): Promise<{ live: boolean; people: Coworker[] }> {
  if (!isSupabaseConfigured()) return { live: false, people: [] };
  try {
    const supabase = await createClient();
    const ctx = await planCtx(supabase);
    if ("error" in ctx) return { live: false, people: [] };
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, title, phone, email, photo_url, avatar_color, positions(name), departments(name)")
      .eq("company_id", ctx.company)
      .eq("status", "active")
      .order("full_name");
    const people: Coworker[] = (data ?? []).map((e) => {
      const pos = (Array.isArray(e.positions) ? e.positions[0] : e.positions) as { name?: string } | null;
      const dep = (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } | null;
      return {
        id: e.id as string,
        name: e.full_name as string,
        av: initials(e.full_name as string),
        color: (e.avatar_color as string) ?? "#5b50e6",
        title: (e.title as string) ?? pos?.name ?? null,
        dept: dep?.name ?? null,
        phone: (e.phone as string) ?? null,
        email: (e.email as string) ?? null,
        photo: (e.photo_url as string) ?? null,
      };
    });
    return { live: true, people };
  } catch {
    return { live: false, people: [] };
  }
}
