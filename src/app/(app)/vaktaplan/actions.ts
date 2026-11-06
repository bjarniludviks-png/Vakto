"use server";

import { demoBlocked, demoResult } from "@/lib/demo.server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { notifyEmployee, notifyEmployees } from "@/lib/push";
import { sendSchedulePublishedEmail, sendLeaveDecisionEmail } from "@/lib/email";
import { getEmployees } from "@/lib/employees.server";
import { getWeekUnavail } from "./schedule.server";
import { planEmployees, type PlanEmp } from "./roster.server";
import { getWeekBudget as laborWeekBudget, type WeekBudget } from "@/lib/labor";
import { userError } from "@/lib/user-error";
import { allRows } from "@/lib/supabase/all-rows";
import { normalizeRules, MAX_RULES, MAX_RULE_LEN, type PlanningRule } from "@/lib/planning-rules";
import { closedOn, closedText, type ClosedDay } from "@/lib/closed-days";
import { buildWeekCells, type ExtraShift } from "./week-cells";

export type ShiftInput = {
  employeeName: string; // starfsmanns-id (helst) eða nafn eins og það birtist í planinu
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  shiftTypeName: string;
  /** Staður vaktarinnar (0109). Vantar → sá sem vaktin hafði, annars staður starfsmanns (trigger). */
  locationId?: string | null;
  /** Númer vaktar innan dagsins hjá starfsmanni (0110): 0 = fyrsta vakt, 1 = önnur … */
  slot?: number;
  /** Deild vaktarinnar (heiti, 0110). undefined = óbreytt, null/"" = aðaldeild starfsmanns. */
  deptName?: string | null;
};
const NO_EMP = "Starfsmaður fannst ekki — eða fleiri en einn með sama nafni. Opnaðu vaktina aftur og reyndu á ný.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Finna starfsmann eftir id eða nafni. Nafn verður að passa við NÁKVÆMLEGA einn — áður tók
 * fyrsta „byrjar á“ samsvörun og vaktir lentu á röngum manni þegar tveir hétu „Jan“. */
function pickEmployee(emps: { id: unknown; full_name: unknown }[] | null | undefined, ref: string): string | undefined {
  const list = (emps ?? []).map((e) => ({ id: e.id as string, full: ((e.full_name as string) ?? "").trim().toLowerCase() }));
  const r = (ref ?? "").trim().toLowerCase();
  if (!r) return undefined;
  if (UUID_RE.test(r)) return list.find((e) => e.id === r)?.id;
  const one = (xs: typeof list) => (xs.length === 1 ? xs[0].id : undefined);
  return one(list.filter((e) => e.full === r))
    ?? one(list.filter((e) => e.full.split(/\s+/)[0] === r))
    ?? one(list.filter((e) => e.full.startsWith(r)));
}
/** Vaktategund eftir heiti — nákvæm samsvörun fyrst („Dagvakt“ á ekki að verða „Dagvakt helgi“). */
function pickType(types: { id: unknown; name: unknown }[] | null | undefined, name: string): string | undefined {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return undefined;
  const list = (types ?? []).map((t) => ({ id: t.id as string, nm: ((t.name as string) ?? "").toLowerCase() }));
  return list.find((t) => t.nm === n)?.id ?? list.find((t) => t.nm.startsWith(n))?.id;
}

/** Staðir fyrirtækisins — staður sem kemur frá vafranum er aðeins notaður ef hann er hér. */
async function companyLocIds(supabase: Sb, company: string): Promise<Set<string>> {
  const { data } = await supabase.from("locations").select("id").eq("company_id", company);
  return new Set((data ?? []).map((l) => l.id as string));
}

/** Deildir fyrirtækisins: heiti + staður → id. Sama heiti getur verið á fleiri stöðum (Eldhús á tveimur
 * stöðum) — þá ræður staður vaktarinnar, annars fyrsta deildin með heitinu. */
async function deptResolver(supabase: Sb, company: string): Promise<(name: string | null | undefined, locId?: string | null) => string | null> {
  const { data } = await supabase.from("departments").select("id, name, location_id, locations!inner(company_id)").eq("locations.company_id", company);
  const list = (data ?? []).map((d) => ({ id: d.id as string, nm: ((d.name as string) ?? "").trim().toLowerCase(), loc: d.location_id as string }));
  return (name, locId) => {
    const n = (name ?? "").trim().toLowerCase();
    if (!n) return null;
    const hits = list.filter((d) => d.nm === n);
    return (hits.find((d) => d.loc === locId) ?? hits[0])?.id ?? null;
  };
}
const slotOf = (n: unknown) => Math.min(5, Math.max(0, Math.round(Number(n)) || 0));

export type PublishResult = { ok: boolean; demo?: boolean; count?: number; skippedClosed?: number; error?: string };

export async function publishSchedule(input: ShiftInput[]): Promise<PublishResult> {
  let shifts = input;
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: shifts.length };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: profile } = await supabase
      .from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };

    // Resolve employees + shift types once.
    const { data: emps } = await supabase
      .from("employees").select("id, full_name, email").eq("company_id", company);
    const { data: types } = await supabase
      .from("shift_types").select("id, name").eq("company_id", company);
    const empId = (name: string) =>
      pickEmployee(emps, name);
    const typeId = (name: string) =>
      pickType(types, name);

    // Lokaðir dagar (0107): vaktir á þeim detta út ÁÐUR en nokkru er eytt — annars hyrfi planið ef innsetning félli.
    let skippedClosed = 0;
    const allDates = shifts.map((s) => s.date).filter((d) => ISO_RE.test(d)).sort();
    if (allDates.length) {
      const cl = await closedCtx(supabase, company, allDates[0], allDates[allDates.length - 1]);
      if (cl.list.length) {
        const before = shifts.length;
        shifts = shifts.filter((s) => !cl.hit(s.date, empId(s.employeeName) ?? null));
        skippedClosed = before - shifts.length;
      }
    }

    const dates = [...new Set(shifts.map((s) => s.date))];
    // Staður hverrar vaktar helst þótt planið sé skrifað upp á nýtt (0109).
    const prevLoc = new Map<string, string>();
    if (dates.length) {
      const { data: prev } = await supabase.from("shifts").select("employee_id, date, slot, location_id")
        .eq("company_id", company).in("date", dates).not("employee_id", "is", null).not("location_id", "is", null);
      for (const p of prev ?? []) prevLoc.set(`${p.employee_id}|${p.date}|${p.slot ?? 0}`, p.location_id as string);
    }
    const okLoc = await companyLocIds(supabase, company);
    const deptId = await deptResolver(supabase, company);
    if (dates.length) {
      // Replace published plan for these dates. Lausar vaktir (án starfsmanns) eru ekki í gridinu og haldast.
      await supabase.from("shifts").delete().eq("company_id", company).in("date", dates).not("employee_id", "is", null);
    }

    const rows = shifts.map((s) => {
      const employee_id = empId(s.employeeName) ?? null;
      const slot = slotOf(s.slot);
      const loc = (s.locationId && okLoc.has(s.locationId) ? s.locationId : null) ?? prevLoc.get(`${employee_id}|${s.date}|${slot}`) ?? null;
      const department_id = deptId(s.deptName, loc);
      return {
        company_id: company,
        employee_id,
        slot,
        ...(department_id ? { department_id } : {}),
        shift_type_id: typeId(s.shiftTypeName) ?? null,
        date: s.date,
        start_time: s.startTime,
        end_time: s.endTime,
        status: "published" as const,
        published: true,
        ...(loc ? { location_id: loc } : {}),
      };
    }).filter((r) => r.employee_id);

    if (rows.length) {
      const { error } = await supabase.from("shifts").insert(rows);
      if (error) return { ok: false, error: userError(error) };
    }
    await logAudit(supabase, company, user.id, {
      action: "schedule.publish", entity: "shifts", detail: `Vaktaplan birt — ${rows.length} vaktir`,
    });
    // Notify each scheduled employee (best-effort): push + email.
    const { data: co } = await supabase.from("companies").select("name").eq("id", company).maybeSingle();
    const companyName = (co?.name as string) || "Fyrirtækið þitt";
    for (const eid of [...new Set(rows.map((r) => r.employee_id).filter(Boolean))] as string[]) {
      void notifyEmployee(eid, { title: "Nýtt vaktaplan", body: "Vaktaplanið þitt hefur verið uppfært.", url: "/mitt-svaedi", tag: "schedule" });
      const emp = emps?.find((e) => e.id === eid);
      if (emp?.email) void sendSchedulePublishedEmail(emp.email as string, emp.full_name as string, companyName);
    }
    revalidatePath("/vaktaplan");
    return { ok: true, count: rows.length, skippedClosed };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export type DecisionResult = { ok: boolean; demo?: boolean; error?: string };

