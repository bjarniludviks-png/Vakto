"use server";

import { demoBlocked, demoResult } from "@/lib/demo.server";
// Vinnuyfirlit (0084): stjórnandi býr til → sendir → starfsmaður staðfestir/gerir athugasemd →
// stjórnandi staðfestir (final: PDF með fingrafari í skjalasafn starfsmanns).
// Allt fer um innskráðan notanda (RLS); svar starfsmanns eingöngu um respond_work_overview().

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { buildSnapshots, toRow, missingTable, WO_COLS } from "@/lib/work-overview.server";
import { fingerprintSource, type WoRow, type WoLogEntry, type WoSnapshot } from "@/lib/work-overview";
import { buildWorkOverviewPdf, workOverviewFileName } from "@/lib/doc-pdf";
import { getEmployees } from "@/lib/employees.server";
import { getMyScope, scopeRows } from "@/lib/scope.server";
import { notifyEmployee, notifyManagers } from "@/lib/push";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";

type Db = Awaited<ReturnType<typeof createClient>>;
const okDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

async function ctx(supabase: Db) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("users").select("company_id, role, full_name, email").eq("id", user.id).maybeSingle();
  if (!u?.company_id) return null;
  return { userId: user.id, company: u.company_id as string, manager: u.role === "owner" || u.role === "manager", name: (u.full_name as string) || (u.email as string) || "Stjórnandi" };
}
const entry = (c: { userId: string; name: string }, action: string, note?: string | null): WoLogEntry => ({ at: new Date().toISOString(), by: c.userId, name: c.name, action, note: note ?? null });

export type WoList = {
  ok: boolean; missing?: boolean; error?: string;
  rows: WoRow[];
  /** Starfsmenn sem eiga ekkert yfirlit fyrir tímabilið. */
  without: { id: string; name: string; dept: string | null }[];
};

/** Yfirlit tímabilsins (stjórnandi). missing=true ef 0084 hefur ekki verið keyrð. */
export async function listWorkOverviews(from: string, to: string): Promise<WoList> {
  const empty: WoList = { ok: true, rows: [], without: [] };
  if (!isSupabaseConfigured() || !okDate(from) || !okDate(to)) return empty;
  try {
    const supabase = await createClient();
    const c = await ctx(supabase);
    if (!c || !c.manager) return { ...empty, ok: false, error: "Aðeins stjórnendur" };
    const { data, error } = await supabase.from("work_overviews").select(WO_COLS)
      .eq("company_id", c.company).eq("period_start", from).eq("period_end", to);
    if (error) return missingTable(error) ? { ...empty, missing: true } : { ...empty, ok: false, error: userError(error) };
    // Vaktstjóri með afmarkaðar deildir sér aðeins sitt fólk (eins og Tímaskráning).
    const { departments } = await getMyScope();
    const rows = scopeRows(departments, (data ?? []).map((r) => toRow(r as never))).sort((a, b) => a.name.localeCompare(b.name, "is"));
    const have = new Set((data ?? []).map((r) => r.employee_id as string));
    const { employees } = await getEmployees();
    const without = scopeRows(departments, employees
      .filter((e) => e.role !== "contractor" && e.status !== "inactive" && !have.has(e.id))
      .map((e) => ({ id: e.id, name: e.fullName, dept: e.department })));
    return { ok: true, rows, without };
  } catch (e) {
    return { ...empty, ok: false, error: userError(e) };
  }
}

export type WoResult = { ok: boolean; error?: string; count?: number; skipped?: number };

/** Býr til (eða endurreiknar) yfirlit fyrir alla — eða aðeins `onlyIds`. Snertir ekki yfirlit
 * sem starfsmaður hefur staðfest eða sem er lokið; endurreiknuð yfirlit fara aftur í drög. */
