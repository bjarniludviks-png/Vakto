import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nf } from "@/lib/format";
import { AI_PACK, ESIGN_PRICE, getPlan, type PlanId } from "@/lib/plans";
import { brandName } from "@/app/(app)/stillingar/card-brand";
import { PrintButton } from "./print-button";
import { VaktoLogo } from "@/components/brand/vakto-logo";
import "./kvittun.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kvittun · VAKTO", robots: { index: false } };

// Greiðslukvittun fyrir eina greidda áskriftarfærslu. RLS (invoices_read, 0073) tryggir að
// aðeins stjórnendur fyrirtækisins sjái hana. Formlegi reikningurinn er gefinn út í Payday
// BGL (0074, billing-payday.server.ts); þegar hann er til birtist númerið og PDF-niðurhal.
const SELLER = { name: "BGL Ventures ehf.", kt: "490806-0400", email: "hallo@vakto.is", web: "vakto.is" };

const d = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : iso;
};

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/kvittun/${id}`);

  const { data: inv } = await supabase.from("invoices")
    .select("id, company_id, period_start, period_end, base_amount, extra_amount, vat_amount, total_amount, status, paid_at, reference, active_employees, users_count, esign_count, esign_amount, billing_interval, usage_start, usage_end, payday_invoice_id, payday_invoice_number, ai_amount, ai_packs, plan, legacy")
    .eq("id", id).maybeSingle();
  if (!inv || inv.status !== "paid") notFound();

  const [{ data: co }, { data: pm }] = await Promise.all([
    supabase.from("companies").select("name, kennitala, address, postal_code, city").eq("id", inv.company_id).maybeSingle(),
    supabase.from("payment_methods").select("card_brand, card_summary").eq("company_id", inv.company_id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const yearly = inv.billing_interval === "year";
  const active = (inv.active_employees as number | null) ?? (inv.users_count as number) ?? 0;
  // Leið (0089) á reikningnum; eldri reikningar: „VAKTO áskrift“ og 5 innifaldir.
  const tier = typeof inv.plan === "string" && ["free", "grunnur", "voxtur", "rekstur"].includes(inv.plan) ? getPlan(inv.plan as PlanId) : null;
  const name = tier ? `VAKTO ${tier.name}` : "VAKTO áskrift";
  const included = inv.legacy || !tier ? 5 : tier.included;
  const extraUnits = Math.max(0, active - included);
  const usage = inv.usage_start ? `${d(inv.usage_start)} – ${d(inv.usage_end)}` : undefined;
  const packs = (inv.ai_packs as number | null) ?? 0;
  const lines: { label: string; sub?: string; amount: number }[] = [];
  if ((inv.base_amount as number) > 0) lines.push({ label: yearly ? `${name}, árgjald (15% afsláttur)` : `${name}, grunngjald`, sub: `${d(inv.period_start)} – ${d(inv.period_end)}${inv.legacy ? " · eldra verð" : ""}`, amount: inv.base_amount as number });
  if ((inv.extra_amount as number) > 0) lines.push({ label: `Virkir starfsmenn umfram ${included} (${extraUnits})`, sub: usage, amount: inv.extra_amount as number });
  if (((inv.ai_amount as number | null) ?? 0) > 0) lines.push({ label: packs ? `VAKTO AI-pakkar (${packs} × ${AI_PACK.questions} spurningar)` : "VAKTO AI, viðbót", sub: usage ?? `${d(inv.period_start)} – ${d(inv.period_end)}`, amount: inv.ai_amount as number });
  if ((inv.esign_amount as number) > 0) lines.push({ label: `Undirskriftir með rafrænum skilríkjum (${inv.esign_count} × ${nf(ESIGN_PRICE)} kr)`, amount: inv.esign_amount as number });
  const net = (inv.total_amount as number) - (inv.vat_amount as number);
  const addr = [co?.address, [co?.postal_code, co?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <main className="kv">
      <div className="kv-actions">{inv.payday_invoice_id && <a className="kv-btn primary" href={`/kvittun/${inv.id}/reikningur`}>Sækja reikning nr. {inv.payday_invoice_number ?? ""} (PDF)</a>}<PrintButton /></div>
      <article className="kv-paper">
        <header className="kv-head">
          <div className="kv-logo"><VaktoLogo size={30} /></div>
          <div className="kv-title"><h1>Greiðslukvittun</h1><span>Tilvísun {String(inv.reference).replace(/^inv:/, "").slice(0, 8).toUpperCase()}</span>{inv.payday_invoice_number && <span>Reikningur nr. {inv.payday_invoice_number}</span>}</div>
        </header>

        <section className="kv-parties">
          <div><h2>Seljandi</h2><b>{SELLER.name}</b><span>kt. {SELLER.kt}</span><span>{SELLER.email} · {SELLER.web}</span></div>
          <div><h2>Kaupandi</h2><b>{co?.name ?? "—"}</b>{co?.kennitala && <span>kt. {co.kennitala}</span>}{addr && <span>{addr}</span>}</div>
          <div><h2>Greitt</h2><b>{d(inv.paid_at as string)}</b><span>{pm ? `${brandName(pm.card_brand as string)} •••• ${pm.card_summary ?? ""}` : "Greiðslukort"}</span></div>
        </section>

        <table className="kv-lines">
          <thead><tr><th>Lýsing</th><th className="num">Upphæð án VSK</th></tr></thead>
          <tbody>
            {lines.map((l) => <tr key={l.label}><td>{l.label}{l.sub && <small>{l.sub}</small>}</td><td className="num">{nf(l.amount)} kr</td></tr>)}
          </tbody>
          <tfoot>
            <tr><td>Samtals án VSK</td><td className="num">{nf(net)} kr</td></tr>
            <tr><td>Virðisaukaskattur 24%</td><td className="num">{nf(inv.vat_amount as number)} kr</td></tr>
            <tr className="kv-total"><td>Greitt með VSK</td><td className="num">{nf(inv.total_amount as number)} kr</td></tr>
          </tfoot>
        </table>

        <footer className="kv-foot">Greiðslan var tekin af skráðu greiðslukorti í gegnum Straum (Kvika banka). Spurningar: {SELLER.email}</footer>
      </article>
    </main>
  );
}
