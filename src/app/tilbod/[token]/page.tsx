import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { VaktoLogo } from "@/components/brand/vakto-logo";
import { isNum, kr, quoteTotals, LINE_KIND, VSK, VSK_REFUND_SHARE, type QuoteLine } from "@/lib/verk";
import { DecideQuote } from "./decide-quote";
import "../../samthykki/[token]/samthykki.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tilboð · VAKTO", robots: { index: false } };

// Opinber síða: viðskiptavinur skoðar tilboð verktaka og samþykkir það sem verksamning (eða hafnar).
const d = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : iso; };

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data: q } = await admin.from("quotes")
    .select("number, title, address, description, items, valid_until, terms, status, signed_name, client_comment, decided_at, sent_at, created_at, company_id, clients(name)")
    .eq("token", token).neq("status", "draft").maybeSingle();
  if (!q) notFound();
  const { data: co } = await admin.from("companies").select("name, kennitala").eq("id", q.company_id).maybeSingle();
  const items = (Array.isArray(q.items) ? q.items : []) as QuoteLine[];
  const t = quoteTotals(items);
  const client = (Array.isArray(q.clients) ? q.clients[0] : q.clients) as { name?: string } | null;
  const expired = q.status === "sent" && q.valid_until && String(q.valid_until) < new Date().toISOString().slice(0, 10);

  return (
    <main className="sam">
      <header className="sam-top">
        <div>
          <div className="sam-k">Tilboð nr. {q.number} frá</div>
          <h1>{co?.name ?? ""}</h1>
          {co?.kennitala && <div className="sam-sub">kt. {co.kennitala}</div>}
        </div>
        <span className={`sam-badge ${q.status === "accepted" ? "approved" : q.status === "declined" ? "rejected" : ""}`}>
          {q.status === "accepted" ? "Samþykkt" : q.status === "declined" ? "Hafnað" : expired ? "Útrunnið" : "Bíður svars"}
        </span>
      </header>

      <section className="sam-card">
        <h2>{q.title}</h2>
        <div className="sam-meta">
          {q.address && <span>{q.address}</span>}
          {client?.name && <span>Fyrir: {client.name}</span>}
          <span>Dags. {d(String(q.sent_at ?? q.created_at))}</span>
          {q.valid_until && <span>Gildir til {d(String(q.valid_until))}</span>}
        </div>
        {q.description && <p className="sam-desc">{q.description}</p>}
        <div className="sam-kpis"><div><b>{kr(t.total)}</b><span>Samtals m. vsk.</span></div><div><b>{kr(t.net)}</b><span>Án vsk.</span></div></div>
      </section>

      <section className="sam-card">
        <h3>Sundurliðun</h3>
        <table className="sam-tbl">
          <thead><tr><th>Lýsing</th><th className="r">Magn</th><th className="r">Verð</th><th className="r">Samtals</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.description}<span className="sam-sub" style={{ display: "block" }}>{LINE_KIND[it.kind] ?? "Annað"}</span></td>
                <td className="r">{isNum(it.quantity, 2)} {it.unit}</td>
                <td className="r">{kr(it.unitPrice)}</td>
                <td className="r">{kr(it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sam-card">
        <h3>Upphæðir</h3>
        <dl className="sam-sum">
          {t.labor > 0 && <><dt>Vinna</dt><dd>{kr(t.labor)}</dd></>}
          {t.materials > 0 && <><dt>Efni</dt><dd>{kr(t.materials)}</dd></>}
          {t.other > 0 && <><dt>Annað</dt><dd>{kr(t.other)}</dd></>}
          <dt>Virðisaukaskattur {Math.round(VSK * 100)} %</dt><dd>{kr(t.vsk)}</dd>
          <dt className="tot">Samtals</dt><dd className="tot">{kr(t.total)}</dd>
        </dl>
        {t.refund > 0 && <p className="sam-note">Ef verkið er unnið á íbúðarhúsnæði getur þú sótt um endurgreiðslu á {Math.round(VSK_REFUND_SHARE * 100)} % af virðisaukaskatti af vinnu, um <b>{kr(t.refund)}</b>, á island.is.</p>}
        {q.terms && <><h3 style={{ marginTop: 16 }}>Skilmálar</h3><p className="sam-desc">{q.terms}</p></>}
      </section>

      <section className="sam-card">
        {q.status === "sent" && !expired ? <DecideQuote token={token} />
          : q.status === "sent" ? <p className="sam-done">Tilboðið rann út {d(String(q.valid_until))}. Hafðu samband við {co?.name ?? "verktakann"} til að fá nýtt.</p>
          : <p className="sam-done">{q.status === "accepted" ? "Samþykkt sem verksamningur" : "Hafnað"} af {q.signed_name} {q.decided_at ? `${d(String(q.decided_at))} kl. ${new Date(String(q.decided_at)).toISOString().slice(11, 16)}` : ""}.{q.client_comment ? ` „${q.client_comment}“` : ""}</p>}
      </section>

      <footer className="sam-foot"><VaktoLogo /> <span>Tilboð úr VAKTO · vakto.is</span></footer>
    </main>
  );
}
