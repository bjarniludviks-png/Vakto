"use client";

// Stillingar → Tengingar → Business Central → Launabókun: hvaða bókhaldsreikninga launabókunin notar.
// Í Launakeyrslum fer svo „Senda í BC“ með samantekt tímabilsins í færslubók sem bókarinn fer yfir og bókar.
import { useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { BC_PAY_ACCOUNTS, type BcPayAccounts } from "@/lib/integrations/bc-payroll";
import { getBcPaySettings, saveBcPayAccounts, type BcPaySettings } from "./bc-actions";

type Lf = (is: string, en: string) => string;

export function BcPayModal({ L, onClose }: { L: Lf; onClose: () => void }) {
  const [s, setS] = useState<BcPaySettings | null>(null);
  const [acc, setAcc] = useState<BcPayAccounts>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void getBcPaySettings().then((r) => { if (!r) return; setS(r); setAcc({ batch: "VAKTO", ...r.accounts }); });
  }, []);

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await saveBcPayAccounts(acc);
    setBusy(false);
    if (r.ok) { toast(L("Reikningar vistaðir", "Accounts saved")); onClose(); } else setErr(r.error ?? "Villa");
  };

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="mh">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="tg-logo" style={{ width: 36, height: 36 }}><img src="/integrations/businesscentral.svg" alt="" width={22} height={22} /></span>
          <div style={{ fontSize: 16, fontWeight: 650 }}>{L("Launabókun í Business Central", "Payroll posting to Business Central")}</div><button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb tg-modal">
          {!s ? <div className="tg-small">{L("Sæki bókhaldslykilinn…", "Loading the chart of accounts…")}</div> : <>
            <div className="tg-small">{L(
              "Veldu reikningana sem launin bókast á. Í Launakeyrslum ýtir þú á „Senda í BC“ og samantekt tímabilsins fer í færslubókina hér að neðan. Ekkert er bókað fyrr en bókarinn fer yfir færsluna og bókar hana í BC. Forritið þarf heimildasettið D365 ACCOUNTANTS.",
              "Pick the accounts payroll posts to. In Payroll press “Send to BC” and the period summary lands in the journal below. Nothing is posted until your bookkeeper reviews and posts it in BC. The app needs the D365 ACCOUNTANTS permission set.")}</div>
            {s.chartError && <div className="tg-err">{s.chartError}</div>}
            <datalist id="bc-chart">{s.chart.map((a) => <option key={a.number} value={a.number}>{a.name}</option>)}</datalist>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {BC_PAY_ACCOUNTS.map((a) => {
                const v = acc[a.k] ?? "";
                const name = s.chart.find((c) => c.number === v)?.name;
                return (
                  <label className="tg-field" key={a.k}><span>{L(a.is, a.en)}</span>
                    <input list="bc-chart" value={v} onChange={(e) => setAcc((x) => ({ ...x, [a.k]: e.target.value }))} placeholder={a.optional ? L("sami og laun", "same as wages") : L("reikningsnúmer", "account no.")} autoComplete="off" />
                    {name && <small className="tg-small">{name}</small>}
                  </label>
                );
              })}
              <label className="tg-field"><span>{L("Færslubók (batch)", "Journal batch")}</span>
                <input value={acc.batch ?? ""} onChange={(e) => setAcc((x) => ({ ...x, batch: e.target.value }))} placeholder="VAKTO" autoComplete="off" /></label>
            </div>
            <div className="tg-small">{L(
              "Debet: laun (með dagpeningum og uppsöfnuðu orlofi) og launatengd gjöld (mótframlag, tryggingagjald, sjóðir). Kredit: útborgun, staðgreiðsla, lífeyrissjóðir, félög og sjóðir, tryggingagjald og orlofsskuld.",
              "Debit: wages (incl. per diems and accrued holiday pay) and payroll costs (employer pension, social security tax, funds). Credit: net pay, withholding, pension funds, unions and funds, social security tax and holiday pay.")}</div>
            {err && <div className="tg-err">{err}</div>}
            <button className="btn" disabled={busy} onClick={save}>{busy ? L("Vista…", "Saving…") : L("Vista reikninga", "Save accounts")}</button>
          </>}
        </div>
      </div>
    </div>
  );
}
