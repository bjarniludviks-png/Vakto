"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";

// Paired bars (this period vs previous) — mirrors paired() in the prototype.
function Paired({ a, b }: { a: number[]; b: number[] }) {
  const max = Math.max(...a, ...b) * 1.1;
  return (
    <div className="sbars" id="dcompare" style={{ height: 180 }}>
      {a.map((v, i) => (
        <div className="col" key={i}>
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
            <div style={{ width: "32%", height: `${Math.round((v / max) * 100)}%`, background: "var(--teal)", borderRadius: "5px 5px 2px 2px" }} />
            <div style={{ width: "32%", height: `${Math.round((b[i] / max) * 100)}%`, background: "var(--brand)", borderRadius: "5px 5px 2px 2px" }} />
          </div>
          <small>V{i + 1}</small>
        </div>
      ))}
    </div>
  );
}

type Onb = { show: boolean; hasLocation: boolean; hasStaff: boolean; hasSchedule: boolean; hasRevenue: boolean };

export default function DashboardScreen({ laborPct = 32.1, laborCostWeek = "1,40", hoursWeek = "374", onboarding }: { laborPct?: number; laborCostWeek?: string; hoursWeek?: string; onboarding?: Onb }) {
  const { t } = useLang();
  const [chartSeg, setChartSeg] = useState("Vika");
  const ringP = Math.round(laborPct);
  const ringColor = laborPct <= 30 ? "var(--good)" : laborPct <= 33 ? "var(--warn)" : "var(--bad)";
  const pctLabel = laborPct.toFixed(1).replace(".", ",");

  const steps = [
    { label: "Fyrirtæki & staðir", href: "/stillingar?new=location", done: !!onboarding?.hasLocation },
    { label: "Bæta við starfsfólki", href: "/starfsfolk?new=1", done: !!onboarding?.hasStaff },
    { label: "Gera fyrsta vaktaplan", href: "/vaktaplan", done: !!onboarding?.hasSchedule },
    { label: "Skrá veltu / tengja Inventra", href: "/stillingar?new=revenue", done: !!onboarding?.hasRevenue },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const curIdx = steps.findIndex((s) => !s.done);
  const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.5l4 4 10-10" /></svg>;

  // New company → getting-started experience instead of the demo dashboard.
  if (onboarding?.show) {
    return (
      <>
        <PageHeader title="Mælaborð" subtitle={t("Velkomin í VAKTO")} />
        <div className="onb">
          <div className="ohd">
            <div>
              <h3>{t("Komdu þér af stað með VAKTO")}</h3>
              <div className="osub">{doneCount} {t("af 4 skrefum kláruð — settu kerfið upp á nokkrum mínútum.")}</div>
            </div>
          </div>
          <div className="obar"><i style={{ width: `${(doneCount / 4) * 100}%` }} /></div>
          <div className="osteps">
            {steps.map((s, i) => (
              <Link href={s.href} key={s.label} className={`ostep ${s.done ? "done" : i === curIdx ? "cur" : ""}`} style={{ cursor: "pointer" }}>
                <span className="n">{s.done ? <Check /> : i + 1}</span>
                <span className="t">{t(s.label)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginTop: 20 }}>
          <div className="cb">
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              {t("Þegar þú hefur bætt við starfsfólki og birt vaktaplan birtast hér lifandi tölur — laun af tekjum, launakostnaður, frávik og yfirvinna.")}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mælaborð"
        subtitle="Þriðjudagur 23. júní 2026"
        actions={
          <button
            className="btn ghost sm"
            onClick={() => toast("Sérsníða mælaborð — dragðu til spjöld og veldu hvað þú sérð")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 6h11M4 12h7M4 18h13M17 4v4M13 10v4M19 16v4" />
            </svg>
            {t("Sérsníða")}
          </button>
        }
      />

      {/* "Í gær" hero strip */}
      <div className="dhero">
        <div className="dhero-head">
          <span className="dhero-badge">{t("Í gær · 24. júní 2026")}</span>
          <span className="dhero-sub">{t("Tímar og laun gærdagsins eru komin inn — dagurinn í dag uppfærist í rauntíma.")}</span>
        </div>
        <div className="dhero-body">
          <div className="dflow">
            <div className="fs"><div className="l">{t("Áætlaðir tímar")}</div><div className="v">374</div></div>
            <span className="ar">→</span>
            <div className="fs"><div className="l">{t("Raun tímar")}</div><div className="v" style={{ color: "var(--teal)" }}>381</div></div>
            <span className="ar">→</span>
            <div className="fs"><div className="l">{t("Frávik")}</div><div className="v" style={{ color: "var(--bad)" }}>+7</div></div>
            <span className="ar">→</span>
            <div className="fs"><div className="l">{t("Yfirvinna")}</div><div className="v" style={{ color: "var(--warn)" }}>12 <small style={{ fontSize: 14, color: "var(--ink3)", fontWeight: 600 }}>{t("klst")}</small></div></div>
          </div>
          <div className="dhero-right">
            <div className="l">{t("Launakostnaður gærdagsins")}</div>
            <div className="big">1,42 m.kr.</div>
            <div className="s2">{t("Laun% 32,4% · 47 vaktir · 8,2% yfirvinna")}</div>
          </div>
        </div>
      </div>

      {/* daily/weekly KPIs */}
      <div className="kpis">
        <div className="kpi flex">
          <div className="ring" style={{ ["--p" as string]: ringP, ["--c" as string]: ringColor }}>
            <div className="in" style={{ color: ringColor }}>{ringP}%</div>
          </div>
          <div>
            <div className="lab">{t("Laun af tekjum")}</div>
            <div className="val" style={{ fontSize: 22 }}>{pctLabel}<small>%</small></div>
            <div className="d up">▼ 0,8 {t("stig")} <span className="muted" style={{ fontWeight: 500 }}>{t("vs í gær")}</span></div>
            <Link href="/stillingar?new=revenue" className="muted" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand)", textDecoration: "none", display: "inline-block", marginTop: 2 }}>{t("Skrá veltu")}</Link>
          </div>
        </div>
        <div className="kpi"><div className="lab">{t("Launakostnaður (vika)")}</div><div className="val">{laborCostWeek} <small>m kr</small></div><div className="d dn">▲ 3,0% <span className="muted" style={{ fontWeight: 500 }}>{t("vs fyrri viku")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Unnir tímar (vika)")}</div><div className="val">{hoursWeek} <small>{t("/ 368 áætl")}</small></div><div className="d dn">+6 {t("klst")} <span className="muted" style={{ fontWeight: 500 }}>{t("yfir plani")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Yfirvinna (vika)")}</div><div className="val">18 <small>{t("klst")}</small></div><div className="d dn">▲ 4 {t("klst")} <span className="muted" style={{ fontWeight: 500 }}>{t("vs fyrri viku")}</span></div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="ch">
            <div><div className="ct">{t("Launakostnaður — samanburður")}</div><div className="cs">{t("þetta tímabil vs fyrra")}</div></div>
            <div className="seg">
              {["Vika", "Mánuður", "Ár"].map((s) => (
                <button key={s} className={chartSeg === s ? "on" : ""} onClick={() => setChartSeg(s)}>{t(s)}</button>
              ))}
            </div>
          </div>
          <div className="cb">
            <Paired a={[1.31, 1.28, 1.35, 1.22, 1.40, 1.38]} b={[1.27, 1.30, 1.29, 1.24, 1.34, 1.30]} />
            <div className="legend">
              <span><i style={{ background: "var(--teal)" }} />{t("Þetta tímabil")}</span>
              <span><i style={{ background: "var(--brand)" }} />{t("Fyrra tímabil")}</span>
            </div>
            <div className="cmpfoot">
              <div><div className="l">{t("Þetta tímabil")}</div><div className="v">1,40 m</div></div>
              <div><div className="l">{t("Fyrra tímabil")}</div><div className="v">1,36 m</div></div>
              <div><div className="l">{t("Breyting")}</div><div className="v" style={{ color: "var(--good)" }}>+3,0%</div></div>
              <div><div className="l">{t("Tímar")}</div><div className="v">374 <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 500 }}>/ 372</span></div></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="ch">
            <div><div className="ct">{t("Vinnum við eftir plani?")}</div><div className="cs">{t("raun tímar vs áætlun · þessi vika")}</div></div>
            <span className="badge" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("94% eftir plani")}</span>
          </div>
          <div className="cb att">
            <div className="it"><div className="ic bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l5-5 4 3 6-7M16 8h4v4" /></svg></div><div className="tx"><b>Ómar</b><span>48,0 raun vs 40,0 áætl · yfirvinna</span></div><span className="tag bad">+8,0 klst</span></div>
            <div className="it"><div className="ic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l5-5 4 3 6-7M16 8h4v4" /></svg></div><div className="tx"><b>Truong</b><span>42,1 raun vs 40,0 áætl</span></div><span className="tag warn">+2,1 klst</span></div>
            <div className="it"><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7l5 5 4-3 6 7M16 16h4v-4" /></svg></div><div className="tx"><b>Ha Vu</b><span>32,0 raun vs 40,0 áætl · undir plani</span></div><span className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>−8,0 klst</span></div>
            <div className="it"><div className="ic good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.5l4 4 10-10" /></svg></div><div className="tx"><b>Bach</b><span>39,1 raun vs 40,0 áætl · á áætlun</span></div><span className="tag mut" style={{ background: "var(--line2)", color: "var(--ink3)" }}>−0,9 klst</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div className="ct">{t("Þarf athygli")}</div><span className="badge">{t("3 atriði")}</span></div>
        <div className="cb att">
          <div className="it"><div className="ic bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div><div className="tx"><b>{t("Yfirvinnu-áhætta: Ómar")}</b><span>{t("18 klst yfir starfshlutfalli í mánuðinum")}</span></div><span className="tag bad">+24.500 kr</span></div>
          <div className="it"><div className="ic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v18M5 8h14M5 16h14" /></svg></div><div className="tx"><b>{t("Hvíldartími: Jón")}</b><span>{t("9 klst milli vakta — undir 11 klst lágmarki")}</span></div><span className="tag warn">{t("laga")}</span></div>
          <div className="it"><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg></div><div className="tx"><b>{t("Vantar útstimplun: Mína")}</b><span>{t("stimplaði inn 08:02, engin útstimplun í gær")}</span></div><span className="tag warn">{t("skoða")}</span></div>
        </div>
      </div>

      <div className="sec">
        {t("Mánuðurinn · júní 2026")}{" "}
        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, color: "var(--ink3)" }}>{t("· borið saman við maí")}</span>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Unnir tímar")}</div><div className="val">1.968</div><div className="d mut">+1,2% {t("vs maí")}</div></div>
        <div className="kpi"><div className="lab">{t("Launakostn. (byrði)")}</div><div className="val">7,39 <small>m kr</small></div><div className="d dn">▲ 3,1% <span className="muted" style={{ fontWeight: 500 }}>{t("vs maí")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Laun% (með byrði)")}</div><div className="val" style={{ color: "var(--warn)" }}>39,7%</div><div className="d up">▼ 1,2 {t("stig")} <span className="muted" style={{ fontWeight: 500 }}>{t("batnar")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Launaspá (mánuður)")}</div><div className="val">5,68 <small>m kr</small></div><div className="d mut">{t("brúttó · fyrir byrði")}</div></div>
      </div>
    </>
  );
}
