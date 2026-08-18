// Skjalasafn — company-shared docs (employee_id IS NULL) + my own documents.
// Reading files from the private `documents` bucket requires migration 0041
// (employee SELECT on shared/ + own folder), then createSignedUrl works
// with the user session.
import { supabase } from "../supabase";
import type { Me } from "./me";

export type DocRow = {
  id: string;
  name: string;
  type: string | null;
  path: string;
  created: string;
  shared: boolean;
};

export async function listDocs(me: Me): Promise<DocRow[]> {
  const { data } = await supabase
    .from("documents")
    .select("id, name, type, url, created_at, employee_id")
    .eq("company_id", me.companyId)
    .or(`employee_id.is.null,employee_id.eq.${me.empId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    path: d.url,
    created: (d.created_at ?? "").slice(0, 10),
    shared: !d.employee_id,
  }));
}

export async function signedUrl(path: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 120);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Tókst ekki að opna skjal" };
  }
  return { ok: true, url: data.signedUrl };
}

/** My employment contract (sent or signed), like getMyContract on the web. */
export type Contract = {
  id: string;
  title: string;
  content: string;
  status: string;
  signedAt: string | null;
};

export async function getMyContract(me: Me): Promise<Contract | null> {
  const { data } = await supabase
    .from("contracts")
    .select("id, title, content, status, signed_at")
    .eq("employee_id", me.empId)
    .in("status", ["sent", "signed"])
    .order("created_at", { ascending: false })
    .limit(1);
  const c = data?.[0];
  return c
    ? { id: c.id, title: c.title, content: c.content, status: c.status, signedAt: c.signed_at }
    : null;
}
