import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLaborPeriods, getLaborTarget, laborColor, type Db } from "@/lib/labor";
import { leaveWorkdays } from "@/lib/orlof";
import { isDemoCompany } from "@/lib/demo.server";
import { sendEmail } from "@/lib/email";
import { modelFor } from "@/lib/ai/models";
import { monthlyReportHtml, monthlyReportText, monthlyReportSubject, type MonthlyReportData, type MonthlyDeviation } from "@/lib/monthly-report-email";

// Mánaðarskýrsla til eiganda (og vaktstjóra ef valið) 1. hvers mánaðar — fyrri mánuður.
// Allar launatölur úr labor.ts (getLaborPeriods) — enginn annar útreikningur. Ísland = UTC.
// Stilling og „sent“-merki á companies (migration 0085); án hennar sendir cron ekkert.

const MO_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const MO_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SKIP_STATUS = new Set(["suspended", "canceled"]);

type Month = { ym: string; from: string; to: string; is: string; en: string };

/** Almanaksmánuður `back` mánuðum fyrir mánuð `now` (UTC). */
export function monthBefore(now: Date, back = 1): Month {
  const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
  const y = s.getUTCFullYear(), m = s.getUTCMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { ym: `${y}-${String(m + 1).padStart(2, "0")}`, from: iso(s), to: iso(e), is: `${MO_IS[m]} ${y}`, en: `${MO_EN[m]} ${y}` };
}

export type BuiltReport = { data: MonthlyReportData; active: boolean };

/** Safnar tölum mánaðarins fyrir eitt fyrirtæki (service-role). */
export async function buildMonthlyReport(companyId: string, now = new Date()): Promise<BuiltReport> {
  const admin = createAdminClient();
  const db = admin as unknown as Db;
  const cur = monthBefore(now, 1), prev = monthBefore(now, 2);

  const [[p, pp], target, coRes, empRes, punchRes, leaveRes, reqRes, swapRes] = await Promise.all([
    getLaborPeriods(db, companyId, [{ from: cur.from, to: cur.to }, { from: prev.from, to: prev.to }]),
    getLaborTarget(db, companyId),
    admin.from("companies").select("name").eq("id", companyId).maybeSingle(),
    admin.from("employees").select("id, full_name").eq("company_id", companyId),
    admin.from("punches").select("employee_id, clock_in, clock_out, approved")
      .eq("company_id", companyId).gte("clock_in", cur.from).lte("clock_in", cur.to + "T23:59:59"),
    admin.from("leave_requests").select("employee_id, from_date, to_date")
      .eq("company_id", companyId).eq("type", "veikindi").eq("status", "approved")
      .lte("from_date", cur.to).gte("to_date", cur.from),
    admin.from("leave_requests").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
    admin.from("shift_swaps").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
  ]);

  const nameOf = new Map((empRes.data ?? []).map((e) => [e.id as string, (e.full_name as string) ?? "?"]));
  const punches = punchRes.data ?? [];
  const workedDays = new Set<string>();
  let unapproved = 0, openPunches = 0;
  for (const x of punches) {
    if (!x.clock_out) { openPunches++; continue; }
    workedDays.add(`${x.employee_id}|${String(x.clock_in).slice(0, 10)}`);
    if (!x.approved) unapproved++;
  }

  // Veikindi: samþykktir 'veikindi'-dagar (virkir dagar) innan mánaðarins.
  const sickBy = new Map<string, number>();
  for (const l of leaveRes.data ?? []) {
    const a = String(l.from_date) < cur.from ? cur.from : String(l.from_date);
    const b = String(l.to_date) > cur.to ? cur.to : String(l.to_date);
    const n = leaveWorkdays(a, b);
    if (n > 0) sickBy.set(l.employee_id as string, (sickBy.get(l.employee_id as string) ?? 0) + n);
  }
  const sickDays = [...sickBy.values()].reduce((s, n) => s + n, 0);
  const sickRate = sickDays + workedDays.size > 0 && sickDays > 0 ? Math.round((sickDays / (sickDays + workedDays.size)) * 1000) / 10 : null;

  // Helstu frávik: mest yfirvinna, mest umfram plan, flestir veikindadagar (hvert aðeins ef > 0).
  const deviations: MonthlyDeviation[] = [];
  const ot = [...p.staff].sort((a, b) => b.ot - a.ot)[0];
  if (ot && ot.ot > 0) deviations.push({ kind: "overtime", name: nameOf.get(ot.id) ?? ot.name, hours: ot.ot, kr: ot.otPay });
  const over = p.staff.filter((s) => s.planned > 0).sort((a, b) => b.deviation - a.deviation)[0];
  if (over && over.deviation >= 1) deviations.push({ kind: "overPlan", name: nameOf.get(over.id) ?? over.name, hours: over.deviation });
  const sick = [...sickBy.entries()].sort((a, b) => b[1] - a[1])[0];
  if (sick) deviations.push({ kind: "sick", name: nameOf.get(sick[0]) ?? "?", days: sick[1] });

  const data: MonthlyReportData = {
    company: (coRes.data?.name as string) ?? "VAKTO",
    month: { is: cur.is, en: cur.en }, prevMonth: { is: prev.is, en: prev.en },
    target, pct: p.pct, prevPct: pp.pct, tone: laborColor(p.pct, target),
    revenue: p.revenue, revenueEstimatedDays: p.revenueSource === "estimated" || p.revenueSource === "mixed" ? p.days - p.coveredDays : 0,
    cost: p.cost, prevCost: pp.cost,
    hours: p.hours, planned: p.planned, overtime: p.overtime, overtimePay: p.overtimePay,
    sickDays, sickRate, deviations,
    open: { requests: (reqRes.count ?? 0) + (swapRes.count ?? 0), unapproved, openPunches },
    commentary: null,
  };
  return { data, active: punches.length > 0 || p.coveredDays > 0 };
}

