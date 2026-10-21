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

/** Samningar og bréf (ráðningar-/verksamningur, starfslokabréf) sem send hafa verið á mig. */
export type Contract = {
  id: string;
  title: string;
  content: string;
  status: string;
  signedAt: string | null;
  signedVia: string | null;
  /** Bíður MÍN: sendur og (við Taktikal) vinnuveitandinn búinn að skrifa undir. */
  awaitingMe: boolean;
};

const COLS = "id, title, content, status, signed_at, signed_via, employer_signed_at";
type Raw = { id: string; title: string; content: string; status: string; signed_at: string | null; signed_via: string | null; employer_signed_at: string | null };
const toContract = (c: Raw): Contract => ({
  id: c.id, title: c.title, content: c.content, status: c.status, signedAt: c.signed_at, signedVia: c.signed_via ?? null,
  awaitingMe: c.status === "sent" && (c.signed_via !== "taktikal" || !!c.employer_signed_at),
});

/** Allir mínir samningar (sendir + undirritaðir), nýjasti fyrst. */
export async function listMyContracts(me: Me): Promise<Contract[]> {
  const { data } = await supabase
    .from("contracts")
    .select(COLS)
    .eq("employee_id", me.empId)
    .in("status", ["sent", "signed"])
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Raw[]).map(toContract);
}

/** Einn samningur (RLS: aðeins minn). */
export async function getContract(me: Me, id: string): Promise<Contract | null> {
  const { data } = await supabase
    .from("contracts")
    .select(COLS)
    .eq("id", id)
    .eq("employee_id", me.empId)
    .in("status", ["sent", "signed"])
    .maybeSingle();
  return data ? toContract(data as Raw) : null;
}

/** Fjöldi samninga sem bíða minnar undirritunar (merki á „Samningar“ í Ég). */
export async function countAwaitingContracts(me: Me): Promise<number> {
  const { data } = await supabase
    .from("contracts")
    .select("status, signed_via, employer_signed_at")
    .eq("employee_id", me.empId)
    .eq("status", "sent");
  return (data ?? []).filter((c) => c.signed_via !== "taktikal" || !!c.employer_signed_at).length;
}

// Rafræn undirritun (0058) fer um vefþjóninn: kóði á netfang → staðfesting →
// undirritunarskrá + PDF til beggja aðila. Sama flæði og á vefnum.
const API = (process.env.EXPO_PUBLIC_API_URL ?? "https://www.vakto.is").replace(/\/$/, "");

async function contractCall(body: Record<string, string>): Promise<{ ok: boolean; sentTo?: string; url?: string; waiting?: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "Ekki innskráð(ur)" };
    const r = await fetch(`${API}/api/app/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return (await r.json()) as { ok: boolean; sentTo?: string; url?: string; waiting?: boolean; error?: string };
  } catch {
    return { ok: false, error: "Engin tenging — reyndu aftur" };
  }
}

export const requestContractCode = (id: string) => contractCall({ action: "code", id });
export const signContract = (id: string, code: string) => contractCall({ action: "sign", id, code });
/** Taktikal (rafræn skilríki): undirritunartengill þegar vinnuveitandi hefur skrifað undir. */
export const taktikalLink = (id: string) => contractCall({ action: "taktikal", id });
