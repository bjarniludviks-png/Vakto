"use server";

import { headers } from "next/headers";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { userError } from "@/lib/user-error";
import { hoursOf, jobTotals, type Client, type JobDetail, type JobListItem, type ReportSnapshot } from "@/lib/verk";

// VAKTO Verk (0102): verk, viðskiptavinir, tímar, efni, myndir og verkskýrslur til samþykktar.
// RLS sér um aðganginn (fyrirtæki notandans; tímar: eigin eða stjórnandi).

type Sb = Awaited<ReturnType<typeof createClient>>;
type Res = { ok: boolean; error?: string };

async function ctxOf(supabase: Sb) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: u } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  const company = u?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company, role: (u?.role as string) ?? "employee" };
}

const num = (v: unknown): number | null => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null; };
const txt = (v: unknown, max = 300) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };
const hhmm = (iso: string) => new Date(iso).toISOString().slice(11, 16);

/** Öll verk fyrirtækisins með tímum í mánuðinum og samtals, og hvort tímataka mín sé í gangi á verkinu. */
export async function listJobs(): Promise<{ ok: boolean; companyId: string; jobs: JobListItem[]; clients: Client[]; running: { entryId: string; jobId: string; startedAt: string } | null }> {
  const empty = { ok: false, companyId: "", jobs: [], clients: [], running: null };
  if (!isSupabaseConfigured()) return empty;
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return empty;
    const [jobsRes, clientsRes, entriesRes] = await Promise.all([
      supabase.from("jobs").select("id, title, address, status, hourly_rate, client_id, created_at, clients(name)").eq("company_id", ctx.company).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name, kennitala, email, phone, address").eq("company_id", ctx.company).order("name"),
      supabase.from("job_entries").select("id, job_id, user_id, started_at, ended_at").eq("company_id", ctx.company).order("started_at", { ascending: false }).limit(5000),
    ]);
    if (jobsRes.error) return empty;
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const agg = new Map<string, { month: number; total: number; last: string | null; running: boolean }>();
    let running: { entryId: string; jobId: string; startedAt: string } | null = null;
    for (const e of entriesRes.data ?? []) {
      const a = agg.get(e.job_id as string) ?? { month: 0, total: 0, last: null, running: false };
      const h = hoursOf(e.started_at as string, e.ended_at as string | null);
      a.total += h;
      if (new Date(e.started_at as string) >= monthStart) a.month += h;
      if (!a.last) a.last = e.started_at as string;
      if (!e.ended_at && e.user_id === ctx.userId) { a.running = true; running = { entryId: e.id as string, jobId: e.job_id as string, startedAt: e.started_at as string }; }
      agg.set(e.job_id as string, a);
    }
    const jobs: JobListItem[] = (jobsRes.data ?? []).map((j) => {
      const a = agg.get(j.id as string);
      const c = (Array.isArray(j.clients) ? j.clients[0] : j.clients) as { name?: string } | null;
      return {
        id: j.id as string, title: j.title as string, address: (j.address as string) ?? null, status: j.status as JobListItem["status"],
        client: c?.name ?? null, clientId: (j.client_id as string) ?? null, hourlyRate: j.hourly_rate != null ? Number(j.hourly_rate) : null,
        hoursMonth: Math.round((a?.month ?? 0) * 10) / 10, hoursTotal: Math.round((a?.total ?? 0) * 10) / 10, lastAt: a?.last ?? (j.created_at as string), running: !!a?.running,
      };
    });
    return { ok: true, companyId: ctx.company, jobs, clients: (clientsRes.data ?? []) as Client[], running };
  } catch (e) {
    console.error("listJobs:", e);
    return empty;
  }
}

