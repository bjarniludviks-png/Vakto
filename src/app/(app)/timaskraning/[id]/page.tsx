import EmployeeTimesheet from "./timesheet-screen";
import { getEmployeePunches } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function EmployeeTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const data = await getEmployeePunches(id, from, to);
  let company = "";
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: emp } = await supabase.from("employees").select("companies(name)").eq("id", id).maybeSingle();
      const co = (Array.isArray(emp?.companies) ? emp?.companies[0] : emp?.companies) as { name?: string } | null | undefined;
      company = co?.name ?? "";
    } catch { /* nafnið er aðeins fyrir PDF */ }
  }
  return <EmployeeTimesheet id={id} name={data.name} company={company} initial={data.rows} initialMissed={data.missed} needsMigration={data.needsMigration} from={from} to={to} />;
}