/** 2–3 setningar frá Claude ef ANTHROPIC_API_KEY er til — annars/ef villa: null. Stöðvar aldrei póstinn. */
export async function aiCommentary(d: MonthlyReportData): Promise<{ is: string; en: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
    const facts = {
      month: d.month.en, laborPct: d.pct, laborPctPrevMonth: d.prevPct, target: d.target,
      revenue: d.revenue, laborCost: d.cost, laborCostPrevMonth: d.prevCost,
      hoursWorked: d.hours, hoursScheduled: d.planned, overtimeHours: d.overtime, overtimeCost: d.overtimePay,
      sickDays: d.sickDays, sickRatePct: d.sickRate, deviations: d.deviations, openItems: d.open,
    };
    const msg = await client.messages.create({
      model: modelFor("chat"), // stutt samantekt → Sonnet-stig
      max_tokens: 800,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              is: { type: "string", description: "2–3 setningar á íslensku" },
              en: { type: "string", description: "Same 2–3 sentences in English" },
            },
            required: ["is", "en"],
            additionalProperties: false,
          },
        },
      },
      messages: [{
        role: "user",
        content: `Þú skrifar stutta umsögn (2–3 setningar) í mánaðarskýrslu VAKTO til eiganda veitingastaðar/fyrirtækis. Notaðu AÐEINS tölurnar hér að neðan, aldrei giska. Laun % af veltu: lægra er betra; berðu saman við markmið og fyrri mánuð og nefndu eitt hagnýtt atriði ef tilefni er til. Íslenskt talnasnið (punktur í þúsundum, komma í brotum). Engin emoji, engar fyrirsagnir.\n\nGÖGN: ${JSON.stringify(facts)}`,
      }],
    });
    const block = msg.content.find((b) => b.type === "text");
    const parsed = block && "text" in block ? JSON.parse(block.text) as { is?: string; en?: string } : null;
    return parsed?.is && parsed.en ? { is: parsed.is.trim(), en: parsed.en.trim() } : null;
  } catch (e) {
    console.error("[monthly-report] ai:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function deliver(to: string[], d: MonthlyReportData): Promise<number> {
  const subject = monthlyReportSubject(d), html = monthlyReportHtml(d), text = monthlyReportText(d);
  let sent = 0;
  for (const addr of to) {
    const r = await sendEmail({ to: addr, subject, html, text });
    if (r.ok && !r.skipped) sent++;
    else if (!r.ok) console.error("[monthly-report] send:", addr, r.error);
  }
  return sent;
}

/** Prufa: skýrsla síðasta mánaðar á eitt netfang strax (breytir ekki „sent“-merkinu). */
export async function sendMonthlyReportTest(companyId: string, to: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const { data } = await buildMonthlyReport(companyId);
  data.commentary = await aiCommentary(data);
  const r = await sendEmail({ to, subject: `[Prufa] ${monthlyReportSubject(data)}`, html: monthlyReportHtml(data), text: monthlyReportText(data) });
  return { ok: r.ok, skipped: r.skipped };
}

export type MonthlyRunResult = { ok: boolean; month: string; companies: number; sent: number; skipped: Record<string, number>; error?: string };

/** Cron: öll virk fyrirtæki → skýrsla fyrri mánaðar, aldrei tvisvar fyrir sama mánuð. */
export async function runMonthlyReports(now = new Date()): Promise<MonthlyRunResult> {
  const admin = createAdminClient();
  const ym = monthBefore(now, 1).ym;
  const out: MonthlyRunResult = { ok: true, month: ym, companies: 0, sent: 0, skipped: {} };
  const skip = (why: string) => { out.skipped[why] = (out.skipped[why] ?? 0) + 1; };

  const { data: cos, error } = await admin.from("companies")
    .select("id, billing_status, monthly_report, monthly_report_managers, monthly_report_sent");
  if (error) {
    // 0085 ekki keyrð → ekkert idempotency-merki → sendum ekkert.
    console.error("[monthly-report] companies:", error.message);
    return { ...out, ok: false, error: "companies query failed (migration 0085?)" };
  }

  for (const co of cos ?? []) {
    const id = co.id as string;
    if (isDemoCompany(id)) { skip("demo"); continue; }
    if (SKIP_STATUS.has(String(co.billing_status ?? ""))) { skip("status"); continue; }
    if (co.monthly_report === false) { skip("off"); continue; }
    if (co.monthly_report_sent === ym) { skip("already"); continue; }
    try {
      const roles = co.monthly_report_managers ? ["owner", "manager"] : ["owner"];
      const { data: users } = await admin.from("users").select("email").eq("company_id", id).in("role", roles);
      const to = [...new Set((users ?? []).map((u) => String(u.email ?? "").trim()).filter(Boolean))];
      if (!to.length) { skip("no_recipient"); continue; }

      const { data, active } = await buildMonthlyReport(id, now);
      if (!active) { skip("inactive"); continue; }

      // Eign á mánuðinum áður en sent er — samhliða keyrsla fær 0 raðir og sleppir.
      const before = (co.monthly_report_sent as string | null) ?? null;
      const { data: claimed } = await admin.from("companies").update({ monthly_report_sent: ym })
        .eq("id", id).or(`monthly_report_sent.is.null,monthly_report_sent.neq.${ym}`).select("id");
      if (!claimed?.length) { skip("already"); continue; }

      data.commentary = await aiCommentary(data);
      const n = await deliver(to, data);
      if (n === 0) {
        // Ekkert fór (enginn RESEND-lykill eða villa) → sleppa merkinu svo næsta keyrsla reyni aftur.
        await admin.from("companies").update({ monthly_report_sent: before }).eq("id", id).eq("monthly_report_sent", ym);
        skip("not_delivered");
        continue;
      }
      out.companies++; out.sent += n;
    } catch (e) {
      console.error("[monthly-report]", id, e instanceof Error ? e.message : e);
      skip("error");
    }
  }
  return out;
}
