import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyManagers } from "@/lib/push";

// VAKTO AI fyrir starfsfólk (appið): aðeins EIGIN gögn + hver úr hópnum er laus til að taka vakt.
// Engin laun/kennitölur annarra, engar ástæður (frí, veikindi) — bara „laus“ eða ekki.

type Db = Awaited<ReturnType<typeof createClient>>;
export type EmpCtx = { userId: string; employeeId: string; companyId: string; name: string; dept: string | null };
type In = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const okDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(v));
const minsOf = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + (m || 0); };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return iso(x); };

export async function employeeCtx(supabase: Db): Promise<EmpCtx | { error: string; status: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)", status: 401 };
  const { data: e } = await supabase.from("employees").select("id, company_id, full_name, status, departments(name)").eq("user_id", user.id).maybeSingle();
  if (!e || e.status === "inactive") return { error: "Enginn starfsmannaprófíll", status: 403 };
  const dep = (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } | null;
  return { userId: user.id, employeeId: e.id as string, companyId: e.company_id as string, name: ((e.full_name as string) ?? "").split(/\s+/)[0], dept: dep?.name ?? null };
}

export const EMPLOYEE_TOOLS: Anthropic.Tool[] = [
  { name: "my_shifts", description: "Mínar vaktir á tímabili (id, dagsetning, tími, tegund). Notaðu fyrir „hvenær er ég á vakt?“ og áður en vaktaskipti eru skoðuð.", input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }, required: ["from", "to"] } },
  { name: "my_hours", description: "Mínir stimplaðir tímar á tímabili (samtals klst og fjöldi stimplana).", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] } },
  { name: "who_can_cover", description: "Hver úr samstarfsfólkinu getur tekið EINA af mínum vöktum (shiftId úr my_shifts): ekki á vakt þann dag, ekki í fríi eða með óframboð, og 11 klst hvíld næst. Skilar nöfnum (sama deild fyrst), aldrei ástæðum.", input_schema: { type: "object", properties: { shiftId: { type: "string" } }, required: ["shiftId"] } },
  { name: "request_swap", description: "LEGGJA TIL beiðni um vaktaskipti til vaktstjóra fyrir eina af mínum vöktum, valfrjálst með samstarfsmanni sem gæti tekið hana. Ekkert sent fyrr en starfsmaðurinn ýtir á „Staðfesta“.", input_schema: { type: "object", properties: { shiftId: { type: "string" }, colleague: { type: "string", description: "Nafn samstarfsmanns (valfrjálst)" }, note: { type: "string", description: "Stutt skýring til vaktstjóra" } }, required: ["shiftId"] } },
];
export const EMPLOYEE_WRITE = new Set(["request_swap"]);

async function myShift(supabase: Db, me: EmpCtx, shiftId: string) {
  const { data } = await supabase.from("shifts").select("id, date, start_time, end_time, employee_id").eq("id", shiftId).maybeSingle();
  return data && data.employee_id === me.employeeId ? { id: data.id as string, date: data.date as string, start: String(data.start_time).slice(0, 5), end: String(data.end_time).slice(0, 5) } : null;
}

