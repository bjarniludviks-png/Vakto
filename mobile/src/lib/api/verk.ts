// VAKTO Verk (0102) í appinu: verk, tímataka með staðsetningu, efni, myndir og verkskýrsla til samþykktar.
// Sömu töflur og vefurinn (src/app/(app)/verk/actions.ts); RLS sér um aðganginn.
import * as Location from "expo-location";
import { supabase } from "../supabase";
import { authUser } from "./chat";
import type { Me } from "./me";

export const VSK = 0.24;
export const VSK_REFUND_SHARE = 0.35;
const SITE = "https://www.vakto.is";

export type Client = { id: string; name: string; email: string | null; phone: string | null };
export type JobRow = { id: string; title: string; address: string | null; status: "open" | "done" | "archived"; client: string | null; hourlyRate: number | null; hoursMonth: number; hoursTotal: number };
export type Running = { jobId: string; startedAt: string } | null;
export type Entry = { id: string; who: string; startedAt: string; endedAt: string | null; hours: number; note: string | null; km: number; billable: boolean; onSite: boolean | null };
export type Item = { id: string; kind: "material" | "expense"; description: string; quantity: number; unitPrice: number; date: string };
export type Photo = { id: string; url: string; caption: string | null; createdAt: string };
export type Report = { id: string; token: string; from: string; to: string; status: "sent" | "approved" | "rejected"; signedName: string | null; comment: string | null; createdAt: string };
export type Job = { id: string; title: string; address: string | null; lat: number | null; lng: number | null; status: JobRow["status"]; hourlyRate: number | null; client: Client | null; entries: Entry[]; items: Item[]; photos: Photo[]; reports: Report[] };

export const hoursOf = (s: string, e: string | null) => Math.max(0, ((e ? new Date(e).getTime() : Date.now()) - new Date(s).getTime()) / 3600000);
const thou = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const isNum = (n: number, d = 1) => { const f = 10 ** d, v = Math.round(Math.abs(n) * f) / f; const [i, x] = String(v).split("."); return `${n < 0 ? "−" : ""}${thou(i)}${x ? `,${x}` : ""}`; };
export const kr = (n: number) => `${isNum(n, 0)} kr.`;
export const hrs = (n: number) => `${isNum(n)} klst.`;

export function totals(entries: Pick<Entry, "hours" | "km" | "billable">[], items: Pick<Item, "kind" | "quantity" | "unitPrice">[], rate: number | null) {
  const hours = Math.round(entries.filter((e) => e.billable).reduce((a, e) => a + e.hours, 0) * 100) / 100;
  const km = Math.round(entries.reduce((a, e) => a + e.km, 0) * 10) / 10;
  const labor = Math.round(hours * (rate ?? 0));
  const materials = Math.round(items.filter((i) => i.kind === "material").reduce((a, i) => a + i.quantity * i.unitPrice, 0));
  const expenses = Math.round(items.filter((i) => i.kind === "expense").reduce((a, i) => a + i.quantity * i.unitPrice, 0));
  const net = labor + materials + expenses, vsk = Math.round(net * VSK);
  return { hours, km, labor, materials, expenses, net, vsk, total: net + vsk, refund: Math.round(labor * VSK * VSK_REFUND_SHARE) };
}

/** Staðsetning símans (null ef ekki leyft). */
export async function here(): Promise<{ lat: number; lng: number } | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch {
    return null;
  }
}

export async function listJobs(me: Me): Promise<{ jobs: JobRow[]; clients: Client[]; running: Running }> {
  const { data: auth } = await authUser();
  const [jr, cr, er] = await Promise.all([
    supabase.from("jobs").select("id, title, address, status, hourly_rate, clients(name)").eq("company_id", me.companyId).order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, email, phone").eq("company_id", me.companyId).order("name"),
    supabase.from("job_entries").select("job_id, user_id, started_at, ended_at").eq("company_id", me.companyId).order("started_at", { ascending: false }).limit(3000),
  ]);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const agg = new Map<string, { m: number; t: number }>();
  let running: Running = null;
  for (const e of er.data ?? []) {
    const a = agg.get(e.job_id) ?? { m: 0, t: 0 };
    const h = hoursOf(e.started_at, e.ended_at);
    a.t += h; if (new Date(e.started_at) >= monthStart) a.m += h;
    agg.set(e.job_id, a);
    if (!e.ended_at && e.user_id === auth.user?.id) running = { jobId: e.job_id, startedAt: e.started_at };
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    jobs: (jr.data ?? []).map((j) => {
      const c = (Array.isArray(j.clients) ? j.clients[0] : j.clients) as { name?: string } | null;
      return { id: j.id, title: j.title, address: j.address, status: j.status, client: c?.name ?? null, hourlyRate: j.hourly_rate != null ? Number(j.hourly_rate) : null, hoursMonth: r1(agg.get(j.id)?.m ?? 0), hoursTotal: r1(agg.get(j.id)?.t ?? 0) };
    }),
    clients: (cr.data ?? []) as Client[],
    running,
  };
}