export async function getJob(id: string): Promise<{ ok: boolean; job?: JobDetail; error?: string }> {
  if (!isSupabaseConfigured() || !id) return { ok: false, error: "Verk fannst ekki" };
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const [jr, er, ir, pr, rr] = await Promise.all([
      supabase.from("jobs").select("id, title, address, lat, lng, status, notes, hourly_rate, clients(id, name, kennitala, email, phone, address)").eq("id", id).maybeSingle(),
      supabase.from("job_entries").select("id, user_id, started_at, ended_at, note, km, billable, on_site, users(full_name)").eq("job_id", id).order("started_at", { ascending: false }),
      supabase.from("job_items").select("id, kind, description, quantity, unit_price, date, receipt_url").eq("job_id", id).order("date", { ascending: false }),
      supabase.from("job_photos").select("id, url, caption, created_at").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.from("job_reports").select("id, token, period_from, period_to, status, signed_name, client_comment, decided_at, created_at").eq("job_id", id).order("created_at", { ascending: false }),
    ]);
    const j = jr.data;
    if (!j) return { ok: false, error: "Verk fannst ekki" };
    const c = (Array.isArray(j.clients) ? j.clients[0] : j.clients) as Client | null;
    return {
      ok: true,
      job: {
        id: j.id as string, title: j.title as string, address: (j.address as string) ?? null, lat: (j.lat as number) ?? null, lng: (j.lng as number) ?? null,
        status: j.status as JobDetail["status"], notes: (j.notes as string) ?? null, hourlyRate: j.hourly_rate != null ? Number(j.hourly_rate) : null, client: c ?? null,
        entries: (er.data ?? []).map((e) => {
          const u = (Array.isArray(e.users) ? e.users[0] : e.users) as { full_name?: string } | null;
          return { id: e.id as string, userId: e.user_id as string, who: u?.full_name ?? "—", startedAt: e.started_at as string, endedAt: (e.ended_at as string) ?? null, hours: Math.round(hoursOf(e.started_at as string, e.ended_at as string | null) * 100) / 100, note: (e.note as string) ?? null, km: Number(e.km ?? 0), billable: e.billable !== false, onSite: (e.on_site as boolean | null) ?? null };
        }),
        items: (ir.data ?? []).map((i) => ({ id: i.id as string, kind: i.kind as "material" | "expense", description: i.description as string, quantity: Number(i.quantity), unitPrice: Number(i.unit_price), date: String(i.date), receiptUrl: (i.receipt_url as string) ?? null })),
        photos: (pr.data ?? []).map((p) => ({ id: p.id as string, url: p.url as string, caption: (p.caption as string) ?? null, createdAt: p.created_at as string })),
        reports: (rr.data ?? []).map((r) => ({ id: r.id as string, token: r.token as string, from: String(r.period_from), to: String(r.period_to), status: r.status as "sent", signedName: (r.signed_name as string) ?? null, comment: (r.client_comment as string) ?? null, decidedAt: (r.decided_at as string) ?? null, createdAt: r.created_at as string })),
      },
    };
  } catch (e) {
    console.error("getJob:", e);
    return { ok: false, error: "Tókst ekki að sækja verkið" };
  }
}

