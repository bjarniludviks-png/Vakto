import "server-only";

// Vaktarar (0086) — metnir af /api/cron/alerts. Allar tölur koma úr labor.ts (tímar, laun %) og
// Skýrslusafninu (manager-report.server.ts: yfirvinna, skýrslur) — engin önnur tíma- eða launareikning.
// Hver viðvörun fer einu sinni per starfsmann per tímabil og stig (alert_events, unique rule_id+dedupe_key).
// Opið demo: demo-fyrirtækinu er sleppt hér; sendEmail/sendPushToUser hafa auk þess eigin demo-varnir.

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isDemoCompany } from "@/lib/demo.server";
import { allRows } from "@/lib/supabase/all-rows";
import { getLaborPeriods, getLaborPct, type Db } from "@/lib/labor";
import { buildManagerReport, loadReportEmployees, type ManagerReport } from "@/lib/manager-report.server";
import { tableXlsxBase64 } from "@/lib/export-report";
import { sendVaktariEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { nf, dec1 } from "@/lib/format";
import type { Employee } from "@/lib/employees";
import { describeAlert, normalizeAlert, REPORT_TITLE, RANGE_LABEL, type AlertRule, type AlertPeriod, type ReportRange, type ReportSchedule, type AlertChannel } from "@/lib/alerts";
import { asPlan, planAllows } from "@/lib/plan-features";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (isoDay: string, n: number) => { const [y, m, d] = isoDay.split("-").map(Number); return iso(new Date(y, m - 1, d + n)); };
const short = (isoDay: string) => `${Number(isoDay.slice(8))}.${Number(isoDay.slice(5, 7))}.`;
const num = (n: number) => (Number.isInteger(n) ? nf(n) : dec1(n));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Tímabilið sem `now` er í: vika (mán–sun), almanaksmánuður eða launatímabil (pay_period_start). */
export function periodRange(period: AlertPeriod, now: Date, payStart = 1): { from: string; to: string; key: string } {
  const today = iso(now);
  if (period === "week") {
    const dow = now.getDay() === 0 ? 7 : now.getDay();
    const from = addDays(today, 1 - dow);
    return { from, to: addDays(from, 6), key: `w:${from}` };
  }
  const start = period === "payroll" && payStart > 1 ? payStart : 1;
  const y = now.getFullYear(), m = now.getMonth();
  const s = now.getDate() >= start ? new Date(y, m, start) : new Date(y, m - 1, start);
  const e = new Date(s.getFullYear(), s.getMonth() + 1, start - 1);
  const from = iso(s);
  return { from, to: iso(e), key: `${period === "payroll" ? "p" : "m"}:${from}` };
}

/** Skýrslutímabil miðað við daginn í dag. */
export function reportRange(range: ReportRange, now: Date): { from: string; to: string } {
  const today = iso(now);
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  const mon = addDays(today, 1 - dow);
  switch (range) {
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: y }; }
    case "this_week": return { from: mon, to: today };
    case "last_week": return { from: addDays(mon, -7), to: addDays(mon, -1) };
    case "this_month": return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "last_month": return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
}

/** Er skýrslan á dagskrá í dag (og klukkan orðin)? Cron keyrir kl. 8 að morgni. */
export function reportDue(s: ReportSchedule, now: Date): boolean {
  if (now.getHours() < (s.hour ?? 8)) return false;
  if (s.freq === "daily") return true;
  if (s.freq === "monthly") return now.getDate() === (s.day ?? 1);
  return (now.getDay() === 0 ? 7 : now.getDay()) === (s.weekday ?? 1);
}

type Row = Record<string, unknown>;
export function ruleFromRow(r: Row): AlertRule | null {
  const n = normalizeAlert({ kind: r.kind, params: r.params, channel: r.channel, schedule: r.schedule, recipients: r.recipients, description: r.description });
  if (!n.ok) return null;
  return {
    ...n.rule, id: r.id as string, active: r.active !== false, createdVia: r.created_via === "ai" ? "ai" : "ui",
    createdBy: (r.created_by as string | null) ?? null, lastFiredAt: (r.last_fired_at as string | null) ?? null, createdAt: String(r.created_at ?? ""),
  };
}