export async function getJob(id: string): Promise<Job | null> {
  const [jr, er, ir, pr, rr] = await Promise.all([
    supabase.from("jobs").select("id, title, address, lat, lng, status, hourly_rate, clients(id, name, email, phone)").eq("id", id).maybeSingle(),
    supabase.from("job_entries").select("id, started_at, ended_at, note, km, billable, on_site, users(full_name)").eq("job_id", id).order("started_at", { ascending: false }),
    supabase.from("job_items").select("id, kind, description, quantity, unit_price, date").eq("job_id", id).order("date", { ascending: false }),
    supabase.from("job_photos").select("id, url, caption, created_at").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("job_reports").select("id, token, period_from, period_to, status, signed_name, client_comment, created_at").eq("job_id", id).order("created_at", { ascending: false }),
  ]);
  const j = jr.data;
  if (!j) return null;
  const c = (Array.isArray(j.clients) ? j.clients[0] : j.clients) as Client | null;
  return {
    id: j.id, title: j.title, address: j.address, lat: j.lat, lng: j.lng, status: j.status, hourlyRate: j.hourly_rate != null ? Number(j.hourly_rate) : null, client: c ?? null,
    entries: (er.data ?? []).map((e) => {
      const u = (Array.isArray(e.users) ? e.users[0] : e.users) as { full_name?: string } | null;
      return { id: e.id, who: u?.full_name ?? "—", startedAt: e.started_at, endedAt: e.ended_at, hours: Math.round(hoursOf(e.started_at, e.ended_at) * 100) / 100, note: e.note, km: Number(e.km ?? 0), billable: e.billable !== false, onSite: e.on_site };
    }),
    items: (ir.data ?? []).map((i) => ({ id: i.id, kind: i.kind, description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unit_price), date: String(i.date) })),
    photos: (pr.data ?? []).map((p) => ({ id: p.id, url: p.url, caption: p.caption, createdAt: p.created_at })),
    reports: (rr.data ?? []).map((r) => ({ id: r.id, token: r.token, from: String(r.period_from), to: String(r.period_to), status: r.status, signedName: r.signed_name, comment: r.client_comment, createdAt: r.created_at })),
  };
}

type Res = { ok: boolean; error?: string };
const fail = (e: { message?: string } | null): Res => (e ? { ok: false, error: e.message ?? "Tókst ekki" } : { ok: true });

export async function saveClient(me: Me, c: { name: string; email?: string; phone?: string }): Promise<Res & { id?: string }> {
  if (!c.name.trim()) return { ok: false, error: "Sláðu inn nafn" };
  const { data, error } = await supabase.from("clients").insert({ company_id: me.companyId, name: c.name.trim(), email: c.email?.trim() || null, phone: c.phone?.trim() || null }).select("id").single();
  return error ? fail(error) : { ok: true, id: data.id };
}

export async function saveJob(me: Me, j: { id?: string; title: string; clientId?: string | null; address?: string; rate?: string; pos?: { lat: number; lng: number } | null }): Promise<Res & { id?: string }> {
  if (!j.title.trim()) return { ok: false, error: "Gefðu verkinu heiti" };
  const rate = Number((j.rate ?? "").replace(",", "."));
  const row = { title: j.title.trim(), client_id: j.clientId || null, address: j.address?.trim() || null, hourly_rate: j.rate?.trim() && Number.isFinite(rate) ? rate : null, ...(j.pos ? { lat: j.pos.lat, lng: j.pos.lng } : {}) };
  const { data: auth } = await authUser();
  const q = j.id
    ? supabase.from("jobs").update(row).eq("id", j.id).select("id").single()
    : supabase.from("jobs").insert({ ...row, company_id: me.companyId, created_by: auth.user?.id }).select("id").single();
  const { data, error } = await q;
  return error ? fail(error) : { ok: true, id: data.id };
}

export async function setStatus(id: string, status: JobRow["status"]): Promise<Res> {
  return fail((await supabase.from("jobs").update({ status }).eq("id", id)).error);
}

export async function start(me: Me, jobId: string): Promise<Res & { onSite?: boolean | null }> {
  const { data: auth } = await authUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const pos = await here();
  await supabase.from("job_entries").update({ ended_at: new Date().toISOString() }).eq("user_id", auth.user.id).is("ended_at", null);
  const { data, error } = await supabase.from("job_entries").insert({ company_id: me.companyId, job_id: jobId, user_id: auth.user.id, ...(pos ? { in_lat: pos.lat, in_lng: pos.lng } : {}) }).select("on_site").single();
  return error ? fail(error) : { ok: true, onSite: data?.on_site ?? null };
}

