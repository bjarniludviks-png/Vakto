import "server-only";

// Sjálfvirk stimplun (migration 0112). Appið lætur vita þegar síminn kemur á eða fer af vinnustað
// (svæðismörk stýrikerfisins — engin samfelld rakning) og þessi kóði ákveður hvað gerist:
//   'auto'    → stimplað beint inn/út (source 'auto' / auto_out 'geofence')
//   'suggest' → tillaga í punch_suggestions sem starfsmaður staðfestir, hafnar eða leiðréttir
// Starfsmaðurinn verður sjálfur að hafa kveikt (auto_punch_consents). Allt skrifað með þjónustulykli,
// svo hér eru reglurnar sem guard_punch_self_write framfylgir annars: tími er „núna“ (±15 mín.) eða
// tími sem þjónninn skráði sjálfur við komu/brottför — starfsmaður getur aðeins STYTT tímann við staðfestingu.
//
// Einnig: sjálfvirk útstimplun eftir X klst. (companies.auto_clockout_hours) — runAutoClockout(), cron á 15 mín. fresti.

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee, notifyManagers } from "@/lib/push";

type Admin = ReturnType<typeof createAdminClient>;

export type AutoPunchMode = "off" | "suggest" | "auto";
export type AutoPunchCtx = { employeeId: string; companyId: string; userId: string };
export type Region = { id: string; name: string; lat: number; lng: number; radius: number };
export type Suggestion = { id: string; kind: "in" | "out"; at: string; location: string | null; createdAt: string };

/** iOS/Android ráða illa við minni svæði en ~150 m; stærri en 5 km er ekki lengur „vinnustaður“. */
const MIN_RADIUS = 150;
const MAX_RADIUS = 5000;
/** Mæting telst „á vakt“ frá 2 klst. fyrir upphaf vaktar til loka hennar. */
const EARLY_MIN = 120;
/** Fari síminn út og inn aftur innan 10 mín. er sjálfvirka útstimplunin afturkölluð (GPS-flökt). */
const REOPEN_MIN = 10;
/** Tillaga sem enginn hefur svarað í 48 klst. rennur út. */
const SUGGESTION_TTL_H = 48;

const hm = (iso: string) => iso.slice(11, 16); // Ísland = UTC
const clampAt = (raw: unknown): string => {
  const now = Date.now();
  const t = typeof raw === "string" ? Date.parse(raw) : NaN;
  const v = Number.isFinite(t) ? Math.min(now, Math.max(now - 15 * 60e3, t)) : now;
  return new Date(v).toISOString();
};

export async function companyAutoPunch(admin: Admin, companyId: string): Promise<{ mode: AutoPunchMode; unscheduled: boolean; clockoutHours: number | null }> {
  const { data, error } = await admin.from("companies").select("auto_punch_mode, auto_punch_unscheduled, auto_clockout_hours").eq("id", companyId).maybeSingle();
  if (error || !data) return { mode: "off", unscheduled: false, clockoutHours: null };
  const m = data.auto_punch_mode as string;
  return {
    mode: m === "auto" || m === "suggest" ? m : "off",
    unscheduled: !!data.auto_punch_unscheduled,
    clockoutHours: (data.auto_clockout_hours as number | null) ?? null,
  };
}

async function hasConsent(admin: Admin, employeeId: string): Promise<boolean> {
  const { data } = await admin.from("auto_punch_consents").select("employee_id").eq("employee_id", employeeId).maybeSingle();
  return !!data;
}

/** Það sem appið þarf: hamur, samþykki, svæðin (aðeins ef kveikt) og ósvaraðar tillögur. */
export async function getAutoPunchState(ctx: AutoPunchCtx) {
  const admin = createAdminClient();
  const cfg = await companyAutoPunch(admin, ctx.companyId);
  const consent = cfg.mode !== "off" && (await hasConsent(admin, ctx.employeeId));
  let regions: Region[] = [];
  if (consent) {
    const { data } = await admin.from("locations").select("id, name, lat, lng, geofence_radius").eq("company_id", ctx.companyId).not("lat", "is", null).not("lng", "is", null);
    regions = (data ?? []).map((l) => ({
      id: l.id as string, name: (l.name as string) ?? "",
      lat: Number(l.lat), lng: Number(l.lng),
      radius: Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(l.geofence_radius) || MIN_RADIUS)),
    }));
  }
  const pending = cfg.mode !== "off" ? await pendingSuggestions(admin, ctx.employeeId) : [];
  return { mode: cfg.mode, unscheduled: cfg.unscheduled, consent, regions, pending, clockoutHours: cfg.clockoutHours };
}