type Recipient = { id: string; email: string | null; name: string };

/** Viðtakendur: valdir notendur (eigendur/vaktstjórar fyrirtækisins), annars sá sem bjó regluna til, annars eigendur. */
async function recipientsFor(db: Db, companyId: string, rule: AlertRule): Promise<Recipient[]> {
  const { data } = await db.from("users").select("id, email, full_name, role").eq("company_id", companyId).in("role", ["owner", "manager"]);
  const all = (data ?? []).map((u) => ({ id: u.id as string, email: (u.email as string | null) ?? null, name: (u.full_name as string) ?? "", role: u.role as string }));
  const want = rule.recipients.length ? rule.recipients : rule.createdBy ? [rule.createdBy] : [];
  const picked = all.filter((u) => want.includes(u.id));
  return picked.length ? picked : all.filter((u) => u.role === "owner");
}

async function deliver(rs: Recipient[], channel: AlertChannel, push: { title: string; body: string; url: string; tag: string }, email: Parameters<typeof sendVaktariEmail>[1]): Promise<number> {
  let n = 0;
  for (const r of rs) {
    if (channel !== "push" && r.email) { const res = await sendVaktariEmail(r.email, email); if (res.ok) n++; }
    if (channel !== "email") { await sendPushToUser(r.id, push); n++; }
  }
  return n;
}

/** Skráir atburð; false ef hann var þegar skráður (önnur keyrsla á undan). */
async function claim(db: Db, rule: AlertRule, companyId: string, key: string, employeeId?: string, detail?: string): Promise<boolean> {
  const { data, error } = await db.from("alert_events")
    .upsert({ rule_id: rule.id, company_id: companyId, dedupe_key: key, employee_id: employeeId ?? null, detail: detail ?? null }, { onConflict: "rule_id,dedupe_key", ignoreDuplicates: true })
    .select("id");
  return !error && (data ?? []).length > 0;
}

/** Skýrsla → þjöppuð HTML-tafla + Excel-viðhengi á eitt netfang. */
export async function emailReport(rep: ManagerReport, from: string, to: string, toEmail: string): Promise<{ ok: boolean; error?: string }> {
  if (!rep.ok) return { ok: false, error: rep.error ?? "Tókst ekki að búa til skýrsluna" };
  const cap = 40;
  const cell = (v: string | number) => (typeof v === "number" ? num(Math.round(v * 10) / 10) : esc(String(v)));
  let attachment: { filename: string; content: string } | undefined;
  try { attachment = await tableXlsxBase64({ title: rep.title, company: rep.company, from, to, columns: rep.columns, numeric: rep.numeric, rows: rep.rows }); } catch (e) { console.error("[alerts] xlsx", e); }
  const res = await sendVaktariEmail(toEmail, {
    subject: `${rep.company} · ${rep.title} · ${short(from)}–${short(to)}`,
    heading: rep.title,
    body: rep.rows.length
      ? `<b>${esc(rep.company)}</b>, ${short(from)}–${short(to)}. ${rep.rows.length} ${rep.rows.length === 1 ? "lína" : "línur"}${attachment ? "; öll skýrslan er í Excel-viðhenginu" : ""}.`
      : `<b>${esc(rep.company)}</b>, ${short(from)}–${short(to)}. Engar færslur á tímabilinu.`,
    headingEn: "Scheduled VAKTO report",
    bodyEn: `${short(from)}–${short(to)}. ${attachment ? "The full report is attached as Excel." : "Open Insights for details."}`,
    table: { columns: rep.columns.map(esc), numeric: rep.numeric, rows: rep.rows.slice(0, cap).map((r) => r.map(cell)), more: Math.max(0, rep.rows.length - cap) },
    attachment,
    ctaLabel: "Opna Innsýn", ctaLabelEn: "Open Insights", ctaHref: `${APP_URL}/innsyn`,
  });
  return res.ok ? { ok: true } : { ok: false, error: "Tókst ekki að senda póstinn" };
}