/** Afrit af eyddri vakt — svo „Afturkalla“ geti sett hana aftur inn nákvæmlega eins. */
export type ShiftSnap = {
  id?: string; employee_id: string | null; date: string; start_time: string | null; end_time: string | null;
  shift_type_id: string | null; status: string; published: boolean; note: string | null; location_id: string | null;
  slot?: number | null; department_id?: string | null;
  /** Útgefin vakt sem var aðeins merkt til eyðingar — „Afturkalla“ tekur merkið af í stað þess að setja inn. */
  pending?: boolean;
};
const SNAP_COLS = "id, employee_id, date, start_time, end_time, shift_type_id, status, published, note, location_id, slot, department_id";

type Sb = Awaited<ReturnType<typeof createClient>>;
/** Taka vaktir úr vinnuplaninu. Drögum er eytt strax; ÚTGEFNAR vaktir fá pending_delete og starfsfólk
 * sér þær áfram þar til planið er gefið út næst (þá er þeim eytt). Skilar afriti fyrir „Afturkalla“. */
async function retireShifts(supabase: Sb, rows: (ShiftSnap & { id: string })[]): Promise<{ snaps: ShiftSnap[]; error?: string }> {
  const drafts = rows.filter((r) => !r.published).map((r) => r.id);
  const pubs = rows.filter((r) => r.published).map((r) => r.id);
  for (let i = 0; i < drafts.length; i += 200) {
    const { error } = await supabase.from("shifts").delete().in("id", drafts.slice(i, i + 200));
    if (error) return { snaps: [], error: userError(error) };
  }
  for (let i = 0; i < pubs.length; i += 200) {
    const { error } = await supabase.from("shifts").update({ pending_delete: true }).in("id", pubs.slice(i, i + 200));
    if (error) return { snaps: [], error: userError(error) };
  }
  return { snaps: rows.map((r) => (r.published ? { ...r, pending: true } : r)) };
}


/** Load the grid (employee × 7 days) for a specific week, aligned to the
 * full_name-ordered employee list (same order the screen renders). Returns
 * both the coarse code grid (for colour) and the real start/end times per cell. */
/** Veltuspá + launamarkmið vikunnar og kostnaður per klst — fyrir launaáætlunina. */
/** `depts` (valfrjálst): deildir sem vaktaplanið er síað á → spáin miðast við staði þeirra deilda. */
export async function getWeekBudget(monISO: string, depts?: string[] | null, locationIds?: string[] | null): Promise<WeekBudget | null> {
  if (!isSupabaseConfigured() || !/^\d{4}-\d{2}-\d{2}$/.test(monISO)) return null;
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return null;
    let locIds: string[] | null = null;
    const names = (depts ?? []).map((d) => d.trim()).filter(Boolean).slice(0, 50);
    const picked = (locationIds ?? []).filter((x) => UUID_RE.test(x)).slice(0, 50);
    if (picked.length) {
      locIds = picked; // laborWeekBudget heldur aðeins stöðum fyrirtækisins
    } else if (names.length) {
      const { data } = await supabase.from("departments").select("location_id, locations!inner(company_id)").eq("locations.company_id", ctx.company).in("name", names);
      locIds = [...new Set((data ?? []).map((r) => r.location_id as string).filter(Boolean))];
      if (!locIds.length) locIds = null;
    }
    return await laborWeekBudget(supabase, ctx.company, monISO, locIds);
  } catch (e) {
    console.error("getWeekBudget", e);
    return null;
  }
}

export async function getWeekShifts(fromISO: string): Promise<{ ok: boolean; grid: string[][]; times: Record<string, { start: string; end: string }>; cellTypes?: Record<string, string>; cellLocs?: Record<string, string>; cellDepts?: Record<string, string>; extras?: Record<string, ExtraShift[]>; names?: string[]; inits?: string[]; ids?: string[]; unavail?: Record<string, number[]>; drafts?: string[] }> {
  if (!isSupabaseConfigured()) return { ok: false, grid: [], times: {} };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, grid: [], times: {} };
    const { live, list: employees } = await planEmployees();
    if (!live) return { ok: false, grid: [], times: {} };

    const [y, m, d] = fromISO.split("-").map(Number);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(y, m - 1, d + i);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    });
    const { data: shifts } = await allRows((a, b) => supabase
      .from("shifts").select("id, employee_id, date, start_time, end_time, published, location_id, slot, shift_types(name), departments(name)")
      .eq("company_id", ctx.company).eq("pending_delete", false).in("date", dates).order("id").range(a, b));

    const idIndex = new Map(employees.map((e, i) => [e.id, i]));
    // Vaktategund + staður + deild hverrar vaktar fylgja (0109/0110); fleiri vaktir sama dag fara í `extras`.
    const cells = buildWeekCells(shifts ?? [], idIndex, dates, employees.length);
    // The client's grid rows may be a SUBSET of the full roster (only staff on
    // the plan) — return names so it can remap rows instead of assuming order.
    const names = employees.map((e) => e.name);
    const inits = employees.map((e) => e.init);
    const ids = employees.map((e) => e.id);
    const unavail = await getWeekUnavail(dates);
    return { ok: true, ...cells, names, inits, ids, unavail };
  } catch {
    return { ok: false, grid: [], times: {} };
  }
}

/** Save a single shift (from the shift-edit modal). */
export type ShiftTypeInput = { nm: string; t: string; prem: string; fg: string; bg: string; bd: string };

/** Persist the company's shift types (upsert by name; delete removed ones
 * when no shift references them). */