async function pendingSuggestions(admin: Admin, employeeId: string): Promise<Suggestion[]> {
  // Gamlar tillögur renna út svo listinn safnist ekki upp.
  await admin.from("punch_suggestions").update({ status: "expired", decided_at: new Date().toISOString() })
    .eq("employee_id", employeeId).eq("status", "pending").lt("at", new Date(Date.now() - SUGGESTION_TTL_H * 3600e3).toISOString());
  const { data } = await admin.from("punch_suggestions").select("id, kind, at, created_at, locations(name)")
    .eq("employee_id", employeeId).eq("status", "pending").order("at", { ascending: true }).limit(20);
  return (data ?? []).map((s) => ({
    id: s.id as string, kind: s.kind as "in" | "out", at: s.at as string, createdAt: s.created_at as string,
    location: ((Array.isArray(s.locations) ? s.locations[0] : s.locations) as { name?: string } | null)?.name ?? null,
  }));
}

export async function setConsent(ctx: AutoPunchCtx, on: boolean): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!on) {
    await admin.from("auto_punch_consents").delete().eq("employee_id", ctx.employeeId);
    // Ósvaraðar tillögur hverfa með samþykkinu.
    await admin.from("punch_suggestions").update({ status: "expired", decided_at: new Date().toISOString() }).eq("employee_id", ctx.employeeId).eq("status", "pending");
    return { ok: true };
  }
  const cfg = await companyAutoPunch(admin, ctx.companyId);
  if (cfg.mode === "off") return { ok: false, error: "Vinnustaðurinn hefur ekki kveikt á sjálfvirkri stimplun" };
  const { error } = await admin.from("auto_punch_consents").upsert({ employee_id: ctx.employeeId, company_id: ctx.companyId, user_id: ctx.userId }, { onConflict: "employee_id" });
  if (error) { console.error("auto_punch consent", error); return { ok: false, error: "Tókst ekki að vista" }; }
  return { ok: true };
}

type OpenPunch = { id: string; clock_in: string; in_location_id: string | null };
async function openPunch(admin: Admin, employeeId: string): Promise<OpenPunch | null> {
  const { data } = await admin.from("punches").select("id, clock_in, in_location_id").eq("employee_id", employeeId).is("clock_out", null)
    .order("clock_in", { ascending: false }).limit(1);
  return (data?.[0] as OpenPunch | undefined) ?? null;
}

/** Útgefin vakt sem nær yfir `atISO` (frá 2 klst. fyrir upphaf til loka), á þessum stað eða staðlaus. */
async function shiftCovers(admin: Admin, employeeId: string, atISO: string, locationId: string): Promise<boolean> {
  const at = new Date(atISO);
  const day = atISO.slice(0, 10);
  const prev = new Date(at.getTime() - 86400e3).toISOString().slice(0, 10);
  const { data } = await admin.from("shifts").select("date, start_time, end_time, location_id")
    .eq("employee_id", employeeId).eq("published", true).in("date", [prev, day]);
  const t = at.getTime();
  return (data ?? []).some((s) => {
    const st = (s.start_time as string | null)?.slice(0, 5), en = (s.end_time as string | null)?.slice(0, 5);
    if (!st || !en) return false;
    if (s.location_id && s.location_id !== locationId) return false;
    const start = Date.parse(`${s.date}T${st}:00Z`);
    let end = Date.parse(`${s.date}T${en}:00Z`);
    if (end <= start) end += 86400e3; // næturvakt
    return t >= start - EARLY_MIN * 60e3 && t <= end;
  });
}

export type GeoEvent = { type: "enter" | "exit"; locationId: string; lat?: number; lng?: number; acc?: number; at?: string };
export type EventResult = { ok: boolean; result: string; error?: string };

