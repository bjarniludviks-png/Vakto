"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { EmptyState } from "@/components/app/empty-state";
import { nf, dec1 } from "@/lib/format";

// Period factors relative to the weekly baseline (demo analytics scale by period).
const PERIODS = ["Dagur", "Vika", "Mánuður", "Ársfj.", "Ár"] as const;
const FACTOR: Record<string, number> = { "Dagur": 1 / 5, "Vika": 1, "Mánuður": 4.33, "Ársfj.": 13, "Ár": 52 };

/** Scale an Icelandic-formatted number string by a factor, preserving sign + decimals. */
function sc(s: string, f: number): string {
  const t = s.trim();
  const lead = t[0] === "+" ? "+" : "";
  const neg = t[0] === "−" || t[0] === "-";
  const body = t.replace(/^[+−-]/, "");
  const hadDec = body.includes(",");
  let n = parseFloat(body.replace(/\./g, "").replace(",", ".")) * f;
  if (neg) n = -n;
  const abs = hadDec ? dec1(Math.abs(n)) : nf(Math.round(Math.abs(n)));
  return (n < 0 ? "−" : lead) + abs;
}

const PVA = [
  { n: "Mína", d: "Eldhús", pl: "47,0", ac: "49,2", fr: "+2,2", frC: "var(--bad)", pw: "+1,8", cost: "207.700" },
  { n: "Bach", d: "Sal", pl: "40,0", ac: "39,1", fr: "−0,9", frC: "var(--good)", pw: "−0,4", cost: "165.100" },
  { n: "Phong", d: "Eldhús", pl: "39,0", ac: "39,4", fr: "+0,4", frC: "", pw: "+0,2", cost: "166.400" },
  { n: "Ómar", d: "Sal", pl: "40,0", ac: "48,0", fr: "+8,0", frC: "var(--bad)", pw: "+6,5", pwC: "var(--bad)", cost: "202.700" },
];
const BANK = [
  { n: "Mína", req: "162", w: "171", b: "+9,0", c: "var(--good)" },
  { n: "Ómar", req: "130", w: "148", b: "+18,0", c: "var(--bad)" },
  { n: "Ha Vu", req: "120", w: "112", b: "−8,0", c: "var(--warn)" },
  { n: "Bach", req: "162", w: "160", b: "−2,0", c: "" },
];
const LIB = [
  ["Launatímar per starfsmaður", "fyrir launakeyrslu · CSV/Excel", "Excel", "M4 6h16M4 12h16M4 18h10"],
  ["Yfirvinna & álög", "sundurliðun á álagstímum", "PDF", "M3 17l5-5 4 3 6-7"],
  ["Mæting & frávik", "seinkomur, fjarvistir, vantar útstimplun", "PDF", "CLOCK"],
  ["Orlof & réttindi", "staða orlofs og tímabanka per starfsmann", "Excel", "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5"],
];

