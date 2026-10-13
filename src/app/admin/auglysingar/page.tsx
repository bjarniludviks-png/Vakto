import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { nf, dec1 } from "@/lib/format";
import { isVaktoAdmin } from "@/lib/vakto-admin.server";
import { getMetaOverview } from "@/lib/meta-ads.server";
import { MiniBars, shortDate } from "../ui";

export const dynamic = "force-dynamic";

const RANGES = [7, 14, 30, 90] as const;
const STATUS_IS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Í gangi", cls: "good" }, PAUSED: { label: "Í pásu", cls: "mut" }, CAMPAIGN_PAUSED: { label: "Í pásu", cls: "mut" },
  ADSET_PAUSED: { label: "Í pásu", cls: "mut" }, IN_PROCESS: { label: "Í vinnslu", cls: "info" }, WITH_ISSUES: { label: "Vandamál", cls: "bad" },
  PENDING_REVIEW: { label: "Í yfirferð", cls: "info" }, DISAPPROVED: { label: "Hafnað", cls: "bad" }, ARCHIVED: { label: "Í geymslu", cls: "mut" }, DELETED: { label: "Eytt", cls: "mut" },
};

// Auglýsingar á Meta (Facebook + Instagram): lykiltölur, fjárhagur og herferðir — eingöngu lestur.
export default async function AdminAdsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  if (!(await isVaktoAdmin())) redirect("/maelabord");
  const sp = await searchParams;
  const days = (RANGES.find((r) => String(r) === sp.d) ?? 30) as (typeof RANGES)[number];
  const data = await getMetaOverview(days);

  const header = (
    <PageHeader
      title="Auglýsingar"
      subtitle="Meta — Facebook og Instagram: eyðsla, árangur og herferðir í gangi"
      actions={data.configured && data.ok ? (
        <div className="seg adm-seg">
          {RANGES.map((r) => <a key={r} href={`/admin/auglysingar?d=${r}`} className={r === days ? "on" : undefined}>{r} dagar</a>)}
        </div>
      ) : undefined}
    />
  );

  if (!data.configured) {
    return (
      <>
        {header}
        <div className="card">
          <div className="ch"><div><div className="ct">Meta er ekki tengt enn</div><div className="cs">Tvær stillingar á Vercel og þá birtast tölurnar hér</div></div></div>
          <div className="cb" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>Í Meta Business Manager: Business settings → Users → System users → búðu til notanda, gefðu honum aðgang að auglýsingareikningi VAKTO og búðu til token með réttindunum <b>ads_read</b>.</li>
              <li>Í Vercel (Production og Preview): settu <b>META_ACCESS_TOKEN</b> (tokenið) og <b>META_AD_ACCOUNT_ID</b> (númer auglýsingareikningsins).</li>
              <li>Endurbirtu (redeploy) og opnaðu þessa síðu aftur.</li>
            </ol>
            <p className="muted" style={{ fontSize: 12.5, margin: "14px 0 0" }}>Síðan les aðeins tölur — hún getur hvorki breytt herferðum né eytt peningum.</p>
          </div>
        </div>
      </>
    );
  }
  if (!data.ok) {
    return (
      <>
        {header}
        <div className="card" style={{ borderColor: "var(--bad)" }}>
          <div className="cb"><b style={{ fontSize: 13.5 }}>Gat ekki sótt gögn frá Meta</b><p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>{data.error}</p><p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Algengast: tokenið er útrunnið eða hefur ekki aðgang að reikningnum í META_AD_ACCOUNT_ID.</p></div>
        </div>
      </>
    );
  }

  const { account: a, totals: t, campaigns } = data;
  const cur = a.currency === "ISK" ? "kr" : a.currency;
  const money = (n: number) => `${a.currency === "ISK" ? nf(Math.round(n)) : dec1(n)}`;
  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const dailyBudget = active.reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
  const step = Math.max(1, Math.ceil(data.daily.length / 8));
  return (
    <>
      {header}
      <div className="kpis">
        <div className="kpi"><div className="lab">Eyðsla · {days} dagar</div><div className="val">{money(t.spend)} <small>{cur}</small></div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{money(t.spend / days)} {cur} á dag að meðaltali</div></div>
        <div className="kpi"><div className="lab">Náðist til</div><div className="val">{nf(t.reach)}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{nf(t.impressions)} birtingar · {money(t.cpm)} {cur} á 1.000</div></div>
        <div className="kpi"><div className="lab">Smellir</div><div className="val">{nf(t.clicks)}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{dec1(t.ctr)}% smellihlutfall · {money(t.cpc)} {cur} á smell</div></div>
        <div className="kpi"><div className="lab">Niðurstöður</div><div className="val">{nf(t.results)}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.results > 0 ? `${money(t.spend / t.results)} ${cur} á niðurstöðu` : "skráningar, annars smellir á hlekk"}</div></div>
      </div>

      <div className="adm-grid c2">
        <div className="card">
          <div className="ch"><div><div className="ct">Eyðsla á dag</div><div className="cs">Síðustu {days} dagar</div></div></div>
          <div className="cb">
            {data.daily.length
              ? <MiniBars vals={data.daily.map((d) => d.spend)} labels={data.daily.map((d, i) => (i % step === 0 ? shortDate(new Date(d.date)) : ""))} tips={data.daily.map((d) => `${shortDate(new Date(d.date))} · ${money(d.spend)} ${cur}`)} />
              : <p className="muted" style={{ fontSize: 13 }}>Engin eyðsla á tímabilinu.</p>}
          </div>
        </div>
        <div className="card">
          <div className="ch"><div><div className="ct">Fjárhagur</div><div className="cs">{a.name}</div></div><span className={`tag ${a.status === 1 ? "good" : "warn"}`}>{a.status === 1 ? "Reikningur virkur" : "Athuga reikning"}</span></div>
          <div className="cb">
            <dl className="adm-kv">
              <dt>Herferðir í gangi</dt><dd>{active.length} af {campaigns.length}</dd>
              <dt>Dagsfjárhagur</dt><dd>{dailyBudget > 0 ? `${money(dailyBudget)} ${cur} á dag · um ${money(dailyBudget * 30)} ${cur} á mánuði` : "Enginn dagsfjárhagur á herferðum (stilltur á auglýsingasettum eða heildarfjárhagur)"}</dd>
              <dt>Eytt frá upphafi</dt><dd>{money(a.spentAllTime)} {cur}</dd>
              <dt>Eyðsluþak</dt><dd>{a.spendCap ? `${money(a.spendCap)} ${cur} · ${money(Math.max(0, a.spendCap - a.spentAllTime))} ${cur} eftir` : "Ekkert þak á reikningnum"}</dd>
              <dt>Reikningur</dt><dd className="muted">{a.id}</dd>
            </dl>
            <a className="btn ghost sm" style={{ marginTop: 16 }} href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${a.id.replace("act_", "")}`} target="_blank" rel="noreferrer">Opna Ads Manager</a>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">Herferðir</div><div className="cs">Þær sem eru í gangi efst — tölur síðustu {days} daga</div></div><span className="badge">{campaigns.length}</span></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>Herferð</th><th>Staða</th><th className="r">Fjárhagur</th><th className="r">Eyðsla</th><th className="r">Birtingar</th><th className="r">Smellir</th><th className="r">Smellihlutfall</th><th className="r">Á smell</th><th className="r">Niðurstöður</th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b>{c.objective && <div className="muted" style={{ fontSize: 11.5 }}>{c.objective.replace(/^OUTCOME_/, "").toLowerCase()}</div>}</td>
                  <td><span className={`tag ${STATUS_IS[c.status]?.cls ?? "mut"}`}>{STATUS_IS[c.status]?.label ?? c.status}</span></td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>{c.dailyBudget ? `${money(c.dailyBudget)} / dag` : c.lifetimeBudget ? `${money(c.lifetimeBudget)} alls` : "—"}</td>
                  <td className="r"><b>{money(c.spend)}</b></td>
                  <td className="r">{nf(c.impressions)}</td>
                  <td className="r">{nf(c.clicks)}</td>
                  <td className="r">{dec1(c.ctr)}%</td>
                  <td className="r">{c.clicks ? money(c.cpc) : "—"}</td>
                  <td className="r">{nf(c.results)}</td>
                </tr>
              ))}
              {!campaigns.length && <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 22 }}>Engar herferðir á reikningnum.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