/** Síminn kom á eða fór af vinnustað. */
export async function handleGeoEvent(ctx: AutoPunchCtx, ev: GeoEvent): Promise<EventResult> {
  const admin = createAdminClient();
  const cfg = await companyAutoPunch(admin, ctx.companyId);
  if (cfg.mode === "off") return { ok: true, result: "off" };
  if (!(await hasConsent(admin, ctx.employeeId))) return { ok: true, result: "no_consent" };
  const { data: loc } = await admin.from("locations").select("id, name").eq("id", ev.locationId).eq("company_id", ctx.companyId).maybeSingle();
  if (!loc) return { ok: false, result: "bad_location", error: "Óþekktur staður" };
  const at = clampAt(ev.at);
  const pos = typeof ev.lat === "number" && typeof ev.lng === "number" && Math.abs(ev.lat) <= 90 && Math.abs(ev.lng) <= 180
    ? { lat: ev.lat, lng: ev.lng, acc: Math.max(0, Math.round(Number(ev.acc) || 0)) } : null;
  const place = (loc.name as string) ?? "";
  const open = await openPunch(admin, ctx.employeeId);

  if (ev.type === "enter") {
    if (open && (!open.in_location_id || open.in_location_id === ev.locationId)) return { ok: true, result: "already_in" };
    // Kominn á annan stað meðan stimplaður inn: skipta aðeins ef vakt er á nýja staðnum.
    const covered = await shiftCovers(admin, ctx.employeeId, at, ev.locationId);
    if (open && !covered) return { ok: true, result: "already_in" };
    if (!open && !covered && !cfg.unscheduled) return { ok: true, result: "no_shift" };

    if (cfg.mode === "suggest") return suggest(admin, ctx, "in", at, ev.locationId, pos, place);

    if (!open) {
      // GPS-flökt: síminn fór út og kom aftur inn rétt áðan → afturkalla sjálfvirku útstimplunina.
      const { data: last } = await admin.from("punches").select("id, clock_out, auto_out").eq("employee_id", ctx.employeeId)
        .not("clock_out", "is", null).order("clock_out", { ascending: false }).limit(1);
      const l = last?.[0];
      if (l && l.auto_out === "geofence" && Date.parse(l.clock_out as string) > Date.now() - REOPEN_MIN * 60e3) {
        const { error } = await admin.from("punches").update({ clock_out: null, auto_out: null }).eq("id", l.id as string);
        if (!error) return { ok: true, result: "reopened" };
      }
    } else {
      const r = await closePunch(admin, open.id, at, pos);
      if (!r.ok) return { ok: false, result: "error", error: r.error };
    }
    const r = await insertAutoPunch(admin, ctx, at, pos);
    if (!r.ok) return { ok: false, result: "error", error: r.error };
    void notifyEmployee(ctx.employeeId, { title: "Stimplað inn sjálfkrafa", body: `Kl. ${hm(at)}${place ? ` · ${place}` : ""}. Rangt? Leiðréttu í Tímar.`, url: "/mitt-svaedi", appUrl: "/stimplun", tag: "auto-punch" });
    return { ok: true, result: open ? "switched" : "clocked_in" };
  }

  // exit
  if (!open) return { ok: true, result: "not_in" };
  if (open.in_location_id && open.in_location_id !== ev.locationId) return { ok: true, result: "other_location" };
  if (cfg.mode === "suggest") return suggest(admin, ctx, "out", at, ev.locationId, pos, place);
  const r = await closePunch(admin, open.id, at < open.clock_in ? new Date().toISOString() : at, pos);
  if (!r.ok) return { ok: false, result: "error", error: r.error };
  void notifyEmployee(ctx.employeeId, { title: "Stimplað út sjálfkrafa", body: `Kl. ${hm(at)}${place ? ` · ${place}` : ""}. Komstu aftur? Þá stimplast þú inn sjálfkrafa.`, url: "/mitt-svaedi", appUrl: "/stimplun", tag: "auto-punch" });
  return { ok: true, result: "clocked_out" };
}

async function suggest(admin: Admin, ctx: AutoPunchCtx, kind: "in" | "out", at: string, locationId: string, pos: { lat: number; lng: number; acc: number } | null, place: string): Promise<EventResult> {
  // Ein ósvöruð tillaga af hverri gerð í senn — nýrri brottför færir tímann.
  const { data: existing } = await admin.from("punch_suggestions").select("id").eq("employee_id", ctx.employeeId).eq("status", "pending").eq("kind", kind)
    .gt("at", new Date(Date.now() - 12 * 3600e3).toISOString()).limit(1);
  if (existing?.length) {
    if (kind === "out") await admin.from("punch_suggestions").update({ at, location_id: locationId, lat: pos?.lat ?? null, lng: pos?.lng ?? null, acc: pos?.acc ?? null }).eq("id", existing[0].id as string);
    return { ok: true, result: "suggested" };
  }
  const { error } = await admin.from("punch_suggestions").insert({
    company_id: ctx.companyId, employee_id: ctx.employeeId, kind, at, location_id: locationId,
    lat: pos?.lat ?? null, lng: pos?.lng ?? null, acc: pos?.acc ?? null,
  });
  if (error) { console.error("punch_suggestions insert", error); return { ok: false, result: "error", error: "Tókst ekki" }; }
  void notifyEmployee(ctx.employeeId, kind === "in"
    ? { title: "Mættur/mætt?", body: `Þú komst${place ? ` á ${place}` : ""} kl. ${hm(at)}. Staðfestu innstimplun.`, url: "/mitt-svaedi", appUrl: "/stimplun", tag: "auto-punch" }
    : { title: "Farin(n) heim?", body: `Þú fórst${place ? ` af ${place}` : ""} kl. ${hm(at)}. Staðfestu útstimplun.`, url: "/mitt-svaedi", appUrl: "/stimplun", tag: "auto-punch" });
  return { ok: true, result: "suggested" };
}

