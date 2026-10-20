"use server";

// Lesaðgangur fyrrverandi starfsmanns (0088): aðeins eigin skjöl og samningar, með lotu notandans
// (RLS + Storage-reglur ráða — ekkert gegnum þjónustulykil).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SignatureRecord } from "@/lib/contract-pdf";

async function myEmployeeId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; empId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: e } = await supabase.from("employees").select("id").eq("user_id", user.id).maybeSingle();
  return e ? { supabase, empId: e.id as string } : null;
}

export async function openMyDocument(id: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  try {
    const me = await myEmployeeId();
    if (!me) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: d } = await me.supabase.from("documents").select("url, employee_id").eq("id", id).maybeSingle();
    if (!d?.url || (d.employee_id && d.employee_id !== me.empId)) return { ok: false, error: "Skjal fannst ekki" };
    const { data, error } = await me.supabase.storage.from("documents").createSignedUrl(d.url as string, 120);
    if (error || !data?.signedUrl) return { ok: false, error: "Tókst ekki að opna skjalið" };
    return { ok: true, url: data.signedUrl };
  } catch {
    return { ok: false, error: "Tókst ekki að opna skjalið" };
  }
}

export async function myContractSignatures(id: string): Promise<SignatureRecord[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const me = await myEmployeeId();
    if (!me) return [];
    const { data, error } = await me.supabase.from("contract_signatures")
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
