import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeToken, straumurConfigured } from "@/lib/straumur";
import { invoiceFor, planFor, baseModeFor, type PlanId, type BillingInterval } from "@/lib/pricing";
import { issuePaydayInvoice, issueMissingPaydayInvoices, issuePaydayClaimInvoice, paydayInvoiceState, paydayInvoicingConfigured } from "@/lib/billing-payday.server";
import { sendTrialReminderEmail, sendCardMissingEmail, sendPaymentFailedEmail, sendReceiptEmail, sendSuspendedEmail, sendKrafaIssuedEmail } from "@/lib/email";

// Áskriftarvélin: prufu-áminningar, mánaðarreikningar, gjaldtaka af skráðu korti eða krafa í heimabanka
// (Payday BGL), greiðslustaða krafna, lokun.
// Keyrt daglega af /api/cron/billing. Allt idempotent per dag/tímabil.

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

export async function ownerEmails(companyId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("users").select("email").eq("company_id", companyId).eq("role", "owner");
  return (data ?? []).map((u) => u.email as string).filter((e) => e && e.includes("@"));
}

async function usersCount(companyId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  return Math.max(1, count ?? 1);
}

/** Virkir starfsmenn á [from, to): átti vakt eða stimplaði sig (billing_usage, óháð síðari eyðingu). */
export async function activeEmployees(companyId: string, from: string, to: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("billing_usage").select("ref").eq("company_id", companyId)
    .in("kind", ["shift", "punch"]).gte("day", from).lt("day", to).limit(20000);
  return new Set((data ?? []).map((r) => r.ref as string)).size;
}

/** Fullgildar undirskriftir (Taktikal) á [from, to). */
export async function esignCount(companyId: string, from: string, to: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin.from("billing_usage").select("ref", { count: "exact", head: true })
    .eq("company_id", companyId).eq("kind", "esign").gte("day", from).lt("day", to);
  return count ?? 0;
}

/** Áætlaður mánaðarreikningur (með VSK) miðað við síðustu 30 daga — fyrir áminningar og Stillingar. */
export async function estimateMonthly(companyId: string, plan: PlanId, now = new Date(), interval: BillingInterval = "month", ai = false) {
  const to = iso(new Date(now.getTime() + 86400000)), from = iso(new Date(now.getTime() - 30 * 86400000));
  const units = plan === "v1" ? await usersCount(companyId) : await activeEmployees(companyId, from, to);
  // Árlegt: mánaðarígildi (baseYear + umfram á árlegum kjörum) — sjálft árgjaldið er 12 × baseYear.
  const a = interval === "year" ? invoiceFor(plan, units, 0, { base: "none", yearly: true, ai }) : invoiceFor(plan, units, 0, { ai });
  if (interval === "year") { const b = invoiceFor(plan, 0, 0, { base: "year" }); const monthBase = Math.round(b.base / 12); const net = monthBase + a.extra + a.ai; const vat = Math.round(net * 0.24); return { units, ...a, base: monthBase, vat, total: net + vat }; }
  return { units, ...a };
}

/** Næsti gjalddagi (upphaf næsta tímabils) frá billing_anchor. */
export function nextDueDate(anchorIso: string | null, now = new Date()): string | null {
  if (!anchorIso) return null;
  let d = new Date(anchorIso);
  while (d.getTime() <= now.getTime()) d = addMonths(d, 1);
  return iso(d);
}

type PeriodCo = { trial_ends_at?: unknown; billing_anchor?: unknown; billing_year_start?: unknown };

/** Tímabilið sem stendur yfir, sama reikniregla og runBillingDay: mánuðir frá billing_anchor (eða lokum prufu);
 *  innan greidds árs (billing_year_start + 12 mán.) lýkur tímabilinu við lok ársins. */
export function currentPeriod(co: PeriodCo, now = new Date()): { start: Date; end: Date; inTrial: boolean } {
  const trialEnds = co.trial_ends_at ? new Date(co.trial_ends_at as string) : null;
  if (trialEnds && trialEnds.getTime() > now.getTime()) return { start: now, end: trialEnds, inTrial: true };
  let start = new Date(co.billing_anchor ? (co.billing_anchor as string) : trialEnds ?? now);
  while (addMonths(start, 1).getTime() <= now.getTime()) start = addMonths(start, 1);
  let end = addMonths(start, 1);
  const ys = co.billing_year_start ? new Date(co.billing_year_start as string) : null;
  if (ys) { const ye = addMonths(ys, 12); if (start.getTime() >= ys.getTime() && start.getTime() < ye.getTime()) end = ye; }
  return { start, end, inTrial: false };
}

