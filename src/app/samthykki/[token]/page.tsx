import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { VaktoLogo } from "@/components/brand/vakto-logo";
import { hrs, isNum, kr, VSK, VSK_REFUND_SHARE, type ReportSnapshot } from "@/lib/verk";
import { DecideForm } from "./decide-form";
import "./samthykki.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verkskýrsla til samþykktar · VAKTO", robots: { index: false } };

// Opinber síða: viðskiptavinur verktaka skoðar verkskýrslu (tíma, efni, myndir, upphæðir) og samþykkir
// eða biður um lagfæringu. Skýrslan er fryst (snapshot) þegar hún er send — breytist ekki eftir á.

const d = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : iso; };

export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data: r } = await admin.from("job_reports").select("snapshot, status, signed_name, client_comment, decided_at, created_at").eq("token", token).maybeSingle();
  if (!r) notFound();
  const s = r.snapshot as ReportSnapshot;
  const t = s.totals;
  const onSite = s.entries.filter((e) => e.onSite).length;

  return (
    <main className="sam">
      <header className="sam-top">
        <div>
          <div className="sam-k">Verkskýrsla frá</div>
          <h1>{s.company.name}</h1>
          {s.company.kennitala && <div className="sam-sub">kt. {s.company.kennitala}</div>}
        </div>
        <span className={`sam-badge ${r.status}`}>{r.status === "approved" ? "Samþykkt" : r.status === "rejected" ? "Athugasemd send" : "Bíður samþykktar"}</span>
      </header>

      <section className="sam-card">
        <h2>{s.job.title}</h2>
        <div className="sam-meta">
          {s.job.address && <span>{s.job.address}</span>}
          <span>{d(s.from)} – {d(s.to)}</span>
          {s.client && <span>Fyrir: {s.client.name}</span>}
        </div>
        <div className="sam-kpis">
          <div><b>{hrs(t.hours)}</b><span>Vinna</span></div>
          {t.km > 0 && <div><b>{isNum(t.km)} km</b><span>Akstur</span></div>}
          <div><b>{kr(t.total)}</b><span>Samtals m. vsk.</span></div>
        </div>
        {onSite > 0 && <p className="sam-geo">Staðfest á verkstað með staðsetningu í {onSite} af {s.entries.length} skráningum.</p>}
      </section>

      {s.entries.length > 0 && (
        <section className="sam-card">
          <h3>Tímar</h3>
          <table className="sam-tbl">
            <thead><tr><th>Dagur</th><th>Tími</th><th className="r">Klst.</th><th>Lýsing</th></tr></thead>
            <tbody>
              {s.entries.map((e, i) => (
                <tr key={i}>
                  <td>{d(e.date)}</td>
                  <td>{e.start}–{e.end}{e.onSite ? <span className="sam-pin" title="Á verkstað"> ●</span> : null}</td>
                  <td className="r">{isNum(e.hours, 2)}</td>
                  <td>{[e.note, e.km ? `${e.km} km` : null].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {s.items.length > 0 && (
        <section className="sam-card">
          <h3>Efni og útlagður kostnaður</h3>
          <table className="sam-tbl">
            <thead><tr><th>Dagur</th><th>Lýsing</th><th className="r">Magn</th><th className="r">Verð</th><th className="r">Samtals</th></tr></thead>
            <tbody>
              {s.items.map((it, i) => (
                <tr key={i}>
                  <td>{d(it.date)}</td><td>{it.description}{it.kind === "expense" ? " (útlagt)" : ""}</td>
                  <td className="r">{isNum(it.quantity, 2)}</td><td className="r">{kr(it.unitPrice)}</td><td className="r">{kr(it.quantity * it.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {s.photos.length > 0 && (
        <section className="sam-card">
          <h3>Myndir</h3>
          <div className="sam-photos">
            {s.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption ?? ""} />{p.caption && <span>{p.caption}</span>}</a>
            ))}
          </div>
        </section>
      )}

      <section className="sam-card">
        <h3>Upphæðir</h3>
        <dl className="sam-sum">
          {t.labor > 0 && <><dt>Vinna ({hrs(t.hours)}{s.hourlyRate ? ` × ${kr(s.hourlyRate)}` : ""})</dt><dd>{kr(t.labor)}</dd></>}
          {t.materials > 0 && <><dt>Efni</dt><dd>{kr(t.materials)}</dd></>}
          {t.expenses > 0 && <><dt>Útlagður kostnaður</dt><dd>{kr(t.expenses)}</dd></>}
          <dt>Virðisaukaskattur {Math.round(VSK * 100)} %</dt><dd>{kr(t.vsk)}</dd>
          <dt className="tot">Samtals</dt><dd className="tot">{kr(t.total)}</dd>
        </dl>
        {t.refund > 0 && (
          <p className="sam-note">
            Ef verkið er unnið á íbúðarhúsnæði getur þú sótt um endurgreiðslu á {Math.round(VSK_REFUND_SHARE * 100)} % af virðisaukaskatti af vinnu, um <b>{kr(t.refund)}</b>, á island.is þegar reikningur hefur verið greiddur.
          </p>
        )}
      </section>

      <section className="sam-card">
        {r.status === "sent"
          ? <DecideForm token={token} />
          : <p className="sam-done">{r.status === "approved" ? "Samþykkt" : "Athugasemd send"} af {r.signed_name} {r.decided_at ? `${d(r.decided_at)} kl. ${new Date(r.decided_at).toISOString().slice(11, 16)}` : ""}.{r.client_comment ? ` „${r.client_comment}“` : ""}</p>}
      </section>

      <footer className="sam-foot"><VaktoLogo /> <span>Verkskýrsla úr VAKTO · vakto.is</span></footer>
    </main>
  );
}