export async function saveShiftTypes(list: ShiftTypeInput[]): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: existing } = await supabase.from("shift_types").select("id, name").eq("company_id", ctx.company);
    const byName = new Map((existing ?? []).map((x) => [(x.name as string).toLowerCase(), x.id as string]));
    const keep = new Set<string>();
    for (const ty of list) {
      const [a, z] = (ty.t || "").split("–");
      const unbound = !ty.t || ty.t === "–";
      const row = {
        company_id: ctx.company, name: ty.nm,
        start_time: unbound ? null : (a?.trim() || null), end_time: unbound ? null : (z?.trim() || null),
        premium_label: ty.prem, color: ty.fg, bg: ty.bg, border: ty.bd,
      };
      const id = byName.get(ty.nm.toLowerCase());
      if (id) { keep.add(id); await supabase.from("shift_types").update(row).eq("id", id); }
      else {
        const { data: ins } = await supabase.from("shift_types").insert(row).select("id").maybeSingle();
        if (ins?.id) keep.add(ins.id as string);
      }
    }
    for (const x of existing ?? []) {
      if (!keep.has(x.id as string)) await supabase.from("shift_types").delete().eq("id", x.id); // FK-guarded: fails silently if referenced
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function saveShift(input: Omit<ShiftInput, "date"> & { date?: string }): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emps } = await supabase
      .from("employees").select("id, full_name").eq("company_id", ctx.company);
    const { data: types } = await supabase
      .from("shift_types").select("id, name").eq("company_id", ctx.company);
    const employee_id = pickEmployee(emps, input.employeeName);
    if (!employee_id) return { ok: false, error: NO_EMP };
    const shift_type_id = pickType(types, input.shiftTypeName);
    const shiftDate = input.date || new Date().toISOString().slice(0, 10);
    {
      const cl = await closedCtx(supabase, ctx.company, shiftDate, shiftDate);
      const c = cl.hit(shiftDate, employee_id);
      if (c) return { ok: false, error: closedMsg(c, shiftDate) };
    }
    // Ný eða breytt vakt er DRÖG — starfsfólk sér hana ekki fyrr en planið er gefið út.
    // Undantekning: aðeins vaktategund (litur/álag) breytt á útgefinni vakt — tímarnir eru þeir sömu.
    // Útgefna vaktin í reitnum helst hjá starfsfólki (pending_delete) þar til nýtt plan er gefið út.
    const slot = slotOf(input.slot);
    const { data: cell } = await supabase.from("shifts").select("id, start_time, end_time, published, pending_delete, location_id, department_id")
      .eq("company_id", ctx.company).eq("employee_id", employee_id).eq("date", shiftDate).eq("slot", slot);
    // Staður: sá sem var valinn í planinu, annars sá sem vaktin hafði (trigger setur stað starfsmanns ef hvorugt).
    const okLoc = await companyLocIds(supabase, ctx.company);
    const pickedLoc = input.locationId && okLoc.has(input.locationId) ? input.locationId : null;
    const location_id = pickedLoc ?? ((cell ?? []).find((r) => !r.pending_delete && r.location_id)?.location_id as string | undefined) ?? null;
    // Deild: valin í planinu (undefined = sú sem vaktin hafði; tómt = aðaldeild starfsmanns).
    const deptId = await deptResolver(supabase, ctx.company);
    const department_id = input.deptName === undefined
      ? (((cell ?? []).find((r) => !r.pending_delete && r.department_id)?.department_id as string | undefined) ?? null)
      : deptId(input.deptName, location_id);
    const deptPatch = input.deptName === undefined ? {} : { department_id };
    const sameTimes = (r: { start_time: unknown; end_time: unknown }) => hm(r.start_time) === hm(input.startTime) && hm(r.end_time) === hm(input.endTime);
    const live = (cell ?? []).filter((r) => !r.pending_delete);
    const livePub = live.find((r) => r.published);
    const liveDrafts = live.filter((r) => !r.published).map((r) => r.id as string);
    const retired = (cell ?? []).find((r) => r.pending_delete && sameTimes(r));
    let error: { message: string } | null = null;
    if (livePub && sameTimes(livePub)) {
      // Aðeins vaktategund (litur/álag) breytt — vaktin helst útgefin.
      ({ error } = await supabase.from("shifts").update({ shift_type_id: shift_type_id ?? null, ...deptPatch, ...(pickedLoc ? { location_id: pickedLoc } : {}) }).eq("id", livePub.id as string));
    } else if (!livePub && retired) {
      // Breytt aftur í útgefnu útgáfuna — engin drög, útgefna vaktin lifnar við.
      if (liveDrafts.length) await supabase.from("shifts").delete().in("id", liveDrafts);
      ({ error } = await supabase.from("shifts").update({ pending_delete: false, shift_type_id: shift_type_id ?? null, ...deptPatch, ...(pickedLoc ? { location_id: pickedLoc } : {}) }).eq("id", retired.id as string));
    } else {
      if (livePub) ({ error } = await supabase.from("shifts").update({ pending_delete: true }).eq("id", livePub.id as string));
      if (!error && liveDrafts.length) ({ error } = await supabase.from("shifts").delete().in("id", liveDrafts));
      if (!error) ({ error } = await supabase.from("shifts").insert({
        company_id: ctx.company, employee_id, shift_type_id: shift_type_id ?? null, date: shiftDate,
        start_time: input.startTime, end_time: input.endTime, status: "draft", published: false, slot,
        ...(location_id ? { location_id } : {}), ...(department_id ? { department_id } : {}),
      }));
    }
    if (error) return { ok: false, error: userError(error) };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "shift.save", entity: "shift", detail: `Vakt vistuð — ${input.employeeName} ${input.startTime}–${input.endTime}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Set the weekly staffing need (7 numbers, Mon..Sun). */
export async function setStaffingTargets(targets: number[]): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const clean = Array.from({ length: 7 }, (_, i) => Math.max(0, Math.round(Number(targets[i]) || 0)));
    const { error } = await supabase.from("companies").update({ staffing_targets: clean }).eq("id", ctx.company);
    if (error) return { ok: false, error: "Aðgerðin tókst ekki — reyndu aftur eða hafðu samband við VAKTO." };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "staffing.set", entity: "company", detail: `Mönnunarþörf uppfærð — ${clean.join("/")}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Delete a single set shift (one employee, one day). */
