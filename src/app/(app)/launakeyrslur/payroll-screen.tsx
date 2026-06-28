"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { Stacked } from "@/components/app/charts";
import { useLang } from "@/components/app/lang";
import { PayslipModal, type PayslipData } from "@/components/app/payslip-modal";
import type { PayrollView } from "./payroll.server";
import { runPayroll } from "./actions";

function download(format: "payday" | "excel") {
  window.location.href = `/api/payroll/export?format=${format}`;
}
async function keyra() {
  const res = await runPayroll();
  if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
  toast(res.demo ? `Launakeyrsla keyrð (demo — ${res.count} starfsm.)` : `Launakeyrsla keyrð & vistuð — ${res.count} starfsmenn`);
}

const MO = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];
const BASE = [4.8, 5.8, 3.9, 5.7, 5.6, 4.46, 4.7, 3.4, 6.7, 6.3, 5.2, 5.4];
const PAY = BASE.map((b) => [b, b * 0.22, b * 0.2, b * 0.12, b * 0.08]);

export default function PayrollScreen({ view }: { view: PayrollView }) {
  const { t } = useLang();
  const [slip, setSlip] = useState<PayslipData | null>(null);
  const ROWS = view.rows;
  const T = view.totals;
  return (
    <>
      <PageHeader
        title="Launakeyrslur"
        subtitle="Launagreiðslur · 2026"
        actions={<button className="btn ghost sm" onClick={() => download("payday")}>{t("↗ Flytja í Payday")}</button>}
      />

      <div className="dhero" style={{ marginBottom: 20 }}>
        <div className="dhero-head">
          <span className="dhero-badge">{t("Launatímabil · 21. maí – 20. júní 2026")}</span>
          <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("Drög — bíður samþykkis")}</span>
        </div>
        <div className="dhero-body">
          <div className="dflow">
            <div className="fs"><div className="l">{t("Starfsmenn")}</div><div className="v">{T.count}</div></div>
            <span className="ar">·</span>
            <div className="fs"><div className="l">{t("Unnir tímar")}</div><div className="v">{T.hours}</div></div>
            <span className="ar">·</span>
            <div className="fs"><div className="l">{t("Brúttó")}</div><div className="v">{T.grossM} <small style={{ fontSize: 14, color: "var(--ink3)", fontWeight: 600 }}>m</small></div></div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <button className="btn ghost sm" onClick={() => toast("Forskoða launakeyrslu")}>{t("Forskoða")}</button>
            <button className="btn" onClick={keyra}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12l5 5L20 6" /></svg>{t("Keyra launakeyrslu")}</button>
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Útborgað (júní)")}</div><div className="val">{T.netM} <small>m kr</small></div></div>
        <div className="kpi"><div className="lab">{t("Heildarkostnaður")}</div><div className="val">{T.costM} <small>m kr</small></div><div className="d mut">+30,2% {t("byrði")}</div></div>
        <div className="kpi"><div className="lab">{t("Staðgreiðsla")}</div><div className="val">{T.withholdingM} <small>m kr</small></div></div>
        <div className="kpi"><div className="lab">{t("Tryggingagjald")}</div><div className="val">0,40 <small>m kr</small></div></div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">{t("Launakeyrsla — sundurliðun per starfsmann")}</div><div className="cs">{t("21. maí – 20. júní 2026 · smelltu á starfsmann fyrir launaseðil")}</div></div><button className="btn ghost sm" onClick={() => download("excel")}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>{t("Allir seðlar")}</button></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>{t("Starfsmaður")}</th><th className="r">{t("Tímar")}</th><th className="r">{t("Brúttó")}</th><th className="r">{t("Staðgreiðsla")}</th><th className="r">{t("Lífeyrir+félag")}</th><th className="r">{t("Útborgað")}</th></tr></thead>
            <tbody>
              {ROWS.map((r) => (
                <tr className="rowlink" key={r.n} onClick={() => setSlip({ name: r.n, period: "21. maí – 20. júní 2026", hours: r.h, gross: r.g, withholding: r.w.replace("−", ""), pension: r.p.replace("−", ""), net: r.net })}>
                  <td><span className="who"><span className="avt" style={{ background: r.c }}>{r.av}</span> {r.n}</span></td>
                  <td className="r">{r.h}</td>
                  <td className="r">{r.g}</td>
                  <td className="r muted">{r.w}</td>
                  <td className="r muted">{r.p}</td>
                  <td className="r" style={{ color: "var(--good)" }}>{r.net}</td>
                </tr>
              ))}
              <tr className="foot">
                <td style={{ textAlign: "left" }}>{t("Samtals")} · {T.count} {t("starfsm.")}</td>
                <td className="r">{T.hours}</td><td className="r">{T.gross}</td><td className="r">{T.withholding}</td><td className="r">{T.pensionUnion}</td><td className="r">{T.net}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div><div className="ct">{t("Launakeyrslur — yfirlit")}</div><div className="cs">{t("sundurliðun eftir mánuðum")}</div></div><select className="badge" style={{ border: "1px solid var(--line)", padding: "5px 10px" }}><option>2026</option><option>2025</option></select></div>
        <div className="cb">
          <Stacked data={PAY} cols={MO} segs={["var(--good)", "var(--warn)", "var(--brand)", "var(--teal)", "#c9ccd6"]} segNames={[t("Útborgað"), t("Staðgreiðsla"), t("Lífeyrir"), t("Tryggingagjald"), t("Orlof")]} />
          <div className="legend">
            <span><i style={{ background: "var(--good)" }} />{t("Útborgað")}</span><span><i style={{ background: "var(--warn)" }} />{t("Staðgreiðsla")}</span>
            <span><i style={{ background: "var(--brand)" }} />{t("Lífeyrir")}</span><span><i style={{ background: "var(--teal)" }} />{t("Tryggingagjald")}</span><span><i style={{ background: "#c9ccd6" }} />{t("Orlof")}</span>
          </div>
        </div>
      </div>

      <div className="grid2b">
        <div className="card">
          <div className="ch"><div className="ct">{t("Byrði — júní 2026")}</div></div>
          <div className="cb">
            <div className="statline"><span className="k">{t("Brúttólaun")}</span><span className="v">5.676.918 kr</span></div>
            <div className="statline"><span className="k">{t("Orlof 10,17%")}</span><span className="v muted">+577.343 kr</span></div>
            <div className="statline"><span className="k">{t("Mótframlag lífeyris 11,5%")}</span><span className="v muted">+652.846 kr</span></div>
            <div className="statline"><span className="k">{t("Tryggingagjald 6,35%")}</span><span className="v muted">+397.146 kr</span></div>
            <div className="statline"><span className="k" style={{ fontWeight: 650, color: "var(--ink)" }}>{t("Heildarkostnaður")}</span><span className="v" style={{ fontSize: 15 }}>7.389.405 kr</span></div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Útflutningur")}</div></div>
          <div className="cb">
            <div className="att">
              <div className="it"><div className="ic good">P</div><div className="tx"><b>Payday</b><span>{t("launakeyrsla & skil — tilbúið")}</span></div><button className="btn sm" onClick={() => download("payday")}>{t("Flytja")}</button></div>
              <div className="it"><div className="ic info">XL</div><div className="tx"><b>Excel</b><span>{t("sundurliðun per starfsmann")}</span></div><button className="btn ghost sm" onClick={() => download("excel")}>{t("Sækja")}</button></div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>{t("Vakto reiknar — Payday sér um skil, greiðslur og opinbera skýrslugerð.")}</p>
          </div>
        </div>
      </div>

      {slip && <PayslipModal data={slip} onClose={() => setSlip(null)} />}
    </>
  );
}
