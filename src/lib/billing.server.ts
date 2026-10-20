import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeToken, straumurConfigured } from "@/lib/straumur";
import { invoiceFor, planFor, baseModeFor, type PlanId, type BillingInterval } from "@/lib/pricing";
import { issuePaydayInvoice, issueMissingPaydayInvoices } from "@/lib/billing-payday.server";
import { sendTrialReminderEmail, sendCardMissingEmail, sendPaymentFailedEmail, sendReceiptEmail, sendSuspendedEmail } from "@/lib/email";
import { allRows } from "@/lib/supabase/all-rows";

// Áskriftarvélin: prufu-áminningar, mánaðarreikningar, gjaldtaka af skráðu korti, lokun.
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
  // Ein röð per starfsmann × dag × tegund → 60 manna fyrirtæki á ~2.500 raðir á mánuði. `.limit(20000)`
  // hjálpar ekki: PostgREST skilar mest 1.000 → of fáir virkir taldir. Síðað á lykli töflunnar.
  // Villa → kasta (aldrei reikningsfæra á hálfum gögnum).
  const { data, error } = await allRows<{ ref: string }>((a, b) => admin.from("billing_usage").select("ref").eq("company_id", companyId)
    .in("kind", ["shift", "punch"]).gte("day", from).lt("day", to)
    .order("kind").order("ref").order("day").range(a, b));
  if (error) throw new Error(`activeEmployees: ${error.message}`);
  return new Set((data ?? []).map((r) => r.ref)).size;
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

export type BillingRunResult = { reminders: number; expired: number; invoices: number; paid: number; failed: number; suspended: number; retried: number; paydayInvoices: number };

export async function runBillingDay(now = new Date()): Promise<BillingRunResult> {
  const admin = createAdminClient();
  const out: BillingRunResult = { reminders: 0, expired: 0, invoices: 0, paid: 0, failed: 0, suspended: 0, retried: 0, paydayInvoices: 0 };
  const { data: companies } = await admin.from("companies")
    .select("id, name, plan, price_plan, price_v1_until, billing_interval, billing_year_start, trial_ends_at, billing_status, billing_anchor, trial_reminder_sent_at, trial_expired_sent_at, ai_addon")
    .not("plan", "is", null);
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

    // 1) Áminning 3 dögum fyrir lok prufu
    if (trialEnds && !co.trial_reminder_sent_at) {
      const d = daysBetween(now, trialEnds);
      if (d >= 0 && d <= 3) {
        const card = await activeCard(id);
        // Fyrsti reikningur eftir prufu = grunngjald (v2: notkun í prufunni er ekki rukkuð; v1: notendur fyrirfram).
        const plan = planFor(co, now);
        const users = await usersCount(id);
        const first = invoiceFor(plan, plan === "v1" ? users : 0, 0, { ai: !!co.ai_addon });
        const note = plan === "v1" ? `${users} notendur` : `grunngjald með 5 virkum starfsmönnum`;
        const noteEn = plan === "v1" ? `${users} users` : `base fee incl. 5 active employees`;
        for (const to of await ownerEmails(id)) await sendTrialReminderEmail(to, name, { daysLeft: d, hasCard: !!card, total: first.total, note, noteEn }).catch((e) => console.error("email:", e));
        await admin.from("companies").update({ trial_reminder_sent_at: now.toISOString() }).eq("id", id);
        out.reminders++;
      }
    }
    if (trialEnds && trialEnds.getTime() > now.getTime()) continue; // enn í prufu

    // 2) Prufa búin: gjalddagi = lok prufu (anchor)
    const anchor = co.billing_anchor ? new Date(co.billing_anchor as string) : trialEnds ?? now;
    if (!co.billing_anchor) await admin.from("companies").update({ billing_anchor: iso(anchor) }).eq("id", id);

    const card = await activeCard(id);
    if (!card) {
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
        let active = 0;
        try { active = hasUsage ? await activeEmployees(id, uFrom, uTo) : 0; }
        catch (e) { console.error("[billing] notkun ólesanleg — reikningur bíður til morguns:", id, e); continue; } // idempotent: reynt aftur næsta dag
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
        }).select("id").single();
        if (inv && settled) { await admin.from("invoices").update({ reference: `inv:${inv.id}` }).eq("id", inv.id); continue; }
        if (inv) {
          // reference verður að vísa í id-ið svo webhook finni reikninginn
          await admin.from("invoices").update({ reference: `inv:${inv.id}` }).eq("id", inv.id);
          out.invoices++;
          if (!straumurConfigured()) continue;
          const r = await chargeInvoice(inv.id as string);
          if (r === "paid") { out.paid++; await issuePaydayInvoice(inv.id as string, (await ownerEmails(id))[0]); for (const to of await ownerEmails(id)) await sendReceiptEmail(to, name, { total: p.total, periodStart: iso(periodStart), periodEnd: iso(periodEnd) }).catch((e) => console.error("email:", e)); }
          else { out.failed++; await admin.from("companies").update({ billing_status: "unpaid" }).eq("id", id); for (const to of await ownerEmails(id)) await sendPaymentFailedEmail(to, name, p.total).catch((e) => console.error("email:", e)); }
        }
      } else if (existing.status === "failed" && (existing.attempts as number) < 4 && straumurConfigured()) {
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
  // Reikningar í Payday BGL fyrir allar greiddar færslur sem vantar enn reikning
  // (greitt í dag, endurreynt, greitt gegnum webhook, eða Payday var niðri).
  out.paydayInvoices = await issueMissingPaydayInvoices(async (cid) => (await ownerEmails(cid))[0] ?? null);
  return out;
}