export async function deleteShift(input: { employeeName: string; dateISO: string; slot?: number }): Promise<DecisionResult & { deleted?: ShiftSnap[] }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emps } = await supabase
      .from("employees").select("id, full_name").eq("company_id", ctx.company);
    const employee_id = pickEmployee(emps, input.employeeName);
    if (!employee_id) return { ok: false, error: NO_EMP };
    // slot gefið → aðeins sú vakt; annars allar vaktir dagsins (eldri köll, „fjarlægja úr plani“).
    let q = supabase.from("shifts").select(SNAP_COLS)
      .eq("company_id", ctx.company).eq("employee_id", employee_id).eq("date", input.dateISO).eq("pending_delete", false);
    if (input.slot !== undefined) q = q.eq("slot", slotOf(input.slot));
    const { data: cell } = await q;
    const { snaps: gone, error } = await retireShifts(supabase, (cell ?? []) as unknown as (ShiftSnap & { id: string })[]);
    if (error) return { ok: false, error };
    if (input.slot !== undefined) {
      // Vaktirnar á eftir færast upp um eitt sæti — planið heldur númerunum samfelldum (0, 1, …).
      const { data: later } = await supabase.from("shifts").select("id, slot")
        .eq("company_id", ctx.company).eq("employee_id", employee_id).eq("date", input.dateISO).eq("pending_delete", false)
        .gt("slot", slotOf(input.slot)).order("slot");
      for (const r of later ?? []) await supabase.from("shifts").update({ slot: (Number(r.slot) || 1) - 1 }).eq("id", r.id as string);
    }
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "shift.delete", entity: "shift", detail: `Vakt eydd — ${input.employeeName} ${input.dateISO}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true, deleted: gone };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export type ExportRow = { name: string; first: string; dept: string; date: string; start: string; end: string; type?: string; employeeId?: string; locationId?: string; slot?: number };

/** Real shift rows (with actual times) in a date range — for PDF export. */
export async function getShiftsInRange(fromISO: string, toISO: string): Promise<{ ok: boolean; rows: ExportRow[] }> {
  if (!isSupabaseConfigured()) return { ok: false, rows: [] };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, rows: [] };
    const { employees, live } = await getEmployees();
    if (!live) return { ok: false, rows: [] };
    const meta = new Map(employees.map((e) => [e.id, { full: e.fullName, first: e.fullName.split(/\s+/)[0], dept: e.department ?? "" }]));
    const { data: shifts } = await allRows((a, b) => supabase
      .from("shifts").select("id, employee_id, date, start_time, end_time, location_id, slot, shift_types(name), departments(name)")
      .eq("company_id", ctx.company).eq("pending_delete", false).gte("date", fromISO).lte("date", toISO)
      .order("date").order("start_time").order("id").range(a, b));
    const rows: ExportRow[] = (shifts ?? []).map((s) => {
      const m = meta.get(s.employee_id as string);
      return {
        // Deild vaktarinnar (0110) ef hún er skráð, annars aðaldeild starfsmanns.
        name: m?.full ?? "?", first: m?.first ?? "?", dept: ((s.departments as unknown as { name?: string } | null)?.name) || m?.dept || "", employeeId: (s.employee_id as string | null) ?? undefined,
        slot: Number(s.slot) || 0,
        locationId: (s.location_id as string | null) ?? undefined,
        date: s.date as string,
        start: ((s.start_time as string) ?? "").slice(0, 5),
        end: ((s.end_time as string) ?? "").slice(0, 5),
        type: ((s.shift_types as unknown as { name?: string } | null)?.name) ?? undefined,
      };
    });
    return { ok: true, rows };
  } catch {
    return { ok: false, rows: [] };
  }
}

export type PlanShift = { id: string; employeeId: string; date: string; start: string; end: string; type: string | null; draft?: boolean; slot: number; dept?: string | null };
export type PlanLeave = { employeeId: string; from: string; to: string; type: string };

/** Mánaðarplanið: allt virkt starfsfólk + vaktir og samþykkt frí á tímabilinu, allt eftir id. */
export async function getPlan(fromISO: string, toISO: string): Promise<{ ok: boolean; employees: PlanEmp[]; shifts: PlanShift[]; leave: PlanLeave[] }> {
  const empty = { ok: false, employees: [], shifts: [], leave: [] };
  if (!isSupabaseConfigured() || !ISO_RE.test(fromISO) || !ISO_RE.test(toISO)) return empty;
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return empty;
    const { live, list } = await planEmployees();
    if (!live) return empty;
    const { data: rows } = await allRows((a, b) => supabase
      .from("shifts").select("id, employee_id, date, start_time, end_time, published, slot, shift_types(name), departments(name)")
      .eq("company_id", ctx.company).eq("pending_delete", false).not("employee_id", "is", null).gte("date", fromISO).lte("date", toISO)
      .order("date").order("slot").order("start_time").order("id").range(a, b));
    const shifts: PlanShift[] = (rows ?? []).map((s) => ({
      draft: s.published === false,
      id: s.id as string, employeeId: s.employee_id as string, date: s.date as string,
      start: ((s.start_time as string) ?? "").slice(0, 5), end: ((s.end_time as string) ?? "").slice(0, 5),
      type: ((s.shift_types as unknown as { name?: string } | null)?.name) ?? null,
      slot: Number(s.slot) || 0, dept: ((s.departments as unknown as { name?: string } | null)?.name) ?? null,
    }));
    const { data: lv } = await supabase.from("leave_requests").select("employee_id, from_date, to_date, type")
      .eq("company_id", ctx.company).eq("status", "approved").lte("from_date", toISO).gte("to_date", fromISO);
    const leave: PlanLeave[] = (lv ?? []).map((l) => ({ employeeId: l.employee_id as string, from: l.from_date as string, to: l.to_date as string, type: (l.type as string) ?? "" }));
    return { ok: true, employees: list, shifts, leave };
  } catch (e) {
    console.error("getPlan", e);
    return empty;
  }
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Afrita vaktir dag fyrir dag: `pairs` = [frá, til]. Notað fyrir „afrita síðasta mánuð“ og „endurtaka
 * viku út mánuðinn“. overwrite = eyða vöktum sem fyrir eru á markdögum (aðeins hjá `employeeIds` ef gefið);
 * annars bætast vaktir aðeins þar sem starfsmaðurinn er ekki þegar á vakt. Aldrei vakt ofan á samþykkt frí. */
export async function copyShifts(input: { pairs: [string, string][]; employeeIds?: string[]; overwrite: boolean }): Promise<{ ok: boolean; demo?: boolean; count?: number; skippedLeave?: number; skippedClosed?: number; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: 0 };
  const pairs = (input.pairs ?? []).filter(([a, b]) => ISO_RE.test(a) && ISO_RE.test(b) && a !== b).slice(0, 93);
  if (!pairs.length) return { ok: false, error: "Engir dagar til að afrita" };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const only = input.employeeIds?.length ? new Set(input.employeeIds) : null;
    const src = [...new Set(pairs.map((p) => p[0]))], dst = [...new Set(pairs.map((p) => p[1]))];
    const { data: srcRows } = await allRows((a, b) => supabase.from("shifts")
      .select("employee_id, date, start_time, end_time, shift_type_id, location_id, slot, department_id")
      .eq("company_id", ctx.company).eq("pending_delete", false).not("employee_id", "is", null).in("date", src).order("id").range(a, b));
    const { data: dstRows } = await allRows((a, b) => supabase.from("shifts")
      .select(SNAP_COLS).eq("company_id", ctx.company).eq("pending_delete", false).not("employee_id", "is", null).in("date", dst).order("id").range(a, b));
    const { data: lv } = await supabase.from("leave_requests").select("employee_id, from_date, to_date")
      .eq("company_id", ctx.company).eq("status", "approved").lte("from_date", dst.reduce((a, b) => (a > b ? a : b))).gte("to_date", dst.reduce((a, b) => (a < b ? a : b)));
    const onLeave = (eid: string, d: string) => (lv ?? []).some((l) => l.employee_id === eid && (l.from_date as string) <= d && (l.to_date as string) >= d);
    const taken = new Set((dstRows ?? []).filter((r) => !only || only.has(r.employee_id as string)).map((r) => `${r.employee_id}|${r.date}`));
    const toOf = new Map<string, string[]>();
    for (const [a, b] of pairs) (toOf.get(a) ?? toOf.set(a, []).get(a)!).push(b);
    let skippedLeave = 0, skippedClosed = 0;
    const sortedDst = [...dst].sort();
    const cl = await closedCtx(supabase, ctx.company, sortedDst[0], sortedDst[sortedDst.length - 1]);
    const rows: Record<string, unknown>[] = [];
    for (const s of srcRows ?? []) {
      const eid = s.employee_id as string;
      if (only && !only.has(eid)) continue;
      for (const d of toOf.get(s.date as string) ?? []) {
        if (!input.overwrite && taken.has(`${eid}|${d}`)) continue;
        if (onLeave(eid, d)) { skippedLeave++; continue; }
        if (cl.hit(d, eid)) { skippedClosed++; continue; }
        rows.push({ company_id: ctx.company, employee_id: eid, shift_type_id: s.shift_type_id ?? null, date: d,
          start_time: s.start_time, end_time: s.end_time, status: "draft", published: false, // drög þar til planið er gefið út
          slot: slotOf(s.slot), ...(s.department_id ? { department_id: s.department_id } : {}),
          ...(s.location_id ? { location_id: s.location_id } : {}) });
      }
    }
    if (input.overwrite) {
      const old = (dstRows ?? []).filter((r) => !only || only.has(r.employee_id as string)) as unknown as (ShiftSnap & { id: string })[];
      const { error } = await retireShifts(supabase, old);
      if (error) return { ok: false, error };
    }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("shifts").insert(rows.slice(i, i + 500));
      if (error) return { ok: false, error: userError(error) };
    }
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "schedule.copy", entity: "shifts", detail: `Vaktir afritaðar — ${rows.length} vaktir á ${dst.length} daga (${dst[0]}…)`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true, count: rows.length, skippedLeave, skippedClosed };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Eyða vöktum á dögum — aðeins hjá `employeeIds` ef gefið (t.d. deildin sem er síuð). Lausar vaktir haldast. */
export async function clearShifts(input: { dates: string[]; employeeIds?: string[] }): Promise<{ ok: boolean; demo?: boolean; count?: number; deleted?: ShiftSnap[]; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: 0 };
  const dates = (input.dates ?? []).filter((d) => ISO_RE.test(d)).slice(0, 93);
  if (!dates.length) return { ok: false, error: "Engar dagsetningar" };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    let q = supabase.from("shifts").select(SNAP_COLS).eq("company_id", ctx.company).eq("pending_delete", false).not("employee_id", "is", null).in("date", dates);
    if (input.employeeIds?.length) q = q.in("employee_id", input.employeeIds);
    const { data: rows } = await q;
    const { snaps: gone, error } = await retireShifts(supabase, (rows ?? []) as unknown as (ShiftSnap & { id: string })[]);
    if (error) return { ok: false, error };
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "schedule.clear", entity: "shifts", detail: `Vaktir hreinsaðar — ${gone.length} vaktir (${dates[0]}…${dates[dates.length - 1]})`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true, count: gone.length, deleted: gone };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export type OpenShiftClaim = { id: string; employeeId: string; name: string; status: string; at: string };
export type OpenShift = { id: string; date: string; start: string; end: string; type: string | null; note: string | null; claims: OpenShiftClaim[] };

/** Lausar vaktir (án starfsmanns) á tímabili, með umsóknum. */
export async function getOpenShifts(fromISO: string, toISO: string): Promise<{ ok: boolean; shifts: OpenShift[] }> {
  if (!isSupabaseConfigured()) return { ok: true, shifts: [] };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, shifts: [] };
    const { data: rows } = await supabase.from("shifts")
      .select("id, date, start_time, end_time, note, shift_types(name)")
      .eq("company_id", ctx.company).is("employee_id", null).gte("date", fromISO).lte("date", toISO)
      .order("date").order("start_time");
    const ids = (rows ?? []).map((r) => r.id as string);
    const { data: claims } = ids.length
      ? await supabase.from("shift_claims").select("id, shift_id, employee_id, status, created_at, employees(full_name)").in("shift_id", ids).order("created_at")
      : { data: [] as Record<string, unknown>[] };
    const shifts: OpenShift[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      date: r.date as string,
      start: ((r.start_time as string) ?? "").slice(0, 5),
      end: ((r.end_time as string) ?? "").slice(0, 5),
      type: ((r.shift_types as unknown as { name?: string } | null)?.name) ?? null,
      note: (r.note as string) ?? null,
      claims: (claims ?? []).filter((c) => c.shift_id === r.id && c.status === "pending").map((c) => ({
        id: c.id as string, employeeId: c.employee_id as string, status: c.status as string, at: c.created_at as string,
        name: ((c.employees as unknown as { full_name?: string } | null)?.full_name) ?? "",
      })),
    }));
    return { ok: true, shifts };
  } catch {
    return { ok: false, shifts: [] };
  }
}

const DAY_SHORT = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
const shiftLabel = (date: string, start: string, end: string) => {
  const d = new Date(`${date}T12:00:00`);
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1} ${start}–${end}`;
};