type Co = { id: string; name: string; payStart: number; employees?: Employee[] };
const employeesOf = async (db: Db, co: Co) => (co.employees ??= await loadReportEmployees(db, co.id));

async function markFired(db: Db, rule: AlertRule, key: string) {
  await db.from("alert_rules").update({ last_fired_at: new Date().toISOString(), last_period_key: key }).eq("id", rule.id);
}

const LEVEL_IS = { warn: "nálgast mörkin", will: "fer yfir miðað við planið", over: "yfir mörkum" } as const;
const LEVEL_EN = { warn: "approaching", will: "will exceed per schedule", over: "over the limit" } as const;

/** Metur eina reglu. Skilar fjölda sendinga. */
export async function evaluateRule(db: Db, co: Co, rule: AlertRule, now: Date): Promise<number> {
  const p = rule.params;
  const today = iso(now);
  const desc = describeAlert(rule, "is");

  if (rule.kind === "hours_threshold") {
    const H = p.hours ?? 0;
    const { from, to, key } = periodRange(p.period ?? "month", now, co.payStart);
    const tomorrow = addDays(today, 1);
    const ranges = [{ from, to: today < to ? today : to }];
    if (p.includePlanned && tomorrow <= to) ranges.push({ from: tomorrow, to });
    const [done, rest] = await getLaborPeriods(db, co.id, ranges);
    const restBy = new Map((rest?.staff ?? []).map((s) => [s.id, s.planned]));
    const names = new Map((await employeesOf(db, co)).map((e) => [e.id, e.fullName]));
    const ids = new Set([...done.staff.map((s) => s.id), ...restBy.keys()]);
    const hits: { id: string; name: string; actual: number; planned: number; level: "warn" | "will" | "over" }[] = [];
    for (const id of ids) {
      const actual = done.staff.find((s) => s.id === id)?.actual ?? 0;
      const planned = restBy.get(id) ?? 0;
      const level = actual >= H ? "over" : p.includePlanned && actual + planned >= H ? "will" : p.warnPct && actual >= (H * p.warnPct) / 100 ? "warn" : null;
      if (!level) continue;
      if (!(await claim(db, rule, co.id, `${key}|${id}|${level}`, id, `${actual}`))) continue;
      // Lægri stig falla niður þegar hærra stig hefur verið sent.
      for (const lower of level === "over" ? ["warn", "will"] : level === "will" ? ["warn"] : []) await claim(db, rule, co.id, `${key}|${id}|${lower}`, id);
      hits.push({ id, name: names.get(id) ?? "?", actual, planned, level });
    }
    if (!hits.length) return 0;
    await markFired(db, rule, key);
    const first = hits[0];
    const who = hits.length === 1 ? first.name : `${hits.length} starfsmenn`;
    return deliver(await recipientsFor(db, co.id, rule), rule.channel, {
      title: "VAKTO vaktari", url: "/starfsfolk", tag: `alert-${rule.id}`,
      body: hits.length === 1 ? `${first.name}: ${num(first.actual)} klst. af ${num(H)} (${LEVEL_IS[first.level]}).` : `${who} nálgast eða fara yfir ${num(H)} klst. ${short(from)}–${short(to)}.`,
    }, {
      subject: `${co.name}: ${who} ${hits.some((h) => h.level === "over") ? "yfir" : "við"} ${num(H)} klst.`,
      heading: hits.length === 1 ? `${esc(first.name)} ${LEVEL_IS[first.level]}` : `${hits.length} starfsmenn við tímamörkin`,
      body: `Vaktarinn „${esc(desc)}“ átti við á tímabilinu ${short(from)}–${short(to)}. Unnir tímar eru úr stimplunum til dagsins í dag${p.includePlanned ? ", planaðir tímar eru vaktir sem eru eftir á tímabilinu" : ""}.`,
      headingEn: "Hours alert",
      bodyEn: `${hits.length} ${hits.length === 1 ? "employee is" : "employees are"} near or over ${num(H)} hrs (${short(from)}–${short(to)}).`,
      table: {
        columns: ["Starfsmaður", "Unnið klst", ...(p.includePlanned ? ["Planað eftir", "Samtals"] : []), "Staða"],
        numeric: p.includePlanned ? [1, 2, 3] : [1],
        rows: hits.map((h) => [esc(h.name), num(h.actual), ...(p.includePlanned ? [num(h.planned), num(Math.round((h.actual + h.planned) * 10) / 10)] : []), `${LEVEL_IS[h.level]} / ${LEVEL_EN[h.level]}`]),
      },
      ctaLabel: "Opna vaktaplan", ctaLabelEn: "Open schedule", ctaHref: `${APP_URL}/vaktaplan`,
    });
  }

  if (rule.kind === "overtime_threshold") {
    const H = p.hours ?? 0;
    const { from, to, key } = periodRange(p.period ?? "month", now, co.payStart);
    const rep = await buildManagerReport({ db, companyId: co.id, companyName: co.name, employees: await employeesOf(db, co) }, "overtime", from, today < to ? today : to);
    if (!rep.ok) return 0;
    const hits: { name: string; ot: number; pay: number }[] = [];
    for (const r of rep.rows) {
      const name = String(r[0]), ot = Number(r[2]) || 0;
      if (ot < H) continue;
      if (!(await claim(db, rule, co.id, `${key}|${name}|over`, undefined, `${ot}`))) continue;
      hits.push({ name, ot, pay: Number(r[3]) || 0 });
    }
    if (!hits.length) return 0;
    await markFired(db, rule, key);
    const who = hits.length === 1 ? hits[0].name : `${hits.length} starfsmenn`;
    return deliver(await recipientsFor(db, co.id, rule), rule.channel, {
      title: "VAKTO vaktari", url: "/innsyn", tag: `alert-${rule.id}`,
      body: `${who}: yfir ${num(H)} yfirvinnutímum ${short(from)}–${short(to)}.`,
    }, {
      subject: `${co.name}: ${who} yfir ${num(H)} yfirvinnutímum`,
      heading: `Yfirvinna yfir ${num(H)} klst.`,
      body: `Vaktarinn „${esc(desc)}“ átti við á tímabilinu ${short(from)}–${short(to)}. Yfirvinna reiknast eftir reglum hvers starfsmanns, eins og í Skýrslusafninu.`,
      headingEn: "Overtime alert",
      bodyEn: `${hits.length} ${hits.length === 1 ? "employee is" : "employees are"} over ${num(H)} overtime hrs (${short(from)}–${short(to)}).`,
      table: { columns: ["Starfsmaður", "Yfirvinna klst", "Yfirvinnukostn. kr"], numeric: [1, 2], rows: hits.map((h) => [esc(h.name), num(h.ot), nf(h.pay)]) },
      ctaLabel: "Opna Innsýn", ctaLabelEn: "Open Insights", ctaHref: `${APP_URL}/innsyn`,
    });
  }

  if (rule.kind === "labor_pct_above") {
    const { from, to, key } = periodRange(p.period === "week" ? "week" : "month", now, co.payStart);
    // Dagurinn í dag er ekki búinn — miðum við gærdaginn.
    const end = addDays(today, -1) < to ? addDays(today, -1) : to;
    if (end < from) return 0;
    const lp = await getLaborPct(db, co.id, from, end);
    if (lp.pct == null || lp.pct <= (p.pct ?? 100)) return 0;
    if (!(await claim(db, rule, co.id, key, undefined, `${lp.pct}`))) return 0;
    await markFired(db, rule, key);
    const est = lp.revenueSource === "estimated" || lp.revenueSource === "mixed";
    return deliver(await recipientsFor(db, co.id, rule), rule.channel, {
      title: "VAKTO vaktari", url: "/maelabord", tag: `alert-${rule.id}`,
      body: `Laun % af veltu er ${dec1(lp.pct)} % (${short(from)}–${short(end)}), mörkin eru ${dec1(p.pct ?? 0)} %.`,
    }, {
      subject: `${co.name}: laun % af veltu ${dec1(lp.pct)} %`,
      heading: `Laun % af veltu er ${dec1(lp.pct)} %`,
      body: `Vaktarinn „${esc(desc)}“ átti við á tímabilinu ${short(from)}–${short(end)}.${est ? " Veltan er að hluta áætluð." : ""}`,
      rows: [["Laun % af veltu", `${dec1(lp.pct)} %`], ["Mörk", `${dec1(p.pct ?? 0)} %`], ["Launakostnaður", `${nf(lp.cost)} kr`], ["Velta", `${nf(lp.revenue)} kr${est ? " (áætlað að hluta)" : ""}`], ["Unnir tímar", `${num(lp.hours)} klst`]],
      headingEn: "Labor % alert",
      bodyEn: `Labor % of revenue is ${dec1(lp.pct)}% (${short(from)}–${short(end)}), above your ${dec1(p.pct ?? 0)}% limit.`,
      ctaLabel: "Opna mælaborð", ctaLabelEn: "Open dashboard", ctaHref: `${APP_URL}/maelabord`,
    });
  }

  // Skýrsla á tímaáætlun.
  if (!rule.schedule || !p.report || !reportDue(rule.schedule, now)) return 0;
  const key = `r:${today}`;
  if (!(await claim(db, rule, co.id, key))) return 0;
  const { from, to } = reportRange(p.range ?? "last_week", now);
  const rep = await buildManagerReport({ db, companyId: co.id, companyName: co.name, employees: await employeesOf(db, co) }, p.report, from, to);
  await markFired(db, rule, key);
  const rs = await recipientsFor(db, co.id, rule);
  let n = 0;
  for (const r of rs) {
    if (rule.channel !== "push" && r.email && (await emailReport(rep, from, to, r.email)).ok) n++;
    if (rule.channel !== "email") {
      await sendPushToUser(r.id, { title: REPORT_TITLE.is[p.report], body: `${RANGE_LABEL.is[p.range ?? "last_week"]}: ${rep.rows.length} línur${rule.channel === "both" ? " — skýrslan er í tölvupóstinum" : ""}.`, url: "/innsyn", tag: `report-${rule.id}` });
      n++;
    }
  }
  return n;
}