export async function generateWorkOverviews(from: string, to: string, onlyIds?: string[]): Promise<WoResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "Ekki tengt" };
  if (!okDate(from) || !okDate(to) || to < from) return { ok: false, error: "Ógilt tímabil" };
  try {
    const supabase = await createClient();
    const c = await ctx(supabase);
    if (!c || !c.manager) return { ok: false, error: "Aðeins stjórnendur geta búið til vinnuyfirlit" };
    const { data: existing, error } = await supabase.from("work_overviews").select("id, employee_id, status, log")
      .eq("company_id", c.company).eq("period_start", from).eq("period_end", to);
    if (error) return { ok: false, error: missingTable(error) ? "Vinnuyfirlit eru ekki virk enn (gagnagrunnsuppfærsla 0084)" : userError(error) };
    const byEmp = new Map((existing ?? []).map((r) => [r.employee_id as string, r]));
    const snaps = await buildSnapshots(supabase, c.company, from, to, onlyIds);
    let count = 0, skipped = 0;
    const inserts: Record<string, unknown>[] = [];
    for (const s of snaps) {
      const ex = byEmp.get(s.employee.id);
      if (!ex) {
        inserts.push({ company_id: c.company, employee_id: s.employee.id, period_start: from, period_end: to, snapshot: s, status: "draft", created_by: c.userId, log: [entry(c, "created")] });
        continue;
      }
      if (!["draft", "sent", "employee_flagged"].includes(ex.status as string) || (ex.status === "sent" && !onlyIds)) { skipped++; continue; }
      const log = [...((ex.log as WoLogEntry[] | null) ?? []), entry(c, "regenerated")];
      const { error: upErr } = await supabase.from("work_overviews").update({
        snapshot: s, status: "draft", employee_comment: null, employee_approved_at: null, employee_flagged_at: null, sent_at: null, sent_by: null, log,
      }).eq("id", ex.id as string);
      if (upErr) return { ok: false, error: userError(upErr) };
      count++;
    }
    if (inserts.length) {
      const { error: insErr } = await supabase.from("work_overviews").insert(inserts);
      if (insErr) return { ok: false, error: userError(insErr) };
      count += inserts.length;
    }
    await logAudit(supabase, c.company, c.userId, { action: "work_overview.generate", entity: "work_overview", detail: `Vinnuyfirlit ${from}–${to}: ${count} búin til/endurreiknuð` });
    revalidatePath("/timaskraning/vinnuyfirlit");
    return { ok: true, count, skipped };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

/** Sendir drög til staðfestingar (push á hvern starfsmann). */
export async function sendWorkOverviews(ids: string[]): Promise<WoResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured() || !ids.length) return { ok: true, count: 0 };
  try {
    const supabase = await createClient();
    const c = await ctx(supabase);
    if (!c || !c.manager) return { ok: false, error: "Aðeins stjórnendur" };
    const { data, error } = await supabase.from("work_overviews").select("id, employee_id, status, log, period_start, period_end")
      .eq("company_id", c.company).in("id", ids.slice(0, 500)).eq("status", "draft");
    if (error) return { ok: false, error: userError(error) };
    const now = new Date().toISOString();
    let count = 0;
    for (const r of data ?? []) {
      const log = [...((r.log as WoLogEntry[] | null) ?? []), entry(c, "sent")];
      const { error: upErr } = await supabase.from("work_overviews").update({ status: "sent", sent_at: now, sent_by: c.userId, log }).eq("id", r.id as string).eq("status", "draft");
      if (upErr) return { ok: false, error: userError(upErr), count };
      count++;
      void notifyEmployee(r.employee_id as string, { title: "Vinnuyfirlit til staðfestingar", body: "Farðu yfir tímana þína og staðfestu yfirlitið eða gerðu athugasemd.", url: "/mitt-svaedi", tag: "work-overview" });
    }
    await logAudit(supabase, c.company, c.userId, { action: "work_overview.send", entity: "work_overview", detail: `${count} vinnuyfirlit send til staðfestingar` });
    revalidatePath("/timaskraning/vinnuyfirlit");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

/** Stjórnandi staðfestir: PDF með fingrafari og staðfestingarskrá → skjalasafn starfsmanns.
 * Ef starfsmaður gerði athugasemd þarf svar stjórnanda (note). */
export async function finalizeWorkOverview(id: string, note?: string): Promise<WoResult & { documentId?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "Ekki tengt" };
  try {
    const supabase = await createClient();
    const c = await ctx(supabase);
    if (!c || !c.manager) return { ok: false, error: "Aðeins stjórnendur" };
    const { data: r, error } = await supabase.from("work_overviews").select(WO_COLS + ", company_id").eq("id", id).eq("company_id", c.company).maybeSingle();
    if (error || !r) return { ok: false, error: error ? userError(error) : "Yfirlit fannst ekki" };
    const row = toRow(r as never);
    const reply = (note ?? "").trim().slice(0, 2000) || null;
    if (row.status === "employee_flagged" && !reply) return { ok: false, error: "Skrifaðu svar við athugasemd starfsmannsins" };
    if (row.status !== "employee_approved" && row.status !== "employee_flagged") return { ok: false, error: "Starfsmaðurinn hefur ekki svarað yfirlitinu" };

    const log = [...row.log, entry(c, "final", reply)];
    const fingerprint = createHash("sha256").update(fingerprintSource(row.snapshot, log), "utf8").digest("hex");
    const doc = await buildWorkOverviewPdf(row.snapshot as WoSnapshot, log, fingerprint);
    const bytes = Buffer.from(doc.output("arraybuffer"));
    const file = workOverviewFileName(row.snapshot);
    const path = `${c.company}/${row.employeeId}/${Date.now()}-${file}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return { ok: false, error: userError(upErr) };
    const { data: d, error: docErr } = await supabase.from("documents").insert({
      company_id: c.company, employee_id: row.employeeId, name: `Vinnuyfirlit ${row.from} – ${row.to}.pdf`, type: "Vinnuyfirlit", url: path,
    }).select("id").single();
    if (docErr || !d) return { ok: false, error: userError(docErr) };

    const { error: finErr } = await supabase.from("work_overviews").update({
      status: "final", final_at: new Date().toISOString(), manager_id: c.userId, manager_comment: reply,
      document_id: d.id, fingerprint, log,
    }).eq("id", id).in("status", ["employee_approved", "employee_flagged"]);
    if (finErr) return { ok: false, error: userError(finErr) };

    await logAudit(supabase, c.company, c.userId, { action: "work_overview.final", entity: "work_overview", entityId: id, detail: `Vinnuyfirlit staðfest — ${row.name} (${row.from}–${row.to}) · SHA-256 ${fingerprint.slice(0, 12)}…` });
    void notifyEmployee(row.employeeId, { title: "Vinnuyfirlit staðfest", body: "Yfirlitið er staðfest og komið í skjölin þín.", url: "/mitt-svaedi", tag: "work-overview" });
    revalidatePath("/timaskraning/vinnuyfirlit");
    return { ok: true, documentId: d.id as string };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

/** Tímabundinn tengill á PDF lokaðs yfirlits (stjórnandi eða starfsmaðurinn sjálfur, RLS). */
export async function workOverviewPdfUrl(id: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Ekki tengt" };
  try {
    const supabase = await createClient();
    const { data: w } = await supabase.from("work_overviews").select("document_id").eq("id", id).maybeSingle();
    if (!w?.document_id) return { ok: false, error: "PDF er ekki til enn" };
    const { data: d } = await supabase.from("documents").select("url").eq("id", w.document_id as string).maybeSingle();
    if (!d?.url) return { ok: false, error: "Skjal fannst ekki" };
    const { data: s, error } = await supabase.storage.from("documents").createSignedUrl(d.url as string, 120);
    if (error || !s?.signedUrl) return { ok: false, error: userError(error) };
    return { ok: true, url: s.signedUrl };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

// ---------- starfsmaður ----------

/** Mín yfirlit (ekki drög), nýjast fyrst. missing=true ef 0084 vantar. */
export async function getMyWorkOverviews(): Promise<{ ok: boolean; missing?: boolean; rows: WoRow[] }> {
  if (!isSupabaseConfigured()) return { ok: true, rows: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: true, rows: [] };
    const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user.id).maybeSingle();
    if (!emp) return { ok: true, rows: [] };
    const { data, error } = await supabase.from("work_overviews").select(WO_COLS)
      .eq("employee_id", emp.id as string).neq("status", "draft").order("period_start", { ascending: false }).limit(12);
    if (error) return { ok: !missingTable(error), missing: missingTable(error), rows: [] };
    return { ok: true, rows: (data ?? []).map((r) => toRow(r as never)) };
  } catch {
    return { ok: false, rows: [] };
  }
}

/** Starfsmaður staðfestir (approve) eða gerir athugasemd (comment áskilin). */
export async function respondToWorkOverview(id: string, approve: boolean, comment?: string): Promise<WoResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: false, error: "Ekki tengt" };
  const note = (comment ?? "").trim();
  if (!approve && !note) return { ok: false, error: "Skrifaðu athugasemdina" };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("respond_work_overview", { p_id: id, p_approve: approve, p_comment: note || null });
    if (error) {
      if (/NOT_PENDING/.test(error.message)) return { ok: false, error: "Yfirlitið bíður ekki staðfestingar" };
      return { ok: false, error: userError(error) };
    }
    const { data: w } = await supabase.from("work_overviews").select("company_id").eq("id", id).maybeSingle();
    void notifyManagers(w?.company_id as string | undefined, approve
      ? { title: "Vinnuyfirlit staðfest af starfsmanni", body: "Starfsmaður staðfesti vinnuyfirlitið sitt — lokastaðfesting bíður þín.", url: "/timaskraning/vinnuyfirlit", tag: "work-overview" }
      : { title: "Athugasemd við vinnuyfirlit", body: "Starfsmaður gerði athugasemd við vinnuyfirlitið sitt.", url: "/timaskraning/vinnuyfirlit", tag: "work-overview" });
    revalidatePath("/mitt-svaedi");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
