import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { nf } from "@/lib/format";
import { isVaktoAdmin } from "@/lib/vakto-admin.server";
import { getSystemStatus, type Service } from "@/lib/system-status.server";
import { TaktikalTest } from "./taktikal-test";

export const dynamic = "force-dynamic";

function State({ s }: { s: Service["state"] }) {
  if (s === "na") return <span className="adm-status off">Engin stilling</span>;
  return <span className={`adm-status ${s === "on" ? "ok" : "off"}`}><i />{s === "on" ? "Tengt" : "Ekki tengt hér"}</span>;
}

// Kerfið: hvað VAKTO er byggt á, hvað er tengt í þessu umhverfi og hvar hvert stjórnborð er.
export default async function AdminSystemPage() {
  if (!(await isVaktoAdmin())) redirect("/maelabord");
  const s = await getSystemStatus();
  return (
    <>
      <PageHeader title="Kerfið" subtitle="Hvað VAKTO er byggt á, hvað er tengt og hvar þú finnur hvert stjórnborð" />

      <div className="adm-grid e2" style={{ marginTop: 0 }}>
        <div className="card">
          <div className="ch"><div><div className="ct">Vercel</div><div className="cs">Þessi útgáfa sem þú ert að skoða núna</div></div><span className={`tag ${s.env.isProd ? "good" : "info"}`}>{s.env.name}</span></div>
          <div className="cb">
            <dl className="adm-kv">
              <dt>Útgáfa</dt><dd>{s.env.commit ? <><b>{s.env.commit}</b>{s.env.branch ? ` á ${s.env.branch}` : ""}</> : "Staðbundin keyrsla"}</dd>
              <dt>Síðasta breyting</dt><dd>{s.env.message ?? "—"}</dd>
              <dt>Svæði</dt><dd>{s.env.region ?? "—"}{s.env.region === "dub1" ? " (Dublin)" : ""}</dd>
              <dt>Slóð</dt><dd className="muted">{s.env.url ?? "localhost"}</dd>
              <dt>Lén</dt><dd>vakto.is (kerfið og heimasíðan) · admin.vakto.is (þetta svæði)</dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="ch">
            <div><div className="ct">Supabase</div><div className="cs">{s.supabase.label}{s.supabase.ref ? ` · ${s.supabase.ref}` : ""}</div></div>
            <span className={`adm-status ${s.supabase.reachable ? "ok" : "err"}`}><i />{s.supabase.reachable ? `Svarar${s.supabase.latencyMs !== null ? ` · ${s.supabase.latencyMs} ms` : ""}` : "Svarar ekki"}</span>
          </div>
          <div className="cb">
            <dl className="adm-kv" style={{ gridTemplateColumns: "1fr auto 1fr auto", columnGap: 18 }}>
              {s.supabase.counts.map((c) => <div key={c.label} style={{ display: "contents" }}><dt>{c.label}</dt><dd style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{c.n === null ? "—" : nf(c.n)}</dd></div>)}
            </dl>
          </div>
        </div>
      </div>

      {s.groups.map((g) => (
        <div className="card" style={{ marginTop: 20 }} key={g.title}>
          <div className="ch"><div><div className="ct">{g.title}</div><div className="cs">{g.sub}</div></div></div>
          <div className="cb">
            <div className="adm-svc">
              {g.services.map((v) => (
                <div key={v.name}>
                  <h4>{v.name}<State s={v.state} /></h4>
                  <p style={{ color: "var(--ink3)", fontSize: 12, fontWeight: 600 }}>{v.role}</p>
                  <p>{v.what}</p>
                  {v.note && <p style={{ color: "var(--warn)" }}>{v.note}</p>}
                  {v.link && <a href={v.link.href} target="_blank" rel="noreferrer">{v.link.label}</a>}
                  {v.name === "Taktikal" && v.state === "on" && <TaktikalTest />}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">Sjálfvirk verk</div><div className="cs">Keyra á Vercel á hverri nóttu (tímar í UTC)</div></div><span className="badge">{s.crons.length}</span></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>Verk</th><th>Hvenær</th><th>Hvað það gerir</th></tr></thead>
            <tbody>
              {s.crons.map((c) => {
                const [m, h] = c.schedule.split(" ");
                return <tr key={c.path}><td><b>{c.path.replace("/api/cron/", "")}</b></td><td style={{ whiteSpace: "nowrap" }}>Daglega kl. {h.padStart(2, "0")}:{m.padStart(2, "0")}</td><td className="muted">{c.what}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">Svona hangir þetta saman</div><div className="cs">Leið einnar beiðni í gegnum kerfið</div></div></div>
        <div className="cb" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
          <p style={{ margin: 0 }}>Notandi opnar vakto.is í vafra eða appið í símanum. Vefurinn keyrir á Vercel, sem athugar innskráningu og hlutverk áður en nokkur síða birtist. Öll gögn eru í Supabase, þar sem reglur í gagnagrunninum sjálfum tryggja að fyrirtæki sjái aðeins sín gögn. Símaappið talar beint við Supabase með sömu reglum.</p>
          <p style={{ margin: "10px 0 0" }}>Þegar eitthvað gerist sem aðrir þurfa að vita af fer póstur út um Resend og tilkynning um Expo eða vafrann. Greiðslur fara um Straum og undirskriftir um Taktikal; báðar þjónustur láta kerfið vita til baka með undirrituðum skeytum. Þetta admin-svæði les þvert á öll fyrirtæki með sérstökum þjónustulykli og er því aðeins opið VAKTO-teyminu.</p>
        </div>
      </div>
    </>
  );
}
