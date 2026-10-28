// Réttindi starfsmannsins sjálfs — sama regla og vefurinn (src/lib/rights.server.ts):
// orlofsréttur skv. kjarasamningi + orlofsstaða, veikindi og veikindi barna síðustu 12 mánuði á móti rétti,
// fjarvistir og næsta breyting. Les aðeins eigin raðir (RLS: employees self-read, leave_requests eigin).
import { supabase } from "../supabase";
import {
  AGREEMENTS, familyFor, birthDateFromKennitala, orlofRight, sickRight, childSickRight, workdaysIn, isoDate, addMonths,
  type AgreementInfo, type OrlofRight, type SickRight,
} from "../entitlements";
import { getMyOrlof } from "./orlof";
import type { OrlofBalance } from "../orlof";
import type { Me } from "./me";

export type MyAbsence = { id: string; type: string; from: string; to: string; days: number; status: string };
export type MyRights = {
  agreement: AgreementInfo | null;
  union: string | null;
  hireDate: string | null;
  priorMonths: number;
  orlof: { right: OrlofRight | null; balance: OrlofBalance | null };
  sick: { right: SickRight | null; used: number };
  child: { days: number; label: string; used: number };
  /** Orlof og annað frí á orlofsárinu (frá 1. maí) — samþykkt + í bið. */
  leaveTaken: number;
  leavePending: number;
  absences: MyAbsence[];
  nextChange: { date: string; text: string } | null;
};

export async function getMyRights(me: Me): Promise<MyRights> {
  const today = isoDate(new Date());
  const since = addMonths(today, -12);
  const horizon = addMonths(today, 3);
  let emp = await supabase.from("employees").select("hire_date, kennitala, union_agreement, prior_service_months").eq("id", me.empId).maybeSingle();
  if (emp.error) emp = (await supabase.from("employees").select("hire_date, kennitala, union_agreement").eq("id", me.empId).maybeSingle()) as typeof emp; // fyrir 0097
  const e = (emp.data ?? {}) as { hire_date?: string | null; kennitala?: string | null; union_agreement?: string | null; prior_service_months?: number | null };
  const [lv, balance] = await Promise.all([
    supabase.from("leave_requests").select("id, type, from_date, to_date, status")
      .eq("employee_id", me.empId).gte("to_date", since).order("from_date", { ascending: false }),
    getMyOrlof(me).catch(() => null),
  ]);
  const leaves = (lv.data ?? []) as { id: string; type: string; from_date: string; to_date: string; status: string }[];
  const union = e.union_agreement ?? me.union ?? null;
  const fam = familyFor(union);
  const hire = e.hire_date ?? null;
  const priorMonths = Math.max(0, Number(e.prior_service_months) || 0);
  const start = hire ? addMonths(hire, -priorMonths) : null;
  const birth = birthDateFromKennitala(e.kennitala ?? me.kennitala);
  const approved = leaves.filter((l) => l.status === "approved");
  const used = (type: string) => approved.filter((l) => l.type === type).reduce((a, l) => a + workdaysIn(l.from_date, l.to_date, since, horizon), 0);
  const oRight = fam ? orlofRight({ family: fam, hireDate: start, birth, asOf: today }) : null;
  const sRight = fam ? sickRight({ family: fam, hireDate: start, asOf: today }) : null;
  const cRight = childSickRight({ hireDate: start, asOf: today });
  const yearStart = balance?.yearStart ?? `${today.slice(0, 4)}-05-01`;
  const leaveDays = (st: string) => leaves.filter((l) => l.type === "orlof" && l.status === st)
    .reduce((a, l) => a + workdaysIn(l.from_date, l.to_date, yearStart, "9999-12-31"), 0);
  const next: { date: string; text: string }[] = [];
  if (oRight?.next) next.push({ date: oRight.next.from, text: `Orlof hækkar í ${oRight.next.days} daga (${String(oRight.next.pct).replace(".", ",")} %)` });
  if (sRight?.next) next.push({ date: sRight.next.from, text: `Veikindaréttur verður ${sRight.next.label}` });
  next.sort((a, b) => a.date.localeCompare(b.date));
  return {
    agreement: fam ? AGREEMENTS[fam] : null,
    union,
    hireDate: hire,
    priorMonths,
    orlof: { right: oRight, balance },
    sick: { right: sRight, used: used("veikindi") },
    child: { days: cRight.days, label: cRight.label, used: used("veikindi_barns") },
    leaveTaken: leaveDays("approved"),
    leavePending: leaveDays("pending"),
    absences: leaves.map((l) => ({ id: l.id, type: l.type, from: l.from_date, to: l.to_date, status: l.status, days: workdaysIn(l.from_date, l.to_date, "0000-01-01", "9999-12-31") })),
    nextChange: next[0] ?? null,
  };
}