/** Villur grunnsins (geofence-reglan o.fl.) → skiljanlegur texti; tæknitexti fer í log. */
function punchFail(where: string, error: { message?: string }): { ok: false; error: string } {
  const m = error.message ?? "";
  if (m.includes("GEOFENCE_OUTSIDE")) return { ok: false, error: "Þú ert utan vinnusvæðis — ekki hægt að stimpla inn hér." };
  if (m.includes("GEOFENCE_MISSING")) return { ok: false, error: "Staðsetning þarf til að stimpla inn." };
  console.error(where, error);
  return { ok: false, error: "Stimplun tókst ekki — reyndu aftur." };
}

async function insertAutoPunch(admin: Admin, ctx: AutoPunchCtx, at: string, pos: { lat: number; lng: number; acc: number } | null): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await admin.from("punches").insert({
    company_id: ctx.companyId, employee_id: ctx.employeeId, clock_in: at, source: "auto",
    ...(pos ? { in_lat: pos.lat, in_lng: pos.lng, in_acc: pos.acc } : {}),
  }).select("id").single();
  if (error) return punchFail("auto punch insert", error);
  return { ok: true, id: data.id as string };
}

async function closePunch(admin: Admin, id: string, at: string, pos: { lat: number; lng: number; acc: number } | null): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await admin.from("punches")
    .update({ clock_out: at, auto_out: "geofence", ...(pos ? { out_lat: pos.lat, out_lng: pos.lng, out_acc: pos.acc } : {}) })
    .eq("id", id).is("clock_out", null).select("id");
  if (error) return punchFail("auto punch close", error);
  if (!data?.length) return { ok: false, error: "Stimplunin er þegar lokuð" };
  return { ok: true };
}

/** Starfsmaður staðfestir (má aðeins stytta tímann) eða hafnar tillögu. */
export async function decideSuggestion(ctx: AutoPunchCtx, id: string, confirm: boolean, editedAt?: string | null): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: s } = await admin.from("punch_suggestions").select("id, kind, at, status, lat, lng, acc, location_id").eq("id", id).eq("employee_id", ctx.employeeId).maybeSingle();
  if (!s || s.status !== "pending") return { ok: false, error: "Tillagan er ekki lengur opin" };
  const now = new Date().toISOString();
  if (Date.parse(s.at as string) < Date.now() - SUGGESTION_TTL_H * 3600e3) {
    await admin.from("punch_suggestions").update({ status: "expired", decided_at: now }).eq("id", id);
    return { ok: false, error: "Tillagan er útrunnin — biddu stjórnanda að leiðrétta" };
  }
  if (!confirm) {
    await admin.from("punch_suggestions").update({ status: "rejected", decided_at: now }).eq("id", id).eq("status", "pending");
    return { ok: true };
  }
  const pos = s.lat != null && s.lng != null ? { lat: Number(s.lat), lng: Number(s.lng), acc: Number(s.acc) || 0 } : null;
  const edited = editedAt ? Date.parse(editedAt) : NaN;
  const open = await openPunch(admin, ctx.employeeId);
  let punchId: string | null = null;

  if (s.kind === "in") {
    // Innstimplun: ekki fyrr en síminn kom á staðinn, ekki síðar en núna.
    const t = new Date(Number.isFinite(edited) ? Math.min(Date.now(), Math.max(Date.parse(s.at as string), edited)) : Date.parse(s.at as string)).toISOString();
    if (open) {
      if (open.clock_in >= t) return { ok: false, error: "Þú ert þegar stimplað/ur inn" };
      if (open.in_location_id && open.in_location_id === s.location_id) return { ok: false, error: "Þú ert þegar stimplað/ur inn" };
      const c = await closePunch(admin, open.id, t, pos); // skipt um stað
      if (!c.ok) return c;
    }
    const r = await insertAutoPunch(admin, ctx, t, pos);
    if (!r.ok) return { ok: false, error: r.error };
    punchId = r.id ?? null;
  } else {
    if (!open) return { ok: false, error: "Engin opin stimplun — staðfestu innstimplunina fyrst" };
    // Útstimplun: ekki síðar en síminn fór, ekki fyrir innstimplun.
    const lo = Date.parse(open.clock_in), hi = Date.parse(s.at as string);
    if (hi < lo) return { ok: false, error: "Brottför er á undan innstimplun" };
    const t = new Date(Number.isFinite(edited) ? Math.min(hi, Math.max(lo, edited)) : hi).toISOString();
    const c = await closePunch(admin, open.id, t, pos);
    if (!c.ok) return c;
    punchId = open.id;
  }
  await admin.from("punch_suggestions").update({ status: "confirmed", decided_at: now, punch_id: punchId }).eq("id", id);
  return { ok: true };
}

