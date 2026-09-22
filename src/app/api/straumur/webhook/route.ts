import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/straumur";
import { sendPaymentFailedEmail, sendReceiptEmail, sendCardMissingEmail } from "@/lib/email";
import { ownerEmails } from "@/lib/billing.server";

// Webhook frá Straumi: Tokenization (kort skráð), Authorization (mánaðargjald tekið),
// Token disabled/updated, Refund. Verður að svara 200 innan 15 s; Straumur endursendir annars.
export const runtime = "nodejs";

type Hook = {
  checkoutReference?: string | null; payfacReference?: string | null; merchantReference?: string | null;
  amount?: string | number | null; currency?: string | null; reason?: string | null; success?: string | boolean | null;
  hmacSignature?: string | null;
  additionalData?: Record<string, string | undefined> | null;
};

export async function POST(req: Request) {
  const expectedKey = process.env.STRAUMUR_WEBHOOK_KEY;
  if (expectedKey && req.headers.get("authorization") !== expectedKey) return NextResponse.json({ ok: false }, { status: 401 });
  let hook: Hook;
  try { hook = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!verifyWebhookSignature(hook)) {
    console.error("straumur webhook: bad signature", hook.merchantReference);
    return NextResponse.json({ ok: false, error: "signature" }, { status: 401 });
  }
  const admin = createAdminClient();
  const eventType = hook.additionalData?.eventType ?? "unknown";
  const ref = hook.merchantReference ?? "";
  const success = String(hook.success) === "true";
  const companyIdFromRef = ref.startsWith("card:") ? ref.split(":")[1] : null;
  const invoiceId = ref.startsWith("inv:") ? ref.slice(4) : null;

  // Idempotent: sama atburð tvisvar → 200 án aðgerða.
  const { error: dupErr } = await admin.from("billing_events").insert({
    company_id: companyIdFromRef, event_type: eventType, payfac_reference: hook.payfacReference ?? null,
    merchant_reference: ref || null, success, payload: hook as unknown as Record<string, unknown>,
  });
  if (dupErr && /duplicate|unique/i.test(dupErr.message)) return NextResponse.json({ ok: true, dup: true });

  try {
    if (eventType === "Tokenization" && success && hook.additionalData?.token && companyIdFromRef) {
      const token = hook.additionalData.token;
      await admin.from("payment_methods").update({ status: "disabled" }).eq("company_id", companyIdFromRef).eq("status", "active");
      await admin.from("payment_methods").upsert({
        company_id: companyIdFromRef, provider: "straumur", token, status: "active",
        card_summary: hook.additionalData.cardSummary ?? null, card_brand: hook.additionalData.paymentMethod ?? null,
        card_expiry: hook.additionalData.cardExpiryDate ?? null, checkout_reference: hook.checkoutReference ?? null,
        payfac_reference: hook.payfacReference ?? null,
      }, { onConflict: "provider,token" });
      // Kort komið: ógreidd staða (t.d. eftir kortavandræði) fer aftur í prufu/virka.
      const { data: co } = await admin.from("companies").select("billing_status, trial_ends_at").eq("id", companyIdFromRef).maybeSingle();
      if (co?.billing_status === "unpaid") {
        const trialActive = co.trial_ends_at && new Date(co.trial_ends_at as string).getTime() > Date.now();
        await admin.from("companies").update({ billing_status: trialActive ? null : "paying" }).eq("id", companyIdFromRef);
      }
    } else if (eventType === "Authorization" && invoiceId) {
      const { data: inv } = await admin.from("invoices").select("id, company_id, total_amount, period_start, period_end, status").eq("id", invoiceId).maybeSingle();
      if (inv) {
        if (success) {
          if (inv.status !== "paid") {
            await admin.from("invoices").update({ status: "paid", paid_at: new Date().toISOString(), payfac_reference: hook.payfacReference ?? null, last_error: null }).eq("id", inv.id);
            await admin.from("companies").update({ billing_status: "paying" }).eq("id", inv.company_id);
            const { data: co } = await admin.from("companies").select("name").eq("id", inv.company_id).maybeSingle();
            after(async () => { for (const to of await ownerEmails(inv.company_id as string)) await sendReceiptEmail(to, (co?.name as string) ?? "", { total: inv.total_amount as number, periodStart: inv.period_start as string, periodEnd: inv.period_end as string }).catch((e) => console.error("email:", e)); });
          }
        } else {
          await admin.from("invoices").update({ status: "failed", last_error: hook.reason ?? "refused" }).eq("id", inv.id);
          await admin.from("companies").update({ billing_status: "unpaid" }).eq("id", inv.company_id);
          const { data: co } = await admin.from("companies").select("name").eq("id", inv.company_id).maybeSingle();
          after(async () => { for (const to of await ownerEmails(inv.company_id as string)) await sendPaymentFailedEmail(to, (co?.name as string) ?? "", inv.total_amount as number).catch((e) => console.error("email:", e)); });
        }
      }
    } else if (eventType === "TokenDisabled" || eventType === "Token disabled") {
      const token = hook.additionalData?.token;
      if (token) {
        const { data: pm } = await admin.from("payment_methods").update({ status: "disabled" }).eq("token", token).select("company_id").maybeSingle();
        if (pm?.company_id) {
          const { data: co } = await admin.from("companies").select("name").eq("id", pm.company_id).maybeSingle();
          after(async () => { for (const to of await ownerEmails(pm.company_id as string)) await sendCardMissingEmail(to, (co?.name as string) ?? "", "disabled").catch((e) => console.error("email:", e)); });
        }
      }
    } else if (eventType === "TokenUpdated" || eventType === "Token updated") {
      const token = hook.additionalData?.token;
      if (token) await admin.from("payment_methods").update({ card_expiry: hook.additionalData?.cardExpiryDate ?? null, card_summary: hook.additionalData?.cardSummary ?? null }).eq("token", token);
    } else if (eventType === "Refund" && invoiceId && success) {
      await admin.from("invoices").update({ status: "refunded" }).eq("id", invoiceId);
    }
  } catch (e) {
    console.error("straumur webhook handler:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
