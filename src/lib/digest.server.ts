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
    const nameOf = new Map((emps ?? []).map((e) => [e.id as string, (e.full_name as string).split(/\s+/)[0]]));

    for (const p of periods) {
      const fromTs = `${p.from}T00:00:00Z`, toTs = `${p.to}T23:59:59Z`;
      const { data: punches } = await admin
        .from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).gte("clock_in", fromTs).lte("clock_in", toTs);
      if (!punches?.length) continue; // no activity → no email
      const { data: shifts } = await admin
        .from("shifts").select("employee_id, date").eq("company_id", company)
        .gte("date", p.from).lte("date", p.to);
      const scheduled = new Set((shifts ?? []).map((x) => `${x.employee_id}:${x.date}`));
      let hours = 0, cost = 0, open = 0, unsched = 0;
      const perEmp = new Map<string, number>();
      for (const pu of punches) {
        const eid = pu.employee_id as string;
        if (!pu.clock_out) { open++; continue; }
        const h = (new Date(pu.clock_out as string).getTime() - new Date(pu.clock_in as string).getTime()) / 3600e3;
        if (h <= 0 || h > 24) continue;
        hours += h; cost += h * (rate.get(eid) ?? 0) * 1.302; // með launatengdum gjöldum
        perEmp.set(eid, (perEmp.get(eid) ?? 0) + h);
        const day = (pu.clock_in as string).slice(0, 10);
        if (!scheduled.has(`${eid}:${day}`)) unsched++;
      }
      const top = [...perEmp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const rowsHtml = top.map(([eid, h]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${nameOf.get(eid) ?? "?"}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${dec1(h)} klst</td></tr>`).join("");
      const stat = (label: string, value: string) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f3;color:#5f6470;font-size:14px">${label}</td>
         <td style="padding:8px 0;border-bottom:1px solid #eef0f3;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${value}</td></tr>`;
      const inner = `
        <table style="border-collapse:collapse;width:100%;margin:4px 0 6px">
          ${stat("Unnir tímar", `${dec1(hours)} klst`)}
          ${stat("Áætlaður launakostnaður (m. gjöldum)", `${nf(Math.round(cost))} kr`)}
          ${stat("Óáætlaðar stimplanir", String(unsched))}
          ${stat("Opnar stimplanir", String(open))}
        </table>
        ${top.length ? `<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#9296a6;margin:16px 0 4px">FLESTIR TÍMAR</div><table style="border-collapse:collapse;width:100%">${rowsHtml}</table>` : ""}`;
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