/** Uppsögn: aðgangur helst út greitt tímabil (eða prufuna). Yfirstandandi tímabil ógreitt → aðgangur rennur út strax (now).
 *  Skilar ISO-tíma. Eftir að tímabilinu lýkur er nýja tímabilið ógreitt (uppsögn er aldrei rukkuð) → now → lokað. */
export async function accessEndsAt(companyId: string, co: PeriodCo, now = new Date()): Promise<string> {
  const p = currentPeriod(co, now);
  if (p.inTrial) return p.end.toISOString();
  const { data } = await createAdminClient().from("invoices").select("id").eq("company_id", companyId).eq("status", "paid")
    .lte("period_start", iso(p.start)).gte("period_end", iso(p.end)).limit(1);
  return ((data?.length ?? 0) > 0 ? p.end : now).toISOString();
}

export async function activeCard(companyId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("payment_methods").select("id, token, card_summary, card_brand, card_expiry, created_at").eq("company_id", companyId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

/** Býr til reikning fyrir tímabil og reynir að taka af korti. Skilar stöðu. */
export async function chargeInvoice(invoiceId: string): Promise<"paid" | "failed" | "no_card" | "pending3ds"> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select("*").eq("id", invoiceId).single();
  if (!inv) return "failed";
  const card = await activeCard(inv.company_id as string);
  if (!card) {
    await admin.from("invoices").update({ status: "failed", last_error: "no_card", attempts: (inv.attempts as number) + 1 }).eq("id", invoiceId);
    return "no_card";
  }
  try {
    const res = await chargeToken({ token: card.token as string, amountISK: inv.total_amount as number, reference: inv.reference as string });
    if (res.resultCode === "Authorised") {
      await admin.from("invoices").update({ status: "paid", paid_at: new Date().toISOString(), payfac_reference: res.payfacReference, attempts: (inv.attempts as number) + 1, last_error: null }).eq("id", invoiceId);
      // Uppsögn ('canceled') helst þótt greiðsla berist (or: .neq eitt og sér sleppir NULL-röðum)
      await admin.from("companies").update({ billing_status: "paying" }).eq("id", inv.company_id).or("billing_status.is.null,billing_status.neq.canceled");
      return "paid";
    }
    if (res.resultCode === "RedirectShopper") {
      await admin.from("invoices").update({ status: "failed", last_error: "3ds_required", attempts: (inv.attempts as number) + 1 }).eq("id", invoiceId);
      return "pending3ds";
    }
    await admin.from("invoices").update({ status: "failed", last_error: res.resultCode, attempts: (inv.attempts as number) + 1 }).eq("id", invoiceId);
    return "failed";
  } catch (e) {
    await admin.from("invoices").update({ status: "failed", last_error: (e instanceof Error ? e.message : "error").slice(0, 300), attempts: (inv.attempts as number) + 1 }).eq("id", invoiceId);
    return "failed";
  }
}

/** Áminning um lok prufu: send þegar þetta margir dagar (eða færri) eru eftir, þ.e. á degi 10 af 14. */
export const TRIAL_REMINDER_DAYS = 4;
/** Krafa ógreidd svo mörgum dögum eftir eindaga → 'unpaid' + póstur; tvöfalt það → 'suspended'. */
export const KRAFA_GRACE_DAYS = 14;

export type PaymentMethod = "card" | "krafa";

export type BillingRunResult = { reminders: number; expired: number; invoices: number; paid: number; failed: number; suspended: number; retried: number; paydayInvoices: number; krafa: number; krafaPaid: number };

export async function runBillingDay(now = new Date()): Promise<BillingRunResult> {
  const admin = createAdminClient();
  const out: BillingRunResult = { reminders: 0, expired: 0, invoices: 0, paid: 0, failed: 0, suspended: 0, retried: 0, paydayInvoices: 0, krafa: 0, krafaPaid: 0 };
  const { data: companies, error: coErr } = await admin.from("companies")
    .select("id, name, plan, price_plan, price_v1_until, billing_interval, billing_year_start, trial_ends_at, billing_status, billing_anchor, trial_reminder_sent_at, trial_expired_sent_at, ai_addon, payment_method, country")
    .not("plan", "is", null);
  if (coErr) throw new Error(`runBillingDay: ${coErr.message} (migration 0083 keyrð?)`);
  for (const co of companies ?? []) {
    const id = co.id as string, name = (co.name as string) ?? "";
    const status = (co.billing_status as string | null) ?? null;
    if (status === "free" || status === "suspended") continue;
    // Uppsögn: aldrei rukkað né sendar áminningar; lokað þegar greiddu tímabili (eða prufu) lýkur.
    if (status === "canceled") {
      if (now.getTime() >= new Date(await accessEndsAt(id, co, now)).getTime()) {
        await admin.from("companies").update({ billing_status: "suspended" }).eq("id", id);
        out.suspended++;
      }
      continue;
    }
    const trialEnds = co.trial_ends_at ? new Date(co.trial_ends_at as string) : null;

    const method = (co.payment_method as PaymentMethod | null) ?? null;

    // 1) Áminning 4 dögum fyrir lok prufu (dagur 10): einn póstur. Kort skráð, krafa valin, eða „veldu leið“.
    if (trialEnds && !co.trial_reminder_sent_at) {
      const d = daysBetween(now, trialEnds);
      if (d >= 0 && d <= TRIAL_REMINDER_DAYS) {
        const card = await activeCard(id);
        // Fyrsti reikningur eftir prufu = grunngjald (v2: notkun í prufunni er ekki rukkuð; v1: notendur fyrirfram).
        const plan = planFor(co, now);
        const users = await usersCount(id);
        const first = invoiceFor(plan, plan === "v1" ? users : 0, 0, { ai: !!co.ai_addon });
        const note = plan === "v1" ? `${users} notendur` : `grunngjald með 5 virkum starfsmönnum`;
        const noteEn = plan === "v1" ? `${users} users` : `base fee incl. 5 active employees`;
        for (const to of await ownerEmails(id)) await sendTrialReminderEmail(to, name, { daysLeft: d, endsOn: trialEnds.toISOString(), hasCard: !!card && method !== "krafa", krafa: method === "krafa", total: first.total, note, noteEn }).catch((e) => console.error("email:", e));
        await admin.from("companies").update({ trial_reminder_sent_at: now.toISOString() }).eq("id", id);
        out.reminders++;
      }
    }
    if (trialEnds && trialEnds.getTime() > now.getTime()) continue; // enn í prufu

    // 2) Prufa búin: gjalddagi = lok prufu (anchor)
    const anchor = co.billing_anchor ? new Date(co.billing_anchor as string) : trialEnds ?? now;
    if (!co.billing_anchor) await admin.from("companies").update({ billing_anchor: iso(anchor) }).eq("id", id);

    const card = await activeCard(id);
    // Ekkert kort (eða krafa valin): innheimt með kröfu í heimabanka á kennitöluna. Aldrei lokað fyrir það eitt
    // að kort vanti. Krafa er aðeins í boði á Íslandi; erlend fyrirtæki án korts fara gömlu leiðina.
    const iceland = !co.country || co.country === "IS";
    const viaKrafa = iceland && (method === "krafa" || !card);
    if (viaKrafa && !card && method !== "card" && method !== "krafa") await admin.from("companies").update({ payment_method: "krafa" }).eq("id", id);
    if (!card && !viaKrafa) {
      if (!co.trial_expired_sent_at) {
        for (const to of await ownerEmails(id)) await sendCardMissingEmail(to, name, "expired").catch((e) => console.error("email:", e));
        await admin.from("companies").update({ trial_expired_sent_at: now.toISOString(), billing_status: "unpaid" }).eq("id", id);
        out.expired++;
      } else if (status === "unpaid" && daysBetween(new Date(co.trial_expired_sent_at as string), now) >= 14) {
        await admin.from("companies").update({ billing_status: "suspended" }).eq("id", id);
        for (const to of await ownerEmails(id)) await sendSuspendedEmail(to, name).catch((e) => console.error("email:", e));
        out.suspended++;
      }
      continue;
    }

    // 3) Reikningur fyrir tímabilið sem er hafið og hefur ekki verið reikningsfært
    let periodStart = new Date(anchor);
    while (addMonths(periodStart, 1).getTime() <= now.getTime()) periodStart = addMonths(periodStart, 1);
    if (periodStart.getTime() <= now.getTime()) {
      const { data: existing } = await admin.from("invoices").select("id, status, attempts, created_at").eq("company_id", id).eq("period_start", iso(periodStart)).maybeSingle();
      if (!existing) {
        // Grunngjald fyrirfram fyrir tímabilið sem hefst; notkun (virkir starfsmenn umfram, undirritanir)
        // gerð upp eftir á fyrir tímabilið sem lauk. Fyrsti reikningur eftir prufu: engin notkun.
        // Árlegt: árgjaldið (12 × baseYear) tekið í upphafi ársins, síðan aðeins notkun á árlegum kjörum.
        // Skipt aftur í mánaðarlegt gildir þegar greidda árið rennur út.
        const plan = planFor(co, periodStart);
        const prevStart = addMonths(periodStart, -1);
        const hasUsage = prevStart.getTime() >= anchor.getTime();
        const uFrom = iso(prevStart), uTo = iso(periodStart);
        const esigns = hasUsage ? await esignCount(id, uFrom, uTo) : 0;
        const active = hasUsage ? await activeEmployees(id, uFrom, uTo) : 0;
        const users = await usersCount(id);
        const units = plan === "v1" ? users : active;   // v1: notendur fyrirfram eins og áður
        const interval = ((co.billing_interval as string) === "year" ? "year" : "month") as BillingInterval;
        const yearStart = co.billing_year_start ? new Date(co.billing_year_start as string) : null;
        const { mode: baseMode, startYear } = baseModeFor({ interval, yearStart, periodStart });
        if (startYear) await admin.from("companies").update({ billing_year_start: iso(periodStart) }).eq("id", id);
        const yearlyRates = baseMode !== "month";
        const p = invoiceFor(plan, units, esigns, { base: baseMode, yearly: yearlyRates, ai: !!co.ai_addon });
        const periodEnd = baseMode === "year" ? addMonths(periodStart, 12) : addMonths(periodStart, 1);
        const settled = p.total === 0; // greitt ár og engin notkun umfram → skráð sem uppgert, ekkert tekið af korti
        const { data: inv } = await admin.from("invoices").insert({
          company_id: id, period_start: iso(periodStart), period_end: iso(periodEnd), users_count: users,
          active_employees: plan === "v2" ? active : null, esign_count: esigns, esign_amount: p.esign,
          usage_start: hasUsage ? uFrom : null, usage_end: hasUsage ? uTo : null, billing_interval: yearlyRates ? "year" : "month",
          base_amount: p.base, extra_amount: p.extra, ai_amount: p.ai, vat_amount: p.vat, total_amount: p.total, reference: `inv:${crypto.randomUUID()}`,
          ...(settled ? { status: "paid", paid_at: new Date().toISOString() } : {}),
          payment_method: viaKrafa ? "krafa" : "card",
        }).select("id").single();
        if (inv && settled) { await admin.from("invoices").update({ reference: `inv:${inv.id}` }).eq("id", inv.id); continue; }
        if (inv) {
          // reference verður að vísa í id-ið svo webhook finni reikninginn
          await admin.from("invoices").update({ reference: `inv:${inv.id}` }).eq("id", inv.id);
          out.invoices++;
          if (viaKrafa) {
            // Krafa í heimabanka gegnum Payday BGL. Mistekst → reikningurinn helst 'pending' og syncKrafaInvoices reynir aftur.
            const due = await issuePaydayClaimInvoice(inv.id as string, (await ownerEmails(id))[0] ?? null, now);
            if (due) {
              out.krafa++;
              for (const to of await ownerEmails(id)) await sendKrafaIssuedEmail(to, name, { total: p.total, periodStart: iso(periodStart), periodEnd: iso(periodEnd), dueDate: due }).catch((e) => console.error("email:", e));
            }
            continue;
          }
          if (!straumurConfigured()) continue;
          const r = await chargeInvoice(inv.id as string);
          if (r === "paid") { out.paid++; await issuePaydayInvoice(inv.id as string, (await ownerEmails(id))[0]); for (const to of await ownerEmails(id)) await sendReceiptEmail(to, name, { total: p.total, periodStart: iso(periodStart), periodEnd: iso(periodEnd) }).catch((e) => console.error("email:", e)); }
          else { out.failed++; await admin.from("companies").update({ billing_status: "unpaid" }).eq("id", id); for (const to of await ownerEmails(id)) await sendPaymentFailedEmail(to, name, p.total).catch((e) => console.error("email:", e)); }
        }
      } else if (!viaKrafa && existing.status === "failed" && (existing.attempts as number) < 4 && straumurConfigured()) {
        // endurreyna daglega í 3 daga
        const r = await chargeInvoice(existing.id as string);
        out.retried++;
        if (r === "paid") out.paid++;
        else if ((existing.attempts as number) + 1 >= 4 || daysBetween(new Date(existing.created_at as string), now) >= 14) {
          await admin.from("companies").update({ billing_status: "suspended" }).eq("id", id);
          for (const to of await ownerEmails(id)) await sendSuspendedEmail(to, name).catch((e) => console.error("email:", e));
          out.suspended++;
        }
      }
    }
  }
  const k = await syncKrafaInvoices(now);
  out.krafaPaid = k.paid; out.suspended += k.suspended;
  // Reikningar í Payday BGL fyrir allar greiddar færslur sem vantar enn reikning
  // (greitt í dag, endurreynt, greitt gegnum webhook, eða Payday var niðri).
  out.paydayInvoices = await issueMissingPaydayInvoices(async (cid) => (await ownerEmails(cid))[0] ?? null);
  return out;
}

/** Kröfur í heimabanka: stofna þær sem mistókust, merkja greiddar (Payday BGL) og ítreka/loka ef ógreitt.
 *  Eindagi + 14 d. ógreitt → 'unpaid' + póstur; eindagi + 28 d. → 'suspended' + póstur. Uppsögn ('canceled') er aldrei yfirskrifuð. */
export async function syncKrafaInvoices(now = new Date()): Promise<{ paid: number; unpaid: number; suspended: number }> {
  const res = { paid: 0, unpaid: 0, suspended: 0 };
  if (!paydayInvoicingConfigured()) return res;
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("invoices")
    .select("id, company_id, total_amount, period_start, period_end, payday_invoice_id, payday_attempts, due_date, overdue_sent_at")
    .eq("payment_method", "krafa").eq("status", "pending").order("created_at").limit(200);
  if (error) { console.error("[krafa-sync]", error.message); return res; }
  const keep = "billing_status.is.null,billing_status.neq.canceled";
  for (const r of rows ?? []) {
    const cid = r.company_id as string;
    try {
      const { data: co } = await admin.from("companies").select("name, billing_status").eq("id", cid).maybeSingle();
      const name = (co?.name as string) ?? "";
      if (!r.payday_invoice_id) {
        if (((r.payday_attempts as number) ?? 0) < 5) {
          const due = await issuePaydayClaimInvoice(r.id as string, (await ownerEmails(cid))[0] ?? null, now);
          if (due) for (const to of await ownerEmails(cid)) await sendKrafaIssuedEmail(to, name, { total: r.total_amount as number, periodStart: r.period_start as string, periodEnd: r.period_end as string, dueDate: due }).catch((e) => console.error("email:", e));
        }
        continue;
      }
      const st = await paydayInvoiceState(r.payday_invoice_id as string);
      if (st.status === "PAID") {
        await admin.from("invoices").update({ status: "paid", paid_at: st.paidDate ? new Date(st.paidDate).toISOString() : now.toISOString(), last_error: null }).eq("id", r.id);
        await admin.from("companies").update({ billing_status: "paying" }).eq("id", cid).or(keep);
        for (const to of await ownerEmails(cid)) await sendReceiptEmail(to, name, { total: r.total_amount as number, periodStart: r.period_start as string, periodEnd: r.period_end as string, krafa: true }).catch((e) => console.error("email:", e));
        res.paid++;
        continue;
      }
      if (st.status === "CANCELLED" || st.status === "DELETED" || st.status === "CREDIT") {
        // Felld niður í Payday (handvirkt): reikningurinn ógildur hér líka, engin ítrekun.
        await admin.from("invoices").update({ status: "void", last_error: `payday:${st.status.toLowerCase()}` }).eq("id", r.id);
        continue;
      }
      const status = (co?.billing_status as string | null) ?? null;
      if (!r.due_date || status === "free" || status === "canceled" || status === "suspended") continue;
      const late = daysBetween(new Date(r.due_date as string), now);
      if (late >= 2 * KRAFA_GRACE_DAYS) {
        await admin.from("companies").update({ billing_status: "suspended" }).eq("id", cid).or(keep);
        for (const to of await ownerEmails(cid)) await sendSuspendedEmail(to, name).catch((e) => console.error("email:", e));
        res.suspended++;
      } else if (late >= KRAFA_GRACE_DAYS && !r.overdue_sent_at) {
        await admin.from("companies").update({ billing_status: "unpaid" }).eq("id", cid).or(keep);
        await admin.from("invoices").update({ overdue_sent_at: now.toISOString() }).eq("id", r.id);
        for (const to of await ownerEmails(cid)) await sendPaymentFailedEmail(to, name, r.total_amount as number, { krafa: true, dueDate: r.due_date as string }).catch((e) => console.error("email:", e));
        res.unpaid++;
      }
    } catch (e) {
      console.error("[krafa-sync]", r.id, e instanceof Error ? e.message : e);
    }
  }
  return res;
}
