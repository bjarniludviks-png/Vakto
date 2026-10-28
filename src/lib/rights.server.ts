import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrlofBalances } from "@/lib/orlof.server";
import type { OrlofBalance } from "@/lib/orlof";
import {
  AGREEMENTS, familyFor, birthDateFromKennitala, orlofRight, sickRight, childSickRight, workdaysIn, isoDate, addMonths,
  type AgreementInfo, type OrlofRight, type SickRight,
} from "@/lib/entitlements";

// Réttindastaða starfsmanna: orlof (áunnið/tekið + réttur skv. samningi), veikindi og veikindi barna
// á síðustu 12 mánuðum á móti rétti. Ein heimild fyrir starfsmannaspjaldið, Innsýn og skráningu veikinda.

export type AbsenceRow = { id: string; type: string; from: string; to: string; days: number; note: string | null; status: string };

export type EmployeeRights = {
  id: string;
  name: string;
  dept: string;
  union: string | null;
  agreement: AgreementInfo | null;
  hireDate: string | null;
  priorServiceMonths: number;
  /** Ráðningardagur vantar, eða er sami dagur og skráningin í VAKTO (líklega látinn standa á „í dag“). */
  hireSuspect: "missing" | "same-as-created" | null;
  birthKnown: boolean;
  orlof: { right: OrlofRight | null; balance: OrlofBalance | null; pctSet: number; pctBehind: boolean };
  sick: { right: SickRight | null; used: number; over: boolean; near: boolean };
  child: { days: number; label: string; used: number; over: boolean };
  /** Fjarvistir síðustu 12 mánaða (nýjast fyrst). */
  absences: AbsenceRow[];
  /** Næsta breyting á rétti (orlof eða veikindi) — fyrir „hækkar 1.3.2027“. */
  nextChange: { date: string; text: string } | null;
};

export async function getRights(supabase: SupabaseClient, employeeIds?: string[]): Promise<EmployeeRights[]> {
  const today = isoDate(new Date());
  const since = addMonths(today, -12);
  // Skráð veikindi fram í tímann (t.d. út vikuna) teljast strax með.
  const horizon = addMonths(today, 3);
  let eq = supabase.from("employees")
    .select("id, full_name, union_agreement, kennitala, hire_date, orlof, status, prior_service_months, created_at, departments(name)")
    .neq("status", "inactive");
  if (employeeIds?.length) eq = eq.in("id", employeeIds);
  let res = await eq.order("full_name");
  if (res.error && /prior_service_months|created_at/.test(res.error.message)) { // fyrir 0097
    let q2 = supabase.from("employees").select("id, full_name, union_agreement, kennitala, hire_date, orlof, status, departments(name)").neq("status", "inactive");
    if (employeeIds?.length) q2 = q2.in("id", employeeIds);
    res = (await q2.order("full_name")) as unknown as typeof res;
  }
  const { data: emps, error } = res;
  if (error || !emps?.length) return [];
  const ids = emps.map((e) => e.id as string);
  const leaveQ = (cols: string) => supabase.from("leave_requests").select(cols)
    .in("employee_id", ids).gte("to_date", since).order("from_date", { ascending: false });
  const [lv, balances] = await Promise.all([leaveQ("id, employee_id, type, from_date, to_date, status, note"), getOrlofBalances(supabase, ids)]);
  // `note` kom með 0096 — án hennar er lesið án athugasemda.
  const leaves = (lv.error ? (await leaveQ("id, employee_id, type, from_date, to_date, status")).data : lv.data) as unknown as
    { id: string; employee_id: string; type: string; from_date: string; to_date: string; status: string; note?: string | null }[] | null;
  return emps.map((e) => {
    const id = e.id as string;
    const union = (e.union_agreement as string | null) ?? null;
    const fam = familyFor(union);
    const hire = (e.hire_date as string | null) ?? null;
    const priorM = Math.max(0, Number((e as { prior_service_months?: number }).prior_service_months) || 0);
    // Starfsaldur telur frá ráðningardegi mínus starfsaldur sem telst með (t.d. fyrri ráðning hjá fyrirtækinu).
    const start = hire ? addMonths(hire, -priorM) : null;
    const createdOn = String((e as { created_at?: string }).created_at ?? "").slice(0, 10);
    const birth = birthDateFromKennitala(e.kennitala as string | null);
    const mine = (leaves ?? []).filter((l) => l.employee_id === id);
    const approved = mine.filter((l) => l.status === "approved");
    const used = (type: string) => approved.filter((l) => l.type === type)
      .reduce((a, l) => a + workdaysIn(l.from_date as string, l.to_date as string, since, horizon), 0);
    const pctSet = Number((e.orlof as { pct?: number } | null)?.pct) || 10.17;
    const oRight = fam ? orlofRight({ family: fam, hireDate: start, birth, asOf: today }) : null;
    const sRight = fam ? sickRight({ family: fam, hireDate: start, asOf: today }) : null;
    const cRight = childSickRight({ hireDate: start, asOf: today });
    const sickUsed = used("veikindi"), childUsed = used("veikindi_barns");
    const next: { date: string; text: string }[] = [];
    if (oRight?.next) next.push({ date: oRight.next.from, text: `Orlof hækkar í ${oRight.next.days} daga (${String(oRight.next.pct).replace(".", ",")} %)` });
    if (sRight?.next) next.push({ date: sRight.next.from, text: `Veikindaréttur verður ${sRight.next.label}` });
    next.sort((a, b) => a.date.localeCompare(b.date));
    return {
      id,
      name: e.full_name as string,
      dept: ((e.departments as unknown as { name?: string } | null)?.name) ?? "",
      union,
      agreement: fam ? AGREEMENTS[fam] : null,
      hireDate: hire,
      priorServiceMonths: priorM,
      hireSuspect: !hire ? "missing" : createdOn && hire === createdOn ? "same-as-created" : null,
      birthKnown: !!birth,
      orlof: { right: oRight, balance: balances.get(id) ?? null, pctSet, pctBehind: !!oRight && pctSet + 0.001 < oRight.now.pct },
      sick: { right: sRight, used: sickUsed, over: !!sRight && sickUsed > sRight.days, near: !!sRight && sRight.days > 0 && sickUsed >= sRight.days * 0.8 },
      child: { days: cRight.days, label: cRight.label, used: childUsed, over: childUsed > cRight.days },
      absences: mine.map((l) => ({
        id: l.id as string, type: l.type as string, from: l.from_date as string, to: l.to_date as string,
        days: workdaysIn(l.from_date as string, l.to_date as string, "0000-01-01", "9999-12-31"),
        note: (l.note as string | null) ?? null, status: l.status as string,
      })),
      nextChange: next[0] ?? null,
    };
  });
}