export async function runEmployeeRead(name: string, input: In, me: EmpCtx): Promise<string> {
  const supabase = await createClient();
  try {
    if (name === "my_shifts") {
      if (!okDate(input.from) || !okDate(input.to)) return JSON.stringify({ error: "from/to YYYY-MM-DD" });
      const { data } = await supabase.from("shifts").select("id, date, start_time, end_time, shift_types(name)").eq("employee_id", me.employeeId).gte("date", str(input.from)).lte("date", str(input.to)).order("date");
      return JSON.stringify((data ?? []).map((s) => ({ id: s.id, date: s.date, time: `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`, type: ((Array.isArray(s.shift_types) ? s.shift_types[0] : s.shift_types) as { name?: string } | null)?.name ?? null })));
    }
    if (name === "my_hours") {
      if (!okDate(input.from) || !okDate(input.to)) return JSON.stringify({ error: "from/to YYYY-MM-DD" });
      const { data } = await supabase.from("punches").select("clock_in, clock_out").eq("employee_id", me.employeeId).gte("clock_in", str(input.from)).lte("clock_in", `${str(input.to)}T23:59:59`);
      const closed = (data ?? []).filter((p) => p.clock_out);
      const h = closed.reduce((a, p) => a + (new Date(p.clock_out as string).getTime() - new Date(p.clock_in as string).getTime()) / 3600e3, 0);
      return JSON.stringify({ hours: Math.round(h * 10) / 10, punches: closed.length, open: (data ?? []).length - closed.length });
    }
    if (name === "who_can_cover") {
      const sh = await myShift(supabase, me, str(input.shiftId));
      if (!sh) return JSON.stringify({ error: "Vaktin fannst ekki meðal þinna vakta" });
      // Þjónustulykill: starfsmaður sér ekki frí/óframboð annarra (RLS) — hér er aðeins skilað „laus“.
      const admin = createAdminClient();
      const prev = addDays(sh.date, -1), next = addDays(sh.date, 1);
      const [{ data: emps }, { data: near }, { data: leave }, { data: avail }] = await Promise.all([
        admin.from("employees").select("id, full_name, status, role, departments(name)").eq("company_id", me.companyId),
        admin.from("shifts").select("employee_id, date, start_time, end_time").eq("company_id", me.companyId).in("date", [prev, sh.date, next]).not("employee_id", "is", null),
        admin.from("leave_requests").select("employee_id").eq("company_id", me.companyId).eq("status", "approved").lte("from_date", sh.date).gte("to_date", sh.date),
        admin.from("availability").select("employee_id, available, weekdays, from_date, to_date").eq("company_id", me.companyId).eq("available", false),
      ]);
      const wd = (new Date(`${sh.date}T12:00:00`).getDay() + 6) % 7;
      const onLeave = new Set((leave ?? []).map((l) => l.employee_id as string));
      const unavail = new Set((avail ?? []).filter((a) => (!a.from_date || a.from_date <= sh.date) && (!a.to_date || a.to_date >= sh.date) && (!(a.weekdays as number[] | null)?.length || (a.weekdays as number[]).includes(wd))).map((a) => a.employee_id as string));
      const sS = minsOf(sh.start); let sE = minsOf(sh.end); if (sE <= sS) sE += 1440;
      const busy = (id: string) => (near ?? []).some((x) => {
        if (x.employee_id !== id) return false;
        const a = minsOf(String(x.start_time).slice(0, 5)); let b = minsOf(String(x.end_time).slice(0, 5)); if (b <= a) b += 1440;
        if (x.date === sh.date) return true;
        if (x.date === prev) return sS + 1440 - (b) < 11 * 60; // hvíld eftir vakt gærdagsins
        return a + 1440 - sE < 11 * 60; // hvíld fyrir vakt morgundagsins
      });
      const free = (emps ?? []).filter((e) => e.id !== me.employeeId && e.status !== "inactive" && e.role !== "contractor" && !onLeave.has(e.id as string) && !unavail.has(e.id as string) && !busy(e.id as string))
        .map((e) => ({ name: e.full_name as string, dept: ((Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } | null)?.name ?? null }))
        .sort((a, b) => Number(b.dept === me.dept) - Number(a.dept === me.dept) || a.name.localeCompare(b.name, "is"));
      return JSON.stringify({ shift: sh, free: free.slice(0, 15), myDept: me.dept });
    }
    return JSON.stringify({ error: "Óþekkt verkfæri" });
  } catch (e) {
    console.error("[employee-ai tool]", name, e);
    return JSON.stringify({ error: "Tókst ekki að sækja gögnin" });
  }
}

export async function describeEmployeeWrite(name: string, input: In, me: EmpCtx): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  if (name !== "request_swap") return { ok: false, error: "Óþekkt aðgerð" };
  const sh = await myShift(await createClient(), me, str(input.shiftId));
  if (!sh) return { ok: false, error: "Vaktin fannst ekki meðal þinna vakta" };
  const [, m, d] = sh.date.split("-").map(Number);
  return { ok: true, summary: `Senda vaktstjóra beiðni um vaktaskipti: ${d}.${m}. kl. ${sh.start}–${sh.end}${str(input.colleague) ? ` — ${str(input.colleague)} gæti tekið hana` : ""}` };
}

export async function executeEmployeeWrite(name: string, input: In, me: EmpCtx): Promise<{ ok: boolean; error?: string }> {
  if (name !== "request_swap") return { ok: false, error: "Óþekkt aðgerð" };
  const supabase = await createClient();
  const sh = await myShift(supabase, me, str(input.shiftId));
  if (!sh) return { ok: false, error: "Vaktin fannst ekki meðal þinna vakta" };
  const [, m, d] = sh.date.split("-").map(Number);
  const note = [`${d}.${m}. ${sh.start}–${sh.end}`, str(input.colleague) && `${str(input.colleague)} gæti tekið hana`, str(input.note).slice(0, 300)].filter(Boolean).join(" · ");
  const { error } = await supabase.from("shift_swaps").insert({ company_id: me.companyId, requester_id: me.employeeId, requester_shift_id: sh.id, note, status: "pending" });
  if (error) return { ok: false, error: "Tókst ekki að senda beiðnina" };
  await notifyManagers(me.companyId, { title: "Beiðni um vaktaskipti", body: `${me.name}: ${note}`, url: "/vaktaplan" }).catch(() => {});
  return { ok: true };
}