/* ------------------------------------------------ sjálfvirk útstimplun eftir X klst. */

/** Lokar opnum stimplunum sem eru orðnar X klst. (á clock_in + X, svo tíminn verður réttur sama hvenær
 *  keyrslan nær þeim) og minnir á X−4 og X−2 klst. Aðeins stimplanir eftir að kveikt var. */
export async function runAutoClockout(): Promise<{ closed: number; reminded: number }> {
  const admin = createAdminClient();
  const { data: cos, error } = await admin.from("companies").select("id, auto_clockout_hours, auto_clockout_since").not("auto_clockout_hours", "is", null);
  if (error) return { closed: 0, reminded: 0 };
  let closed = 0, reminded = 0;
  const now = Date.now();
  for (const c of cos ?? []) {
    const X = Number(c.auto_clockout_hours);
    if (!(X >= 4 && X <= 24)) continue;
    const since = (c.auto_clockout_since as string | null) ?? new Date(0).toISOString();
    const { data: ps } = await admin.from("punches").select("id, employee_id, clock_in, auto_reminded")
      .eq("company_id", c.id as string).is("clock_out", null).gte("clock_in", since)
      .lt("clock_in", new Date(now - (X - 4) * 3600e3).toISOString()).limit(500);
    let closedHere = 0;
    for (const p of ps ?? []) {
      const ci = Date.parse(p.clock_in as string);
      const h = (now - ci) / 3600e3;
      const step = Number(p.auto_reminded) || 0;
      if (h >= X) {
        const out = new Date(ci + X * 3600e3).toISOString();
        const { data: upd } = await admin.from("punches").update({ clock_out: out, auto_out: "limit" }).eq("id", p.id as string).is("clock_out", null).select("id");
        if (upd?.length) {
          closed++; closedHere++;
          void notifyEmployee(p.employee_id as string, { title: "Stimplað út sjálfkrafa", body: `Stimplunin þín var orðin ${X} klst. og var lokuð kl. ${hm(out)}. Stjórnandi fer yfir tímann — sendu leiðréttingu ef hann er rangur.`, url: "/mitt-svaedi", appUrl: "/timar", tag: "auto-clockout" });
        }
      } else if (h >= X - 2 && step < 2) {
        await admin.from("punches").update({ auto_reminded: 2, long_reminded_at: new Date().toISOString() }).eq("id", p.id as string);
        reminded++;
        void notifyEmployee(p.employee_id as string, { title: "Ertu enn að vinna?", body: `Þú verður stimplað/ur út sjálfkrafa eftir 2 klst. (${X} klst. hámark). Stimplaðu út ef þú ert hætt/ur.`, url: "/mitt-svaedi", appUrl: "/stimplun", tag: "auto-clockout" });
      } else if (h >= X - 4 && step < 1) {
        await admin.from("punches").update({ auto_reminded: 1, long_reminded_at: new Date().toISOString() }).eq("id", p.id as string);
        reminded++;
        void notifyEmployee(p.employee_id as string, { title: "Ertu enn að vinna?", body: `Þú hefur verið stimplað/ur inn í ${Math.floor(h)} klst. Eftir ${X} klst. stimplast þú út sjálfkrafa.`, url: "/mitt-svaedi", appUrl: "/stimplun", tag: "auto-clockout" });
      }
    }
    if (closedHere) {
      void notifyManagers(c.id as string, { title: "Sjálfvirk útstimplun", body: closedHere === 1 ? `Ein stimplun var lokuð eftir ${X} klst. — farðu yfir hana í Tímaskráningu.` : `${closedHere} stimplanir voru lokaðar eftir ${X} klst. — farðu yfir þær í Tímaskráningu.`, url: "/timaskraning", tag: "auto-clockout" });
    }
  }
  return { closed, reminded };
}