export default function ReportsScreen({ empty = false }: { empty?: boolean }) {
  const { t } = useLang();
  const [period, setPeriod] = useState<string>("Vika");
  const f = FACTOR[period];
  if (empty) {
    return (
      <>
        <PageHeader title="Skýrslur" subtitle="Greiningar og frammistaða" />
        <EmptyState
          title="Engar skýrslur enn"
          message="Skýrslur byggja á vöktum, tímaskráningu og launakeyrslum. Bættu við starfsfólki og birtu vaktaplan — þá fyllast greiningarnar sjálfkrafa."
          ctaLabel="Bæta við starfsfólki"
          ctaHref="/starfsfolk?new=1"
        />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Skýrslur"
        subtitle="Greiningar og frammistaða"
        actions={
          <>
            <button className="btn ghost sm" onClick={() => toast("Flyt út í Excel")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>Excel</button>
            <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => toast("Sæki PDF-skýrslu")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>PDF</button>
          </>
        }
      />

      <div className="stoolbar">
        <div className="seg">{PERIODS.map((p) => <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{t(p)}</button>)}</div>
        <div className="srchbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg><input placeholder={t("Leita að starfsmanni")} /></div>
        <select className="badge" style={{ border: "1px solid var(--line)", padding: "7px 11px" }}><option>{t("Allar deildir")}</option><option>Eldhús</option><option>Sal</option></select>
        <div className="sp" style={{ flex: 1 }} />
        <span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{t("vs fyrri")} {t(period)}</span>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Velta á starfsmann")}</div><div className="val">{sc("358", f)} <small>þ kr</small></div><div className="d up">▲ 3,2%</div></div>
        <div className="kpi"><div className="lab">{t("Velta á launatíma")}</div><div className="val">11.685 <small>kr</small></div><div className="d up">▲ 2,3%</div></div>
        <div className="kpi"><div className="lab">{t("Yfirvinna % af tímum")}</div><div className="val" style={{ color: "var(--warn)" }}>4,8%</div><div className="d dn">▲ 0,7 {t("stig")}</div></div>
        <div className="kpi"><div className="lab">{t("Mætingahlutfall")}</div><div className="val" style={{ color: "var(--good)" }}>96,2%</div><div className="d up">▲ 1,1 {t("stig")}</div></div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div className="ct">{t("Vaktaplan vs raun-tímar")}</div><div className="cs">{t("áætlað á móti klukknuðum tímum — þessi vika vs fyrri vika")}</div></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Áætl. klst")}</th><th className="r">{t("Raun klst")}</th><th className="r">{t("Frávik")}</th><th className="r">{t("Fyrri vika")}</th><th className="r">{t("Raun kostn.")}</th></tr></thead>
            <tbody>
              {PVA.map((r) => (
                <tr key={r.n}>
                  <td>{r.n}</td><td>{r.d}</td><td className="r">{sc(r.pl, f)}</td><td className="r">{sc(r.ac, f)}</td>
                  <td className="r" style={r.frC ? { color: r.frC } : undefined}>{sc(r.fr, f)}</td>
                  <td className={`r${r.pwC ? "" : " muted"}`} style={r.pwC ? { color: r.pwC } : undefined}>{sc(r.pw, f)}</td>
                  <td className="r">{sc(r.cost, f)}</td>
                </tr>
              ))}
              <tr className="foot"><td style={{ textAlign: "left" }}>{t("Samtals")} · 12 {t("starfsm.")}</td><td></td><td className="r">{sc("368,0", f)}</td><td className="r">{sc("374,6", f)}</td><td className="r">{sc("+6,6", f)}</td><td className="r">{sc("+5,1", f)}</td><td className="r">{sc("1.401.900", f)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="ch"><div className="ct">{t("Tímabanki starfsfólks")}</div><div className="cs">{t("uppsafnað +/− vs vinnuskylda")}</div></div>
          <div className="cb tbl" style={{ paddingTop: 8 }}>
            <table>
              <thead><tr><th>{t("th:Starfsm.")}</th><th className="r">{t("Vinnuskylda")}</th><th className="r">{t("Unnið")}</th><th className="r">{t("Staða banka")}</th></tr></thead>
              <tbody>
                {BANK.map((r) => (
                  <tr key={r.n}><td>{r.n}</td><td className="r">{sc(r.req, f)}</td><td className="r">{sc(r.w, f)}</td><td className={`r${r.c ? "" : " muted"}`} style={r.c ? { color: r.c } : undefined}>{sc(r.b, f)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Skýrslusafn")}</div><div className="cs">{t("smelltu til að sækja — PDF eða Excel")}</div></div>
          <div className="cb att">
            {LIB.map((r) => (
              <div className="it rowlink" key={r[0]} onClick={() => toast(`Sæki: ${r[0]}`)}>
                <div className="ic info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}>
                    {r[3] === "CLOCK" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <path d={r[3]} />}
                  </svg>
                </div>
                <div className="tx"><b>{r[0]}</b><span>{r[1]}</span></div>
                <span className="badge">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