export async function stop(input: { km?: string; note?: string }): Promise<Res> {
  const { data: auth } = await authUser();
  if (!auth.user) return { ok: false, error: "Ekki innskráð(ur)" };
  const pos = await here();
  const km = Math.max(0, Number((input.km ?? "").replace(",", ".")) || 0);
  return fail((await supabase.from("job_entries").update({ ended_at: new Date().toISOString(), km, note: input.note?.trim() || null, ...(pos ? { out_lat: pos.lat, out_lng: pos.lng } : {}) }).eq("user_id", auth.user.id).is("ended_at", null)).error);
}

export async function addEntry(me: Me, e: { jobId: string; date: string; start: string; end: string; km?: string; note?: string }): Promise<Res> {
  const { data: auth } = await authUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !/^\d{1,2}:\d{2}$/.test(e.start) || !/^\d{1,2}:\d{2}$/.test(e.end)) return { ok: false, error: "Sláðu inn dag (ÁÁÁÁ-MM-DD) og tíma (HH:MM)" };
  const pad = (t: string) => t.padStart(5, "0");
  const s = new Date(`${e.date}T${pad(e.start)}:00Z`);
  let en = new Date(`${e.date}T${pad(e.end)}:00Z`);
  if (en <= s) en = new Date(en.getTime() + 864e5);
  return fail((await supabase.from("job_entries").insert({ company_id: me.companyId, job_id: e.jobId, user_id: auth.user?.id, started_at: s.toISOString(), ended_at: en.toISOString(), km: Math.max(0, Number((e.km ?? "").replace(",", ".")) || 0), note: e.note?.trim() || null })).error);
}

export async function removeEntry(id: string): Promise<Res> { return fail((await supabase.from("job_entries").delete().eq("id", id)).error); }

export async function addItem(me: Me, i: { jobId: string; kind: "material" | "expense"; description: string; quantity: string; unitPrice: string }): Promise<Res> {
  if (!i.description.trim()) return { ok: false, error: "Lýstu efninu" };
  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  return fail((await supabase.from("job_items").insert({ company_id: me.companyId, job_id: i.jobId, kind: i.kind, description: i.description.trim(), quantity: n(i.quantity) || 1, unit_price: n(i.unitPrice) })).error);
}

export async function removeItem(id: string): Promise<Res> { return fail((await supabase.from("job_items").delete().eq("id", id)).error); }

/** Hleður mynd úr símanum upp (chat-hólfið, {fyrirtæki}/verk/{verk}/…) og skráir hana á verkið. */
export async function addPhoto(me: Me, jobId: string, uri: string, caption?: string): Promise<Res> {
  try {
    const blob = await (await fetch(uri)).arrayBuffer();
    const path = `${me.companyId}/verk/${jobId}/${Date.now()}.jpg`;
    const up = await supabase.storage.from("chat").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) return fail(up.error);
    const url = supabase.storage.from("chat").getPublicUrl(path).data.publicUrl;
    return fail((await supabase.from("job_photos").insert({ company_id: me.companyId, job_id: jobId, url, caption: caption?.trim() || null })).error);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tókst ekki" };
  }
}

export async function removePhoto(id: string): Promise<Res> { return fail((await supabase.from("job_photos").delete().eq("id", id)).error); }

const hhmm = (iso: string) => new Date(iso).toISOString().slice(11, 16);

/** Verkskýrsla fyrir tímabil — fryst og vistuð; skilar hlekknum sem viðskiptavinurinn samþykkir á. */
export async function createReport(me: Me, job: Job, from: string, to: string): Promise<Res & { url?: string }> {
  const inRange = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
  const entries = job.entries.filter((e) => e.endedAt && inRange(e.startedAt)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const items = job.items.filter((i) => i.date >= from && i.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length && !items.length) return { ok: false, error: "Engir tímar eða efni á tímabilinu" };
  const [{ data: co }, { data: auth }] = await Promise.all([supabase.from("companies").select("name, kennitala").eq("id", me.companyId).maybeSingle(), authUser()]);
  const snapshot = {
    company: { name: co?.name ?? "", kennitala: co?.kennitala ?? null },
    job: { title: job.title, address: job.address },
    client: job.client ? { name: job.client.name, email: job.client.email } : null,
    from, to, hourlyRate: job.hourlyRate,
    entries: entries.map((e) => ({ date: e.startedAt.slice(0, 10), start: hhmm(e.startedAt), end: hhmm(e.endedAt!), hours: e.hours, who: e.who, note: e.note, km: e.km, onSite: e.onSite })),
    items: items.map((i) => ({ date: i.date, kind: i.kind, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    photos: job.photos.filter((p) => inRange(p.createdAt)).slice(0, 40).map((p) => ({ url: p.url, caption: p.caption })),
    totals: totals(entries, items, job.hourlyRate),
  };
  const { data, error } = await supabase.from("job_reports").insert({ company_id: me.companyId, job_id: job.id, period_from: from, period_to: to, snapshot, created_by: auth.user?.id }).select("token").single();
  return error ? fail(error) : { ok: true, url: `${SITE}/samthykki/${data.token}` };
}
