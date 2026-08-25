import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, brandedReportHtml } from "@/lib/email";
import { nf, dec1 } from "@/lib/format";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Period = { kind: "daily" | "weekly" | "monthly"; from: string; to: string; label: string };

/** Which digests fire on this date (cron runs once a day, early morning). */
export function periodsFor(now: Date): Period[] {
  const out: Period[] = [];
  const y = new Date(now); y.setDate(y.getDate() - 1);
  out.push({ kind: "daily", from: iso(y), to: iso(y), label: `Dagskýrsla — ${y.getDate()}.${y.getMonth() + 1}.${y.getFullYear()}` });
  if (now.getDay() === 1) { // Monday → last week
    const from = new Date(now); from.setDate(from.getDate() - 7);
    const to = new Date(now); to.setDate(to.getDate() - 1);
    out.push({ kind: "weekly", from: iso(from), to: iso(to), label: `Vikuskýrsla — ${from.getDate()}.${from.getMonth() + 1}.–${to.getDate()}.${to.getMonth() + 1}.` });
  }
  if (now.getDate() === 1) { // 1st → last month
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
    out.push({ kind: "monthly", from: iso(from), to: iso(to), label: `Mánaðarskýrsla — ${MO[from.getMonth()]} ${from.getFullYear()}` });
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
    const { data: emps } = await admin.from("employees").select("id, full_name, rate").eq("company_id", company);
    const rate = new Map((emps ?? []).map((e) => [e.id as string, Number(e.rate) || 0]));
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
      const unsched = [...unschedBy.values()].reduce((a, b) => a + b, 0);
      const dev = hours - planned;
      const devTxt = `${dev >= 0 ? "+" : "−"}${dec1(Math.abs(dev))} klst`;
      const devCol = Math.abs(dev) < 0.05 ? "#5f6470" : dev > 0 ? "#d8483a" : "#1f9d6b";

      // ALL employees who worked (or were scheduled), full names, planned/worked/deviation
      const empIds = new Set<string>([...perEmp.keys(), ...plannedBy.keys()]);
      const all = [...empIds]
        .map((eid) => ({ eid, name: nameOf.get(eid) ?? "?", plan: plannedBy.get(eid) ?? 0, got: perEmp.get(eid) ?? 0 }))
        .sort((a, b) => b.got - a.got);
      const capped = all.slice(0, 30);
      const cell = "padding:7px 8px;border-bottom:1px solid #eef0f3;font-size:13px";
      const rowsHtml = capped.map((r) => {
        const d = r.got - r.plan;
        const dc = Math.abs(d) < 0.05 ? "#9296a6" : d > 0 ? "#d8483a" : "#1f9d6b";
        return `<tr>
          <td style="${cell}">${r.name}${(unschedBy.get(r.eid) ?? 0) > 0 ? ` <span style="color:#bf8f3a;font-size:11px;font-weight:700">· óáætl.</span>` : ""}</td>
          <td style="${cell};text-align:right;color:#5f6470">${r.plan ? dec1(r.plan) : "—"}</td>
          <td style="${cell};text-align:right;font-weight:700">${r.got ? dec1(r.got) : "—"}</td>
          <td style="${cell};text-align:right;font-weight:700;color:${dc}">${r.plan || r.got ? `${d >= 0 ? "+" : "−"}${dec1(Math.abs(d))}` : "—"}</td>
        </tr>`;
      }).join("") + (all.length > capped.length ? `<tr><td colspan="4" style="${cell};color:#9296a6">+ ${all.length - capped.length} til viðbótar</td></tr>` : "");
      const unschedNames = [...unschedBy.keys()].map((eid) => nameOf.get(eid) ?? "?").join(", ");
      const stat = (label: string, value: string, color?: string) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f3;color:#5f6470;font-size:14px">${label}</td>
         <td style="padding:8px 0;border-bottom:1px solid #eef0f3;text-align:right;font-weight:700;font-variant-numeric:tabular-nums${color ? `;color:${color}` : ""}">${value}</td></tr>`;
      const th = "padding:6px 8px;font-size:10.5px;font-weight:700;letter-spacing:.07em;color:#9296a6;text-transform:uppercase;border-bottom:2px solid #eef0f3";
      const inner = `
        <table style="border-collapse:collapse;width:100%;margin:4px 0 6px">
          ${stat("Áætlaðir tímar (vaktaplan)", `${dec1(planned)} klst`)}
          ${stat("Unnir tímar", `${dec1(hours)} klst`)}
          ${stat("Frávik", devTxt, devCol)}
          ${stat("Áætlaður launakostnaður (m. gjöldum)", `${nf(Math.round(cost))} kr`)}
          ${stat("Óáætlaðar stimplanir", unsched ? `${unsched} — ${unschedNames}` : "0", unsched ? "#bf8f3a" : undefined)}
          ${stat("Opnar stimplanir", String(open), open ? "#d8483a" : undefined)}
        </table>
        ${all.length ? `<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#9296a6;margin:18px 0 4px">TÍMAR PER STARFSMANN</div>
        <table style="border-collapse:collapse;width:100%">
          <tr><th style="${th};text-align:left">Nafn</th><th style="${th};text-align:right">Áætlað</th><th style="${th};text-align:right">Unnið</th><th style="${th};text-align:right">Frávik</th></tr>
          ${rowsHtml}
        </table>` : ""}`;
      const html = brandedReportHtml({
        preheader: `${co.name} · ${p.label}`,
        heading: `${co.name} — ${p.label}`,
        innerHtml: inner,
      });
      for (const to of emails) {
        const res = await sendEmail({ to, subject: `${co.name} · ${p.label}`, html });
        if (res.ok && !res.skipped) sent++;
      }
    }
  }
  return { sent };
}
