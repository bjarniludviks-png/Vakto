import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, digestReportHtml } from "@/lib/email";
import { nf, dec1 } from "@/lib/format";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Period = { kind: "daily" | "weekly" | "monthly"; from: string; to: string; label: string };

/** Which digests fire on this date (cron runs once a day, early morning). */
export function periodsFor(now: Date): Period[] {
  const out: Period[] = [];
  const y = new Date(now); y.setDate(y.getDate() - 1);
  out.push({ kind: "daily", from: iso(y), to: iso(y), label: `Dagskýrsla ${y.getDate()}.${y.getMonth() + 1}.${y.getFullYear()}` });
  if (now.getDay() === 1) { // Monday → last week
    const from = new Date(now); from.setDate(from.getDate() - 7);
    const to = new Date(now); to.setDate(to.getDate() - 1);
    out.push({ kind: "weekly", from: iso(from), to: iso(to), label: `Vikuskýrsla ${from.getDate()}.${from.getMonth() + 1}.–${to.getDate()}.${to.getMonth() + 1}.` });
  }
  if (now.getDate() === 1) { // 1st → last month
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
    out.push({ kind: "monthly", from: iso(from), to: iso(to), label: `Mánaðarskýrsla ${MO[from.getMonth()]} ${from.getFullYear()}` });
  }
  return out;
}

/** Send daily/weekly/monthly digest emails to every company's owners+managers.
 * Aggregates worked hours, estimated cost, unscheduled punches and open
 * punches straight from the punches/shifts tables. Skips silently without
 * RESEND_API_KEY (sendEmail no-ops) or when a company had no activity. */
export async function sendDigests(now = new Date()): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const periods = periodsFor(now);
  let sent = 0;
  const { data: companies } = await admin.from("companies").select("id, name");
  for (const co of companies ?? []) {
    const company = co.id as string;
    const { data: recipients } = await admin
      .from("users").select("email, full_name, role").eq("company_id", company).in("role", ["owner", "manager"]);
    const emails = (recipients ?? []).map((r) => r.email as string).filter(Boolean);
    if (!emails.length) continue;
    const { data: emps } = await admin.from("employees").select("id, full_name, rate, pay_type, status").eq("company_id", company);
    // Aðeins tímakaup er margfaldað með tímum — mánaðarlaun eru föst laun, ekki kr/klst.
    const rate = new Map((emps ?? []).filter((e) => e.pay_type !== "monthly").map((e) => [e.id as string, Number(e.rate) || 0]));
    const monthlySalaries = (emps ?? []).filter((e) => e.pay_type === "monthly" && e.status !== "inactive").reduce((a, e) => a + (Number(e.rate) || 0), 0);
    const nameOf = new Map((emps ?? []).map((e) => [e.id as string, e.full_name as string]));

    for (const p of periods) {
      const fromTs = `${p.from}T00:00:00Z`, toTs = `${p.to}T23:59:59Z`;
      const { data: punches } = await admin
        .from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).gte("clock_in", fromTs).lte("clock_in", toTs);
      if (!punches?.length) continue; // no activity → no email
      const { data: shifts } = await admin
        .from("shifts").select("employee_id, date, start_time, end_time").eq("company_id", company)
        .gte("date", p.from).lte("date", p.to);
      const scheduled = new Set((shifts ?? []).map((x) => `${x.employee_id}:${x.date}`));

      // planned hours per employee + total (from the published schedule)
      const plannedBy = new Map<string, number>();
      let planned = 0;
      for (const s of shifts ?? []) {
        if (!s.employee_id || !s.start_time || !s.end_time) continue;
        const st = String(s.start_time), en = String(s.end_time);
        let h = Number(en.slice(0, 2)) + Number(en.slice(3, 5)) / 60 - Number(st.slice(0, 2)) - Number(st.slice(3, 5)) / 60;
        if (h < 0) h += 24;
        planned += h;
        plannedBy.set(s.employee_id as string, (plannedBy.get(s.employee_id as string) ?? 0) + h);
      }

      let hours = 0, cost = 0, open = 0;
      const perEmp = new Map<string, number>();
      const unschedBy = new Map<string, number>(); // who clocked in off-plan
      for (const pu of punches) {
        const eid = pu.employee_id as string;
        if (!pu.clock_out) { open++; continue; }
        const h = (new Date(pu.clock_out as string).getTime() - new Date(pu.clock_in as string).getTime()) / 3600e3;
        if (h <= 0 || h > 24) continue;
        hours += h; cost += h * (rate.get(eid) ?? 0) * 1.302; // með launatengdum gjöldum
        perEmp.set(eid, (perEmp.get(eid) ?? 0) + h);
        const day = (pu.clock_in as string).slice(0, 10);
        if (!scheduled.has(`${eid}:${day}`)) unschedBy.set(eid, (unschedBy.get(eid) ?? 0) + 1);
      }
      // Mánaðarlaunafólk: laun hlutfallslega fyrir lengd tímabilsins (mánuður = full laun).
      const days = Math.round((new Date(p.to).getTime() - new Date(p.from).getTime()) / 86400000) + 1;
      cost += monthlySalaries * (p.kind === "monthly" ? 1 : days / 30.44) * 1.302;
      const unsched = [...unschedBy.values()].reduce((a, b) => a + b, 0);
      const dev = hours - planned;
      const devTxt = `${dev >= 0 ? "+" : "−"}${dec1(Math.abs(dev))} klst`;
      const devCol = Math.abs(dev) < 0.05 ? "#6e6e73" : dev > 0 ? "#d8483a" : "#1f9d6b";

      // ALL employees who worked (or were scheduled), full names, planned/worked/deviation
      const empIds = new Set<string>([...perEmp.keys(), ...plannedBy.keys()]);
      const all = [...empIds]
        .map((eid) => ({ eid, name: nameOf.get(eid) ?? "?", plan: plannedBy.get(eid) ?? 0, got: perEmp.get(eid) ?? 0 }))
        .sort((a, b) => b.got - a.got);
      const capped = all.slice(0, 30);
      const html = digestReportHtml({
        company: co.name, label: p.label,
        planned: `${dec1(planned)} klst`, worked: `${dec1(hours)} klst`,
        deviation: devTxt, deviationColor: devCol, cost: `${nf(Math.round(cost))} kr`,
        unscheduled: unsched ? `${unsched}: ${[...unschedBy.keys()].map((eid) => nameOf.get(eid) ?? "?").join(", ")}` : "0", unscheduledWarn: unsched > 0,
        open: String(open), openWarn: open > 0,
        people: capped.map((r) => {
          const d = r.got - r.plan;
          return {
            name: r.name, unscheduled: (unschedBy.get(r.eid) ?? 0) > 0,
            plan: r.plan ? dec1(r.plan) : "–", got: r.got ? dec1(r.got) : "–",
            dev: r.plan || r.got ? `${d >= 0 ? "+" : "−"}${dec1(Math.abs(d))}` : "–",
            devColor: Math.abs(d) < 0.05 ? "#86868b" : d > 0 ? "#d8483a" : "#1f9d6b",
          };
        }),
        more: all.length - capped.length,
      });
      for (const to of emails) {
        const res = await sendEmail({ to, subject: `${co.name} · ${p.label}`, html });
        if (res.ok && !res.skipped) sent++;
      }
    }
  }
  return { sent };
}