/** Stofnar lausa vakt (eða nokkrar eins) og lætur starfsfólk vita. */
export async function createOpenShift(input: { date: string; start: string; end: string; shiftTypeName?: string; note?: string; count?: number; locationId?: string | null }): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  return createOpenShifts({ ...input, dates: [input.date] });
}

/** Lausar vaktir á einum eða fleiri dögum (sama tími) — ein færsla og EIN tilkynning til starfsfólks.
 *  Notað af „Laus vakt“ í vaktaplani og VAKTO AI (create_open_shifts). */
export async function createOpenShifts(input: { dates: string[]; start: string; end: string; shiftTypeName?: string; note?: string; count?: number; locationId?: string | null }): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const dates = [...new Set(input.dates)].sort();
    if (!dates.length || dates.length > 31 || dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d)) || !/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end)) return { ok: false, error: "Veldu dag og tíma" };
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    let typeId: string | null = null;
    if (input.shiftTypeName) {
      const { data: t } = await supabase.from("shift_types").select("id, name").eq("company_id", ctx.company);
      typeId = (t?.find((x) => (x.name as string).toLowerCase() === input.shiftTypeName!.toLowerCase())?.id as string) ?? null;
    }
    {
      const cl = await closedCtx(supabase, ctx.company, dates[0], dates[dates.length - 1]);
      const bad = dates.find((d) => cl.hit(d, null));
      if (bad) return { ok: false, error: closedMsg(cl.hit(bad, null)!, bad) };
    }
    const n = Math.min(Math.max(Math.round(input.count ?? 1), 1), 10);
    const note = input.note?.trim().slice(0, 200) || null;
    const okLoc = await companyLocIds(supabase, ctx.company);
    const loc = input.locationId && okLoc.has(input.locationId) ? input.locationId : null;
    const rows = dates.flatMap((date) => Array.from({ length: n }, () => ({
      company_id: ctx.company, employee_id: null, shift_type_id: typeId, date,
      start_time: input.start, end_time: input.end, note, status: "published" as const, published: true,
      ...(loc ? { location_id: loc } : {}),
    })));
    const { error } = await supabase.from("shifts").insert(rows);
    if (error) return { ok: false, error: userError(error) };
    const label = dates.length === 1
      ? shiftLabel(dates[0], input.start, input.end)
      : `${shiftLabel(dates[0], input.start, input.end).split(" ").slice(0, 2).join(" ")}–${shiftLabel(dates[dates.length - 1], input.start, input.end)}`;
    const total = rows.length;
    await logAudit(supabase, ctx.company, ctx.userId, { action: "shift.open", entity: "shift", detail: `Laus vakt stofnuð — ${label}${total > 1 ? ` (${total})` : ""}` });
    void notifyEmployees(ctx.company, { title: total > 1 ? "Lausar vaktir" : "Laus vakt", body: `${label}${total > 1 ? ` · ${total} vaktir` : ""}${note ? ` · ${note}` : ""}. Sæktu um í appinu.`, url: "/mitt-svaedi", tag: "open-shift" });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Eyðir lausri vakt (umsóknir fara með). */
export async function deleteOpenShift(id: string): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { error } = await supabase.from("shifts").delete().eq("id", id).eq("company_id", ctx.company).is("employee_id", null);
    if (error) return { ok: false, error: userError(error) };
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Úthlutar lausri vakt til umsækjanda; öðrum umsóknum er hafnað (approve_shift_claim, 0082). */
export async function assignOpenShift(claimId: string): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: claim } = await supabase.from("shift_claims")
      .select("shift_id, employee_id, shifts(date, start_time, end_time), employees(full_name)").eq("id", claimId).maybeSingle();
    const { error } = await supabase.rpc("approve_shift_claim", { p_claim: claimId });
    if (error) {
      if (/SHIFT_TAKEN/.test(error.message)) return { ok: false, error: "Búið er að úthluta þessari vakt" };
      return { ok: false, error: userError(error) };
    }
    const sh = claim?.shifts as unknown as { date: string; start_time: string; end_time: string } | null;
    const label = sh ? shiftLabel(sh.date, sh.start_time.slice(0, 5), sh.end_time.slice(0, 5)) : "";
    const others = await supabase.from("shift_claims").select("employee_id").eq("shift_id", claim?.shift_id as string).eq("status", "rejected");
    void notifyEmployee(claim?.employee_id as string | undefined, { title: "Þú fékkst vaktina", body: `${label} er komin á planið þitt.`, url: "/mitt-svaedi", tag: "open-shift" });
    for (const o of others.data ?? []) void notifyEmployee(o.employee_id as string, { title: "Vaktinni var úthlutað", body: `${label} fór til annars starfsmanns.`, url: "/mitt-svaedi", tag: "open-shift" });
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "shift.assign", entity: "shift", entityId: claim?.shift_id as string | undefined,
      detail: `Laus vakt úthlutuð — ${((claim?.employees as unknown as { full_name?: string } | null)?.full_name) ?? ""} (${label})`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

