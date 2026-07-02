"use client";

import { useLang } from "./lang";
import { toast } from "./toast";
import { exportPayslipPdf } from "@/lib/export-report";

export type PayslipData = {
  name: string;
  period: string;
  hours: string;
  gross: string;
  withholding: string;
  pension: string;
  net: string;
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
          <Row label={t("Tímar")} v={`${data.hours} ${t("klst")}`} />
          <Row label={t("Brúttó")} v={`${data.gross} kr`} />
          <div className="hr" />
          <Row label={t("Staðgreiðsla")} v={`${data.withholding} kr`} neg />
          <Row label={t("Lífeyrir+félag")} v={`${data.pension} kr`} neg />
          <div className="hr" />
          <Row label={t("Útborgað")} v={`${data.net} kr`} strong />
          <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
            <button className="btn" onClick={async () => {
              try { await exportPayslipPdf({ name: data.name, period: data.period, hours: data.hours, gross: data.gross, withholding: data.withholding, pension: data.pension, net: data.net }); }
              catch { toast(t("Villa við útflutning")); }
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>{t("Sækja PDF")}
            </button>
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
