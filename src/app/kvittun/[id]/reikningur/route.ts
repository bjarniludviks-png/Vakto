import { createClient } from "@/lib/supabase/server";
import { paydayInvoicePdf } from "@/lib/billing-payday.server";

export const dynamic = "force-dynamic";

// PDF reiknings úr Payday BGL. Aðgangur ræðst af RLS á invoices (stjórnendur fyrirtækisins).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Fannst ekki", { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Innskráning vantar", { status: 401 });
  const { data: inv } = await supabase.from("invoices").select("payday_invoice_id, payday_invoice_number").eq("id", id).maybeSingle();
  if (!inv?.payday_invoice_id) return new Response("Fannst ekki", { status: 404 });
  try {
    const res = await paydayInvoicePdf(inv.payday_invoice_id as string);
    if (!res.ok || !res.body) { console.error("[reikningur-pdf]", res.status); return new Response("Náði ekki í reikninginn — reyndu aftur.", { status: 502 }); }
    return new Response(res.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="VAKTO-reikningur-${inv.payday_invoice_number ?? id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[reikningur-pdf]", e instanceof Error ? e.message : e);
    return new Response("Náði ekki í reikninginn — reyndu aftur.", { status: 502 });
  }
}