async function companyOf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company };
}

/** Lokaðir dagar fyrirtækisins á bili (0107) + staður hvers starfsmanns — tómt ef taflan er ekki til. */
async function closedCtx(supabase: Awaited<ReturnType<typeof createClient>>, company: string, from: string, to: string) {
  const { data, error } = await supabase.from("closed_days").select("id, location_id, from_date, to_date, label, locations(name)")
    .eq("company_id", company).lte("from_date", to).gte("to_date", from);
  const list: ClosedDay[] = error ? [] : (data ?? []).map((c) => ({
    id: c.id as string, locationId: (c.location_id as string | null) ?? null, from: String(c.from_date).slice(0, 10), to: String(c.to_date).slice(0, 10),
    label: (c.label as string | null) ?? null, location: ((Array.isArray(c.locations) ? c.locations[0] : c.locations) as { name?: string } | null)?.name ?? null,
  }));
  const locOf = new Map<string, string | null>();
  if (list.some((c) => c.locationId)) {
    const { data: emps } = await supabase.from("employees").select("id, location_id").eq("company_id", company);
    for (const e of emps ?? []) locOf.set(e.id as string, (e.location_id as string | null) ?? null);
  }
  const hit = (date: string, employeeId: string | null, locationId?: string | null) =>
    list.length ? closedOn(list, date, locationId ?? (employeeId ? locOf.get(employeeId) ?? null : null)) : null;
  return { list, hit };
}
const closedMsg = (c: ClosedDay, date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `Lokað er ${d}.${m}.${y} (${closedText(c)}) — ekki hægt að setja vakt á þann dag.`;
};

/** Lokaðir dagar á bili — fyrir merkingar í vaktaplani. */
export async function getClosedDays(fromISO: string, toISO: string): Promise<{ ok: boolean; days: ClosedDay[] }> {
  if (!isSupabaseConfigured() || !ISO_RE.test(fromISO) || !ISO_RE.test(toISO)) return { ok: false, days: [] };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, days: [] };
    const { list } = await closedCtx(supabase, ctx.company, fromISO, toISO);
    return { ok: true, days: list };
  } catch {
    return { ok: false, days: [] };
  }
}

