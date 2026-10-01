"use client";

import { useLang } from "./lang";
import { toast } from "./toast";
import { exportPayslipPdf } from "@/lib/export-report";
import type { PayslipDetail } from "@/lib/doc-pdf";
import { nf, dec1 } from "@/lib/format";
import { AsyncButton } from "./async-button";

export type PayslipData = {
  name: string;
  period: string;
  hours: string;
  gross: string;
  withholding: string;
  pension: string;
  net: string;
  /** Full sundurliðun (Launakeyrslur, tímabil) — án hennar er sýnd eldri samantekt. */
  d?: PayslipDetail;
};

/** Read-only payslip view (launaseðill). Shared by Launakeyrslur + Mitt svæði. */
function Row({ label, v, strong, neg }: { label: string; v: string; strong?: boolean; neg?: boolean }) {
  return (
    <div className="statline">
      <span className="k" style={strong ? { fontWeight: 650, color: "var(--ink)" } : undefined}>{label}</span>
      <span className="v" style={{ fontWeight: strong ? 700 : 500, color: neg ? "var(--ink3)" : strong ? "var(--good)" : undefined }}>{v}</span>
    </div>
  );
}

export function PayslipModal({ data, onClose }: { data: PayslipData; onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t("Launaseðill")} — {data.name}</div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{data.period}</p>
          {data.d ? (() => {
            const d = data.d; const k = (n: number) => `${nf(Math.round(n))} kr`;
            return (<>
              {d.hours <= 0 && d.gross <= 0 && <p style={{ fontSize: 13, color: "var(--warn)", background: "var(--warn-soft)", borderRadius: 8, padding: "8px 10px", margin: "0 0 10px" }}>{t("Engar vinnustundir eru skráðar á tímabilinu og engin laun voru greidd.")}</p>}
              <Row label={t("Tímar")} v={`${dec1(d.hours)} ${t("klst")}`} />
              <Row label={d.payType === "monthly" ? t("Mánaðarlaun") : t("Tímakaup")} v={k(d.dayPay)} />
              {d.premiums > 0 && <Row label={t("Álag")} v={k(d.premiums)} />}
              {d.overtime > 0 && <Row label={t("Yfirvinnuálag")} v={k(d.overtime)} />}
              {d.uppbot > 0 && <Row label={t("Desember-/orlofsuppbót")} v={k(d.uppbot)} />}
              <Row label={t("Brúttó")} v={k(d.gross)} />
              <div className="hr" />
              <Row label={t("Lífeyrissjóður (4%)")} v={k(d.pension)} neg />
              <Row label={t("Félagsgjald")} v={k(d.unionFee)} neg />
              <Row label={t("Staðgreiðsla")} v={k(d.withholding)} neg />
              <div className="hr" />
              <Row label={t("Útborgað")} v={k(d.net)} strong />
            </>);
          })() : (<>
          <Row label={t("Tímar")} v={`${data.hours} ${t("klst")}`} />
          <Row label={t("Brúttó")} v={`${data.gross} kr`} />
          <div className="hr" />
          <Row label={t("Staðgreiðsla")} v={`${data.withholding} kr`} neg />
          <Row label={t("Lífeyrir+félag")} v={`${data.pension} kr`} neg />
          <div className="hr" />
          <Row label={t("Útborgað")} v={`${data.net} kr`} strong />
          </>)}
          <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
            <AsyncButton className="btn" onClick={async () => {
              try {
                if (data.d) { const { downloadPayslipPdf } = await import("@/lib/doc-pdf"); await downloadPayslipPdf(data.d); }
                else await exportPayslipPdf({ name: data.name, period: data.period, hours: data.hours, gross: data.gross, withholding: data.withholding, pension: data.pension, net: data.net });
              }
              catch { toast(t("Villa við útflutning")); }
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>{t("Sækja PDF")}
            </AsyncButton>
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