/** Nýr viðskiptavinur eða breyting (id). */
export async function saveClient(input: { id?: string; name: string; kennitala?: string; email?: string; phone?: string; address?: string }): Promise<Res & { id?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    const row = { name: txt(input.name, 200), kennitala: txt(input.kennitala, 11), email: txt(input.email, 200), phone: txt(input.phone, 40), address: txt(input.address, 200) };
    if (!row.name) return { ok: false, error: "Sláðu inn nafn viðskiptavinar" };
    const q = input.id
      ? supabase.from("clients").update(row).eq("id", input.id).select("id").single()
      : supabase.from("clients").insert({ ...row, company_id: ctx.company }).select("id").single();
    const { data, error } = await q;
    if (error) return { ok: false, error: userError(error) };
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

/** Nýtt verk eða breyting (id). Hnit (lat/lng) fylgja ef heimilisfangið var staðsett í vafra/síma. */
export async function saveJob(input: { id?: string; title: string; clientId?: string | null; address?: string; lat?: number | null; lng?: number | null; hourlyRate?: string | number | null; notes?: string; status?: string }): Promise<Res & { id?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    const title = txt(input.title, 200);
    if (!title) return { ok: false, error: "Gefðu verkinu heiti" };
    const row: Record<string, unknown> = {
      title, client_id: input.clientId || null, address: txt(input.address, 200), notes: txt(input.notes, 2000),
      hourly_rate: num(input.hourlyRate),
      ...(input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : {}),
      ...(input.status && ["open", "done", "archived"].includes(input.status) ? { status: input.status } : {}),
    };
    const q = input.id
      ? supabase.from("jobs").update(row).eq("id", input.id).select("id").single()
      : supabase.from("jobs").insert({ ...row, company_id: ctx.company, created_by: ctx.userId }).select("id").single();
    const { data, error } = await q;
    if (error) return { ok: false, error: userError(error) };
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

export async function setJobStatus(id: string, status: "open" | "done" | "archived"): Promise<Res> {
  const supabase = await createClient();
  const ctx = await ctxOf(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (await demoBlocked(ctx.company)) return demoResult();
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
  return error ? { ok: false, error: userError(error) } : { ok: true };
}

/** Byrja tímatöku á verki (stöðvar fyrst tímatöku sem er í gangi á öðru verki). */
export async function startTimer(jobId: string, pos?: { lat: number; lng: number } | null): Promise<Res & { onSite?: boolean | null }> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    await supabase.from("job_entries").update({ ended_at: new Date().toISOString() }).eq("user_id", ctx.userId).is("ended_at", null);
    const { data, error } = await supabase.from("job_entries")
      .insert({ company_id: ctx.company, job_id: jobId, user_id: ctx.userId, ...(pos ? { in_lat: pos.lat, in_lng: pos.lng } : {}) })
      .select("on_site").single();
    if (error) return { ok: false, error: userError(error) };
    return { ok: true, onSite: (data?.on_site as boolean | null) ?? null };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

export async function stopTimer(input: { km?: string | number; note?: string; pos?: { lat: number; lng: number } | null }): Promise<Res> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    const patch: Record<string, unknown> = { ended_at: new Date().toISOString(), km: Math.max(0, num(input.km) ?? 0), note: txt(input.note, 1000) };
    if (input.pos) { patch.out_lat = input.pos.lat; patch.out_lng = input.pos.lng; }
    const { error } = await supabase.from("job_entries").update(patch).eq("user_id", ctx.userId).is("ended_at", null);
    return error ? { ok: false, error: userError(error) } : { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

/** Handskráður tími: dagsetning + frá/til (HH:MM; til < frá = yfir miðnætti). */
export async function addEntry(input: { jobId: string; date: string; start: string; end: string; km?: string | number; note?: string; billable?: boolean }): Promise<Res> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end)) return { ok: false, error: "Veldu dag og tíma" };
    const s = new Date(`${input.date}T${input.start}:00Z`);
    let e = new Date(`${input.date}T${input.end}:00Z`);
    if (e <= s) e = new Date(e.getTime() + 864e5);
    const { error } = await supabase.from("job_entries").insert({
      company_id: ctx.company, job_id: input.jobId, user_id: ctx.userId, started_at: s.toISOString(), ended_at: e.toISOString(),
      km: Math.max(0, num(input.km) ?? 0), note: txt(input.note, 1000), billable: input.billable !== false,
    });
    return error ? { ok: false, error: userError(error) } : { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

export async function deleteEntry(id: string): Promise<Res> {
  const supabase = await createClient();
  const ctx = await ctxOf(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (await demoBlocked(ctx.company)) return demoResult();
  const { error } = await supabase.from("job_entries").delete().eq("id", id);
  return error ? { ok: false, error: userError(error) } : { ok: true };
}

export async function addItem(input: { jobId: string; kind: "material" | "expense"; description: string; quantity?: string | number; unitPrice: string | number; date?: string; receiptUrl?: string | null }): Promise<Res> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    const description = txt(input.description, 300);
    if (!description) return { ok: false, error: "Lýstu efninu eða kostnaðinum" };
    const { error } = await supabase.from("job_items").insert({
      company_id: ctx.company, job_id: input.jobId, kind: input.kind === "expense" ? "expense" : "material", description,
      quantity: num(input.quantity) ?? 1, unit_price: num(input.unitPrice) ?? 0, receipt_url: input.receiptUrl ?? null,
      ...(input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? { date: input.date } : {}),
    });
    return error ? { ok: false, error: userError(error) } : { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

export async function deleteItem(id: string): Promise<Res> {
  const supabase = await createClient();
  const ctx = await ctxOf(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (await demoBlocked(ctx.company)) return demoResult();
  const { error } = await supabase.from("job_items").delete().eq("id", id);
  return error ? { ok: false, error: userError(error) } : { ok: true };
}

/** Mynd sem vafrinn/appið hlóð upp í geymsluna (chat-hólfið, {fyrirtæki}/verk/…). */
export async function addPhoto(input: { jobId: string; url: string; caption?: string }): Promise<Res> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    if (!/^https:\/\//.test(input.url) || !input.url.includes(`/${ctx.company}/`)) return { ok: false, error: "Ógild mynd" };
    const { error } = await supabase.from("job_photos").insert({ company_id: ctx.company, job_id: input.jobId, url: input.url, caption: txt(input.caption, 300) });
    return error ? { ok: false, error: userError(error) } : { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}

export async function deletePhoto(id: string): Promise<Res> {
  const supabase = await createClient();
  const ctx = await ctxOf(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (await demoBlocked(ctx.company)) return demoResult();
  const { error } = await supabase.from("job_photos").delete().eq("id", id);
  return error ? { ok: false, error: userError(error) } : { ok: true };
}

/** Verkskýrsla fyrir tímabil, fryst og send viðskiptavini sem hlekkur (/samthykki/{token}) til samþykktar. */
export async function createReport(input: { jobId: string; from: string; to: string }): Promise<Res & { url?: string; token?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await ctxOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    if (await demoBlocked(ctx.company)) return demoResult();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || input.to < input.from) return { ok: false, error: "Veldu tímabil" };
    const [g, co] = await Promise.all([getJob(input.jobId), supabase.from("companies").select("name, kennitala").eq("id", ctx.company).maybeSingle()]);
    if (!g.ok || !g.job) return { ok: false, error: g.error ?? "Verk fannst ekki" };
    const j = g.job;
    const inRange = (iso: string) => iso.slice(0, 10) >= input.from && iso.slice(0, 10) <= input.to;
    const entries = j.entries.filter((e) => e.endedAt && inRange(e.startedAt)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const items = j.items.filter((i) => i.date >= input.from && i.date <= input.to).sort((a, b) => a.date.localeCompare(b.date));
    if (!entries.length && !items.length) return { ok: false, error: "Engir tímar eða efni á tímabilinu" };
    const snapshot: ReportSnapshot = {
      company: { name: (co.data?.name as string) ?? "", kennitala: (co.data?.kennitala as string) ?? null },
      job: { title: j.title, address: j.address },
      client: j.client ? { name: j.client.name, email: j.client.email } : null,
      from: input.from, to: input.to, hourlyRate: j.hourlyRate,
      entries: entries.map((e) => ({ date: e.startedAt.slice(0, 10), start: hhmm(e.startedAt), end: hhmm(e.endedAt!), hours: e.hours, who: e.who, note: e.note, km: e.km, onSite: e.onSite })),
      items: items.map((i) => ({ date: i.date, kind: i.kind, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      photos: j.photos.filter((p) => inRange(p.createdAt)).slice(0, 40).map((p) => ({ url: p.url, caption: p.caption })),
      totals: jobTotals(entries, items, j.hourlyRate),
    };
    const { data, error } = await supabase.from("job_reports")
      .insert({ company_id: ctx.company, job_id: j.id, period_from: input.from, period_to: input.to, snapshot, created_by: ctx.userId })
      .select("token").single();
    if (error) return { ok: false, error: userError(error) };
    const token = data.token as string;
    // Slóðin fylgir vefnum sem skýrslan var gerð á (vakto.is, staging eða localhost).
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const origin = host ? `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}` : SITE_URL;
    return { ok: true, token, url: `${origin}/samthykki/${token}` };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