/** Manager approves or rejects a leave request. */
export async function updateLeaveRequest(id: string, approved: boolean): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const status = approved ? "approved" : "rejected";
    const { data: updated, error } = await supabase
      .from("leave_requests").update({ status }).eq("id", id).eq("company_id", ctx.company)
      .select("employee_id, type, from_date, to_date, employees(full_name, email)").maybeSingle();
    if (error) return { ok: false, error: userError(error) };
    // Veikindi samþykkt (t.d. tilkynnt af vakt í appinu): vaktir starfsmannsins þá daga verða lausar vaktir
    // og starfsfólk fær tilkynningu — sama og „Tilkynnti veikindi“ í Vaktaplani.
    let freed = 0;
    const sickType = updated?.type === "veikindi" || updated?.type === "veikindi_barns";
    if (approved && sickType && updated?.employee_id) {
      const { data: fr } = await supabase.from("shifts")
        .update({ employee_id: null, note: `Laus vegna fjarvistar (${updated.type === "veikindi" ? "veikindi" : "veikindi barns"})` })
        .eq("company_id", ctx.company).eq("employee_id", updated.employee_id as string)
        .gte("date", updated.from_date as string).lte("date", updated.to_date as string).select("id");
      freed = fr?.length ?? 0;
      if (freed && (updated.to_date as string) >= new Date().toISOString().slice(0, 10)) {
        void notifyEmployees(ctx.company, { title: freed > 1 ? "Lausar vaktir" : "Laus vakt", body: `${freed > 1 ? `${freed} vaktir` : "Vakt"} laus vegna forfalla. Sæktu um í appinu.`, url: "/mitt-svaedi", tag: "open-shift" });
      }
    }
    // Notify the employee (best-effort): push + email.
    const decEmp = (Array.isArray(updated?.employees) ? updated?.employees[0] : updated?.employees) as { full_name?: string; email?: string } | null;
    if (decEmp?.email) void sendLeaveDecisionEmail(decEmp.email, decEmp.full_name ?? "", approved);
    void notifyEmployee(updated?.employee_id as string | undefined, {
      title: sickType ? (approved ? "Veikindi skráð" : "Veikindatilkynningu hafnað") : approved ? "Frí samþykkt" : "Frí hafnað",
      body: sickType ? (approved ? "Vaktstjóri skráði veikindin. Láttu þér batna!" : "Hafðu samband við vaktstjóra.") : approved ? "Frí-beiðnin þín var samþykkt." : "Frí-beiðninni þinni var hafnað.",
      url: "/mitt-svaedi",
    });
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "leave.decide", entity: "leave_request", entityId: id,
      detail: `${sickType ? "Veikindi" : "Frí-beiðni"} ${approved ? "samþykkt" : "hafnað"}${freed ? ` · ${freed} ${freed === 1 ? "vakt varð laus" : "vaktir urðu lausar"}` : ""}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Vaktstjóri samþykkir vaktaskipti / beiðni um að losna við vakt:
 *  • beiðni tengd vakt án mótaðila („Get ekki tekið vaktina“, „Bjóða vaktina“) → vaktin verður laus vakt, starfsfólk fær push;
 *  • tvær vaktir (requester ↔ requestee) → starfsmönnum víxlað;
 *  • eldri textabeiðnir (engin vakt) → aðeins merktar samþykktar. Beiðandinn fær tilkynningu. */
export async function approveShiftSwap(id: string): Promise<DecisionResult> {
  return decideShiftSwap(id, true);
}
export async function rejectShiftSwap(id: string): Promise<DecisionResult> {
  return decideShiftSwap(id, false);
}
async function decideShiftSwap(id: string, approved: boolean): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: swap, error } = await supabase
      .from("shift_swaps").update({ status: approved ? "approved" : "rejected" }).eq("id", id).eq("company_id", ctx.company).eq("status", "pending")
      .select("requester_id, requestee_id, requester_shift_id, requestee_shift_id").maybeSingle();
    if (error) return { ok: false, error: userError(error) };
    if (!swap) return { ok: false, error: "Beiðnin fannst ekki eða hefur þegar verið afgreidd" };
    let what = "";
    if (approved && swap.requester_shift_id && !swap.requestee_id) {
      const { data: sh } = await supabase.from("shifts").update({ employee_id: null, note: "Laus vakt — starfsmaður losaði vaktina" })
        .eq("id", swap.requester_shift_id as string).eq("company_id", ctx.company).eq("employee_id", swap.requester_id as string)
        .select("date").maybeSingle();
      if (sh) {
        what = " · vaktin varð laus";
        if ((sh.date as string) >= new Date().toISOString().slice(0, 10)) {
          void notifyEmployees(ctx.company, { title: "Laus vakt", body: `Vakt ${sh.date} er laus. Sæktu um í appinu.`, url: "/mitt-svaedi", tag: "open-shift" });
        }
      }
    } else if (approved && swap.requester_shift_id && swap.requestee_id && swap.requestee_shift_id) {
      await supabase.from("shifts").update({ employee_id: swap.requestee_id }).eq("id", swap.requester_shift_id as string).eq("company_id", ctx.company);
      await supabase.from("shifts").update({ employee_id: swap.requester_id }).eq("id", swap.requestee_shift_id as string).eq("company_id", ctx.company);
      what = " · vöktum víxlað";
    }
    void notifyEmployee(swap.requester_id as string, {
      title: approved ? "Beiðni samþykkt" : "Beiðni hafnað",
      body: approved ? (what.includes("laus") ? "Vaktstjóri samþykkti — vaktin er nú laus vakt og þú ert laus við hana." : "Vaktstjóri samþykkti beiðnina þína.") : "Vaktstjóri hafnaði beiðninni — vaktin er áfram þín.",
      url: "/mitt-svaedi",
    });
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: approved ? "swap.approve" : "swap.reject", entity: "shift_swap", entityId: id, detail: `Vaktabeiðni ${approved ? "samþykkt" : "hafnað"}${what}`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Wipe ALL shifts for the given dates — the "Eyða öllu / byrja upp á nýtt"
 * button in the schedule. Confirmed in the UI before calling. */
export async function deleteWeekShifts(dates: string[], locationIds?: string[]): Promise<{ ok: boolean; demo?: boolean; count?: number; deleted?: ShiftSnap[]; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  if (!dates.length) return { ok: false, error: "Engar dagsetningar" };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };
    // Lausar vaktir (employee_id null) haldast — þær eru ekki hluti af planinu sem kemur í staðinn.
    let q = supabase.from("shifts").select(SNAP_COLS)
      .eq("company_id", company).eq("pending_delete", false).in("date", dates).not("employee_id", "is", null);
    // Síað á stað (0109): aðeins vaktir valinna staða hreinsaðar.
    const locs = (locationIds ?? []).filter((x) => UUID_RE.test(x));
    if (locs.length) q = q.in("location_id", locs);
    const { data: rows } = await q;
    const { snaps: gone, error } = await retireShifts(supabase, (rows ?? []) as unknown as (ShiftSnap & { id: string })[]);
    if (error) return { ok: false, error };
    await logAudit(supabase, company, user.id, {
      action: "schedule.clear", entity: "shifts", detail: `Vika hreinsuð — ${gone.length} vaktir (${dates[0]}…)`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true, count: gone.length, deleted: gone };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/* ---------- shift tasks (checklists on a shift) ---------- */

export type ShiftTaskRow = { id: string; title: string; done: boolean };

/** Tasks for one employee+day (manager view in the shift modal). */
export async function getShiftTasks(employeeName: string, dateISO: string): Promise<{ ok: boolean; tasks: ShiftTaskRow[] }> {
  if (!isSupabaseConfigured()) return { ok: false, tasks: [] };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, tasks: [] };
    const { data: emps } = await supabase
      .from("employees").select("id, full_name").eq("company_id", ctx.company);
    const eid = pickEmployee(emps, employeeName);
    if (!eid) return { ok: false, tasks: [] };
    const { data } = await supabase
      .from("shift_tasks").select("id, title, done")
      .eq("employee_id", eid).eq("date", dateISO).order("created_at");
    return { ok: true, tasks: (data ?? []).map((r) => ({ id: r.id as string, title: r.title as string, done: !!r.done })) };
  } catch {
    return { ok: false, tasks: [] };
  }
}

/** Replace the checklist for employee+day. Existing rows with an unchanged
 * title survive (keeping their done state); removed ones are deleted. */
export async function saveShiftTasks(employeeName: string, dateISO: string, titles: string[]): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emps } = await supabase
      .from("employees").select("id, full_name").eq("company_id", ctx.company);
    const eid = pickEmployee(emps, employeeName);
    if (!eid) return { ok: false, error: NO_EMP };
    const clean = titles.map((s) => s.trim()).filter(Boolean);
    const { data: existing } = await supabase
      .from("shift_tasks").select("id, title").eq("employee_id", eid).eq("date", dateISO);
    const keep = new Set(clean);
    const toDelete = (existing ?? []).filter((r) => !keep.has(r.title as string)).map((r) => r.id as string);
    if (toDelete.length) await supabase.from("shift_tasks").delete().in("id", toDelete);
    const have = new Set((existing ?? []).map((r) => r.title as string));
    const toInsert = clean.filter((s) => !have.has(s)).map((title) => ({
      company_id: ctx.company, employee_id: eid, date: dateISO, title,
    }));
    if (toInsert.length) {
      const { error } = await supabase.from("shift_tasks").insert(toInsert);
      if (error) return { ok: false, error: userError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}


/* ── Planreglur fyrir AI-vaktaplan (0101) ─────────────────────────────────────────────── */

async function rulesCtx() {
  const supabase = await createClient();
  const ctx = await companyOf(supabase);
  if ("error" in ctx) return { error: ctx.error as string };
  const { data: me } = await supabase.from("users").select("role").eq("id", ctx.userId).maybeSingle();
  if (me?.role !== "owner" && me?.role !== "manager") return { error: "Aðeins stjórnendur og vaktstjórar sjá planreglur" };
  const { data, error } = await supabase.from("companies").select("planning_rules").eq("id", ctx.company).maybeSingle();
  if (error) return { error: "Planreglur eru ekki komnar í gagnagrunninn enn (0101)" };
  return { supabase, ctx, rules: normalizeRules((data as { planning_rules?: unknown } | null)?.planning_rules) };
}

async function saveRules(supabase: Awaited<ReturnType<typeof createClient>>, company: string, rules: PlanningRule[]): Promise<DecisionResult> {
  const { data, error } = await supabase.from("companies").update({ planning_rules: rules }).eq("id", company).select("id");
  if (error || !data?.length) return { ok: false, error: "Tókst ekki að vista planreglurnar" };
  revalidatePath("/vaktaplan");
  return { ok: true };
}

export async function listPlanningRules(): Promise<{ ok: boolean; rules: PlanningRule[]; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true, rules: [] };
  try {
    const r = await rulesCtx();
    if ("error" in r) return { ok: false, rules: [], error: r.error };
    return { ok: true, rules: r.rules };
  } catch (e) {
    return { ok: false, rules: [], error: userError(e, "Villa") };
  }
}

/** Ný regla (via = 'ai' þegar VAKTO AI vistar hana eftir staðfestingu notandans). */
export async function addPlanningRule(text: string, via: "user" | "ai" = "user"): Promise<DecisionResult & { rule?: PlanningRule }> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  const t = text.trim().replace(/\s+/g, " ").slice(0, MAX_RULE_LEN);
  if (t.length < 3) return { ok: false, error: "Skrifaðu regluna" };
  try {
    const r = await rulesCtx();
    if ("error" in r) return { ok: false, error: r.error };
    if (r.rules.length >= MAX_RULES) return { ok: false, error: `Mest ${MAX_RULES} reglur — eyddu gamalli reglu fyrst` };
    if (r.rules.some((x) => x.text.toLowerCase() === t.toLowerCase())) return { ok: false, error: "Þessi regla er þegar vistuð" };
    const rule: PlanningRule = { id: crypto.randomUUID(), text: t, active: true, createdAt: new Date().toISOString(), via };
    const res = await saveRules(r.supabase, r.ctx.company, [...r.rules, rule]);
    if (res.ok) await logAudit(r.supabase, r.ctx.company, r.ctx.userId, { action: "planning_rule.add", entity: "company", detail: t });
    return res.ok ? { ...res, rule } : res;
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function setPlanningRuleActive(id: string, active: boolean): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const r = await rulesCtx();
    if ("error" in r) return { ok: false, error: r.error };
    if (!r.rules.some((x) => x.id === id)) return { ok: false, error: "Reglan fannst ekki" };
    return saveRules(r.supabase, r.ctx.company, r.rules.map((x) => (x.id === id ? { ...x, active } : x)));
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

export async function deletePlanningRule(id: string): Promise<DecisionResult> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const r = await rulesCtx();
    if ("error" in r) return { ok: false, error: r.error };
    const gone = r.rules.find((x) => x.id === id);
    if (!gone) return { ok: false, error: "Reglan fannst ekki" };
    const res = await saveRules(r.supabase, r.ctx.company, r.rules.filter((x) => x.id !== id));
    if (res.ok) await logAudit(r.supabase, r.ctx.company, r.ctx.userId, { action: "planning_rule.delete", entity: "company", detail: gone.text });
    return res;
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/* ---------- drög, útgáfa og afturköllun ---------- */

const hm = (t: unknown) => String(t ?? "").slice(0, 5);

/** Fjöldi óútgefinna vakta (drög) á tímabili — fyrir „Gefa út plan (N)“. */
export async function getDraftCount(fromISO: string, toISO: string): Promise<{ ok: boolean; count: number }> {
  if (!isSupabaseConfigured() || !ISO_RE.test(fromISO) || !ISO_RE.test(toISO)) return { ok: false, count: 0 };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, count: 0 };
    const { count } = await supabase.from("shifts").select("id", { count: "exact", head: true })
      .eq("company_id", ctx.company).or("published.eq.false,pending_delete.eq.true").not("employee_id", "is", null)
      .gte("date", fromISO).lte("date", toISO);
    return { ok: true, count: count ?? 0 };
  } catch {
    return { ok: false, count: 0 };
  }
}

/** Gefa út planið fyrir tímabilið sem er opið: vöktum sem bíða eyðingar er eytt, öll drög verða
 * útgefin og starfsfólkið sem fékk nýjar/breyttar/fjarlægðar vaktir fær tilkynningu. */
export async function publishRange(fromISO: string, toISO: string): Promise<{ ok: boolean; demo?: boolean; count?: number; people?: number; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: 0 };
  if (!ISO_RE.test(fromISO) || !ISO_RE.test(toISO)) return { ok: false, error: "Ógilt tímabil" };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    // Fyrst hverfa útgefnar vaktir sem var eytt/breytt, svo verða drögin útgefin.
    const { data: gone, error: gErr } = await supabase.from("shifts").delete()
      .eq("company_id", ctx.company).eq("pending_delete", true).not("employee_id", "is", null)
      .gte("date", fromISO).lte("date", toISO).select("employee_id");
    if (gErr) return { ok: false, error: userError(gErr) };
    const { data: done, error } = await supabase.from("shifts").update({ status: "published", published: true })
      .eq("company_id", ctx.company).eq("published", false).not("employee_id", "is", null)
      .gte("date", fromISO).lte("date", toISO).select("employee_id");
    if (error) return { ok: false, error: userError(error) };
    const ids = [...new Set([...(done ?? []), ...(gone ?? [])].map((r) => r.employee_id as string).filter(Boolean))];
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "schedule.publish", entity: "shifts", detail: `Vaktaplan gefið út — ${done?.length ?? 0} vaktir, ${gone?.length ?? 0} fjarlægðar (${fromISO}…${toISO})`,
    });
    if (ids.length) {
      const { data: emps } = await supabase.from("employees").select("id, full_name, email").in("id", ids);
      const { data: co } = await supabase.from("companies").select("name").eq("id", ctx.company).maybeSingle();
      const companyName = (co?.name as string) || "Fyrirtækið þitt";
      for (const eid of ids) {
        void notifyEmployee(eid, { title: "Nýtt vaktaplan", body: "Vaktaplanið þitt hefur verið uppfært.", url: "/mitt-svaedi", tag: "schedule" });
        const emp = emps?.find((e) => e.id === eid);
        if (emp?.email) void sendSchedulePublishedEmail(emp.email as string, emp.full_name as string, companyName);
      }
    }
    revalidatePath("/vaktaplan");
    return { ok: true, count: (done?.length ?? 0) + (gone?.length ?? 0), people: ids.length };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** „Afturkalla“: setja eyddar vaktir aftur inn eins og þær voru. Sleppir reitum sem
 * hafa fengið nýja vakt í millitíðinni (skrifar aldrei yfir). */
export async function restoreShifts(rows: ShiftSnap[]): Promise<{ ok: boolean; demo?: boolean; count?: number; error?: string }> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: 0 };
  const list = (rows ?? []).filter((r) => r && ISO_RE.test(r.date) && r.employee_id).slice(0, 3000);
  if (!list.length) return { ok: true, count: 0 };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    // Aðeins starfsfólk þessa fyrirtækis.
    const empIds = [...new Set(list.map((r) => r.employee_id as string))];
    const { data: mine } = await supabase.from("employees").select("id").eq("company_id", ctx.company).in("id", empIds);
    const ok = new Set((mine ?? []).map((e) => e.id as string));
    const dates = [...new Set(list.map((r) => r.date))];
    const { data: taken } = await allRows((a, b) => supabase.from("shifts").select("employee_id, date, start_time, end_time, slot")
      .eq("company_id", ctx.company).eq("pending_delete", false).in("employee_id", empIds).in("date", dates).order("id").range(a, b));
    // Sama vakt (sami tími) þegar komin aftur → sleppt. Sætið (slot) tekið → næsta lausa (0110: fleiri vaktir á dag).
    const same = new Set((taken ?? []).map((t) => `${t.employee_id}|${t.date}|${hm(t.start_time)}|${hm(t.end_time)}`));
    const usedSlots = new Map<string, Set<number>>();
    for (const t of taken ?? []) { const k = `${t.employee_id}|${t.date}`; (usedSlots.get(k) ?? usedSlots.set(k, new Set()).get(k)!).add(Number(t.slot) || 0); }
    const slotFor = (r: ShiftSnap) => {
      const k = `${r.employee_id}|${r.date}`, used = usedSlots.get(k) ?? usedSlots.set(k, new Set()).get(k)!;
      let n = slotOf(r.slot); while (used.has(n) && n < 5) n++;
      used.add(n); return n;
    };
    const free = list.filter((r) => ok.has(r.employee_id as string) && !same.has(`${r.employee_id}|${r.date}|${hm(r.start_time)}|${hm(r.end_time)}`));
    // Útgefnar vaktir sem voru aðeins merktar: taka merkið af (ef þær eru enn til — annars setja inn).
    const pendIds = free.filter((r) => r.pending && r.id).map((r) => r.id as string);
    const revived = new Set<string>();
    for (let i = 0; i < pendIds.length; i += 200) {
      const { data: back, error } = await supabase.from("shifts").update({ pending_delete: false })
        .eq("company_id", ctx.company).eq("pending_delete", true).in("id", pendIds.slice(i, i + 200)).select("id");
      if (error) return { ok: false, error: userError(error) };
      for (const b of back ?? []) revived.add(b.id as string);
    }
    const ins = free.filter((r) => !(r.id && revived.has(r.id))).map((r) => ({
      company_id: ctx.company, employee_id: r.employee_id, date: r.date, start_time: r.start_time, end_time: r.end_time,
      shift_type_id: r.shift_type_id, status: r.published ? "published" : "draft", published: !!r.published,
      note: r.note, location_id: r.location_id, slot: slotFor(r), department_id: r.department_id ?? null,
    }));
    for (let i = 0; i < ins.length; i += 500) {
      const { error } = await supabase.from("shifts").insert(ins.slice(i, i + 500));
      if (error) return { ok: false, error: userError(error) };
    }
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "shift.restore", entity: "shifts", detail: `Eyðing afturkölluð — ${ins.length + revived.size} vaktir settar aftur inn`,
    });
    revalidatePath("/vaktaplan");
    return { ok: true, count: ins.length + revived.size };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