/** Cron: allar virkar reglur allra fyrirtækja (nema demo). Þolir að 0086 vanti. */
export async function runAlerts(now = new Date()): Promise<{ ok: boolean; rules: number; sent: number; errors: number; missing?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: true, rules: 0, sent: 0, errors: 0 };
  const db = createAdminClient() as unknown as Db;
  const { data, error } = await allRows<Row>((x, y) => db.from("alert_rules").select("*").eq("active", true).order("id").range(x, y));
  if (error) return { ok: false, rules: 0, sent: 0, errors: 0, missing: true };
  const byCo = new Map<string, Row[]>();
  for (const r of data ?? []) {
    const c = r.company_id as string;
    if (isDemoCompany(c)) continue;
    if (!byCo.has(c)) byCo.set(c, []);
    byCo.get(c)!.push(r);
  }
  let rules = 0, sent = 0, errors = 0;
  for (const [companyId, rows] of byCo) {
    // Vaktarar og skýrslur á tímaáætlun fylgja Vexti og Rekstri (0089); reglur haldast ef skipt er aftur upp.
    const { data: pl } = await db.from("companies").select("plan").eq("id", companyId).maybeSingle();
    if (pl && !planAllows(asPlan(pl.plan), "alerts")) continue;
    const { data: c } = await db.from("companies").select("name").eq("id", companyId).maybeSingle();
    const pp = await db.from("companies").select("pay_period_start").eq("id", companyId).maybeSingle(); // þolir að 0036 vanti
    const ps = Number(pp.error ? 1 : pp.data?.pay_period_start);
    const co: Co = { id: companyId, name: (c?.name as string) ?? "VAKTO", payStart: Number.isFinite(ps) && ps >= 1 && ps <= 28 ? ps : 1 };
    for (const row of rows) {
      const rule = ruleFromRow(row);
      if (!rule) continue;
      rules++;
      try { sent += await evaluateRule(db, co, rule, now); } catch (e) { errors++; console.error("[alerts]", rule.id, e instanceof Error ? e.message : e); }
    }
  }
  return { ok: true, rules, sent, errors };
}
