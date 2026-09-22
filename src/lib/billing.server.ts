import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeToken, priceFor, straumurConfigured } from "@/lib/straumur";
import { sendTrialReminderEmail, sendCardMissingEmail, sendPaymentFailedEmail, sendReceiptEmail, sendSuspendedEmail } from "@/lib/email";

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
      await admin.from("companies").update({ billing_status: "paying" }).eq("id", inv.company_id);
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

export type BillingRunResult = { reminders: number; expired: number; invoices: number; paid: number; failed: number; suspended: number; retried: number };

export async function runBillingDay(now = new Date()): Promise<BillingRunResult> {
  const admin = createAdminClient();
  const out: BillingRunResult = { reminders: 0, expired: 0, invoices: 0, paid: 0, failed: 0, suspended: 0, retried: 0 };
  const { data: companies } = await admin.from("companies")
    .select("id, name, plan, trial_ends_at, billing_status, billing_anchor, trial_reminder_sent_at, trial_expired_sent_at")
    .not("plan", "is", null);
  for (const co of companies ?? []) {
    const id = co.id as string, name = (co.name as string) ?? "";
    const status = (co.billing_status as string | null) ?? null;
    if (status === "free" || status === "suspended") continue;
    const trialEnds = co.trial_ends_at ? new Date(co.trial_ends_at as string) : null;

    // 1) Áminning 3 dögum fyrir lok prufu
    if (trialEnds && !co.trial_reminder_sent_at) {
      const d = daysBetween(now, trialEnds);
      if (d >= 0 && d <= 3) {
        const card = await activeCard(id);
        const users = await usersCount(id);
        for (const to of await ownerEmails(id)) await sendTrialReminderEmail(to, name, { daysLeft: d, hasCard: !!card, total: priceFor(users).total, users }).catch((e) => console.error("email:", e));
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
        const users = await usersCount(id);
        const p = priceFor(users);
        const { data: inv } = await admin.from("invoices").insert({
          company_id: id, period_start: iso(periodStart), period_end: iso(addMonths(periodStart, 1)), users_count: users,
          base_amount: p.base, extra_amount: p.extra, vat_amount: p.vat, total_amount: p.total, reference: `inv:${crypto.randomUUID()}`,
        }).select("id").single();
        if (inv) {
          // reference verður að vísa í id-ið svo webhook finni reikninginn
          await admin.from("invoices").update({ reference: `inv:${inv.id}` }).eq("id", inv.id);
          out.invoices++;
          if (!straumurConfigured()) continue;
          const r = await chargeInvoice(inv.id as string);
          if (r === "paid") { out.paid++; for (const to of await ownerEmails(id)) await sendReceiptEmail(to, name, { total: p.total, periodStart: iso(periodStart), periodEnd: iso(addMonths(periodStart, 1)) }).catch((e) => console.error("email:", e)); }
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
  return out;
}
