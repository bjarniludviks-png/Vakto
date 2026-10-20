import "@/styles/app.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LangProvider } from "@/components/app/lang";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyAccess } from "@/lib/terminations.server";
import ReadonlyScreen, { type RoDoc, type RoContract } from "./readonly-screen";

export const metadata: Metadata = { title: "Starfslok · VAKTO", robots: { index: false } };

// Fyrrverandi starfsmaður á lesaðgangstíma (0088): eigin launaseðlar, samningar og skjöl — ekkert annað.
// Middleware beinir öllum öðrum slóðum hingað; RLS tryggir það sama í grunninum.
export default async function StarfslokPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const access = await getMyAccess();
  if (access.state === "active") redirect("/mitt-svaedi");
  if (access.state === "closed") redirect("/login?error=lokad");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: emp } = await supabase.from("employees").select("id, full_name, company_id, companies(name)").eq("user_id", user.id).maybeSingle();
  const company = ((Array.isArray(emp?.companies) ? emp?.companies[0] : emp?.companies) as { name?: string } | null)?.name ?? "";
  const [docsRes, conRes] = emp ? await Promise.all([
    supabase.from("documents").select("id, name, type, created_at").eq("employee_id", emp.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("contracts").select("id, title, content, status, signed_via, signed_at, created_at").eq("employee_id", emp.id).in("status", ["sent", "signed"]).order("created_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  const docs: RoDoc[] = (docsRes.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, type: (d.type as string | null) ?? null, created: String(d.created_at).slice(0, 10) }));
  const contracts: RoContract[] = (conRes.data ?? []).map((c) => ({
    id: c.id as string, title: c.title as string, content: c.content as string, status: c.status as string,
    signedVia: (c.signed_via as string | null) ?? null, date: String(c.signed_at ?? c.created_at).slice(0, 10),
  }));
  return (
    <LangProvider>
      <ReadonlyScreen name={(emp?.full_name as string) ?? user.email ?? ""} company={company} lastDay={access.lastDay} accessUntil={access.accessUntil} docs={docs} contracts={contracts} />
    </LangProvider>
  );
}
