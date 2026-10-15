"use client";

// Launaliðir starfsmanns: skattkort, lífeyrir, viðbótarlífeyrir, stéttarfélag og sjóðir (0081, employees.pay_settings).
// Tómt gildi = sjálfgefið gildi fyrirtækis (Stillingar → Reglur og laun) eða landsstaðall (src/lib/paysettings.ts).

import { useEffect, useState } from "react";
import { Autocomplete } from "@/components/app/autocomplete";
import { PENSION_FUNDS } from "@/lib/is-lists";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { nf } from "@/lib/format";
import { resolvePay, taxYear, type PaySettings } from "@/lib/paysettings";
import { getEmployeePaySettings, updateEmployee } from "./actions";

// Sama útlit og reitirnir í employees-screen.tsx.
const FLD: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 7, padding: "5px 9px", font: "inherit", fontSize: 13, background: "#fff" };
const Hint = ({ children }: { children: React.ReactNode }) => <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {children}</span>;
const Sec = ({ children }: { children: React.ReactNode }) => <div className="sec">{children}</div>;

type NumKey = "taxCardPct" | "spouseTaxCardPct" | "accumulatedAllowance" | "pensionPct" | "employerPensionPct" | "extraPensionPct" | "extraEmployerPct" | "unionFeePct" | "sickFundPct" | "holidayFundPct" | "educationFundPct" | "memberFundPct";

export function PaySettingsCard({ employeeId, orlofMode }: { employeeId: string; orlofMode: string }) {
  const { t } = useLang();
  const [own, setOwn] = useState<Partial<PaySettings>>({});
  const [co, setCo] = useState<Partial<PaySettings>>({});
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    getEmployeePaySettings(employeeId).then((r) => { if (!live) return; if (r) { setOwn(r.own); setCo(r.company); } setReady(true); });
    return () => { live = false; };
  }, [employeeId]);

  const eff = resolvePay(own, co);
  const set = <K extends keyof PaySettings>(k: K, v: PaySettings[K] | undefined) => { setOwn((o) => ({ ...o, [k]: v })); setDirty(true); };
  const numField = (k: NumKey, unit: "%" | "kr", width = 72) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input inputMode="decimal" value={own[k] != null ? String(own[k]).replace(".", ",") : ""} placeholder={String(eff[k]).replace(".", ",")}
        onChange={(ev) => { const raw = ev.target.value.replace(/\s/g, "").replace(/\./g, "").replace(",", "."); set(k, raw === "" ? undefined : (Number.isFinite(Number(raw)) ? Number(raw) : own[k]) as never); }}
        style={{ ...FLD, width, textAlign: "right" }} />
      <span className="muted" style={{ minWidth: 16 }}>{unit}</span>
    </span>
  );
  async function save() {
    setBusy(true);
    // Hreinsa tóm gildi svo fyrirtækjasjálfgildi gildi áfram.
    const clean = Object.fromEntries(Object.entries(own).filter(([, v]) => v !== undefined && v !== "" && v !== null));
    const r = await updateEmployee(employeeId, { paySettings: clean });
    setBusy(false);
    if (r.ok) { setDirty(false); toast(t("Launaliðir vistaðir")); } else toast(r.error ?? t("Villa"));
  }
  if (!ready) return <p className="muted" style={{ fontSize: 12 }}>{t("Hleð…")}</p>;
  const allowance = Math.round(taxYear(new Date().getFullYear()).allowance * (Math.min(100, eff.taxCardPct) + Math.min(100, eff.spouseTaxCardPct)) / 100);

  return (
    <>
      <Sec>{t("Skattkort")}</Sec>
      <div className="statline"><span className="k">{t("Nýting persónuafsláttar")} <Hint>{t("100% í aðalstarfi")}</Hint></span>{numField("taxCardPct", "%")}</div>
      <div className="statline"><span className="k">{t("Persónuafsláttur maka")} <Hint>{t("ef maki nýtir hann ekki")}</Hint></span>{numField("spouseTaxCardPct", "%")}</div>
      <div className="statline"><span className="k">{t("Uppsafnaður persónuafsláttur")} <Hint>{t("ónýttur fyrr á árinu, gengur á hann")}</Hint></span>{numField("accumulatedAllowance", "kr", 110)}</div>
      <div className="statline">
        <span className="k">{t("Skattþrep")} <Hint>{t("hærra þrep ef aðallaunin eru annars staðar")}</Hint></span>
        <select value={eff.startBracket} onChange={(ev) => set("startBracket", Number(ev.target.value) as 1 | 2 | 3)} style={{ ...FLD, width: 190 }}>
          <option value={1}>{t("Venjulegt (frá 1. þrepi)")}</option>
          <option value={2}>{t("Byrja í 2. þrepi")}</option>
          <option value={3}>{t("Byrja í 3. þrepi")}</option>
        </select>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>{t("Persónuafsláttur á mánuði")}: {nf(allowance)} kr. {t("Staðgreiðsla reiknast í þrepum ársins (31,49% / 37,99% / 46,29%).")}</p>

      <Sec>{t("Lífeyrissjóður")}</Sec>
      <div className="statline"><span className="k">{t("Iðgjald starfsmanns")}</span>{numField("pensionPct", "%")}</div>
      <div className="statline"><span className="k">{t("Mótframlag launagreiðanda")}</span>{numField("employerPensionPct", "%")}</div>

      <Sec>{t("Viðbótarlífeyrissparnaður")}</Sec>
      <div className="statline">
        <span className="k">{t("Vörsluaðili")}</span>
        <Autocomplete value={own.extraPensionFund ?? ""} onChange={(v) => set("extraPensionFund", v)} onCommit={() => {}} suggestions={PENSION_FUNDS}
          placeholder={t("Enginn")} style={{ width: 190 }} inputStyle={FLD} />
      </div>
      <div className="statline">
        <span className="k">{t("Framlag starfsmanns")} <Hint>{t("2–4%, dregst frá skattstofni")}</Hint></span>
        <select value={eff.extraPensionPct} onChange={(ev) => set("extraPensionPct", Number(ev.target.value))} style={{ ...FLD, width: 110 }}>
          {[0, 1, 2, 3, 4].map((p) => <option key={p} value={p}>{p ? `${p}%` : t("Ekkert")}</option>)}
        </select>
      </div>
      {eff.extraPensionPct > 0 && <div className="statline"><span className="k">{t("Mótframlag launagreiðanda")} <Hint>{t("2% skv. kjarasamningum")}</Hint></span>{numField("extraEmployerPct", "%")}</div>}

      <Sec>{t("Stéttarfélag og sjóðir")}</Sec>
      <div className="statline"><span className="k">{t("Félagsgjald")} <Hint>{t("dregst af launum")}</Hint></span>{numField("unionFeePct", "%")}</div>
      <div className="statline"><span className="k">{t("Sjúkrasjóður")} <Hint>{t("greitt af launagreiðanda")}</Hint></span>{numField("sickFundPct", "%")}</div>
      <div className="statline"><span className="k">{t("Orlofssjóður stéttarfélags")}</span>{numField("holidayFundPct", "%")}</div>
      <div className="statline"><span className="k">{t("Starfsmenntasjóður")}</span>{numField("educationFundPct", "%")}</div>
      <div className="statline"><span className="k">{t("Félagsmannasjóður")}</span>{numField("memberFundPct", "%")}</div>

      {orlofMode === "to_bank" && (<>
        <Sec>{t("Orlofsreikningur")}</Sec>
        <div className="statline">
          <span className="k">{t("Reikningsnúmer")} <Hint>{t("banki-hb-reikningur")}</Hint></span>
          <input value={own.orlofAccount ?? ""} placeholder="0000-00-000000" onChange={(ev) => set("orlofAccount", ev.target.value.replace(/[^\d-]/g, "").slice(0, 14))} style={{ ...FLD, width: 170 }} />
        </div>
      </>)}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 }}>
        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>{t("Tómir reitir nota sjálfgefin gildi fyrirtækisins (gráu tölurnar).")}</p>
        <button type="button" className="btn sm" disabled={!dirty || busy} onClick={save}>{busy ? t("Vista…") : t("Vista launaliði")}</button>
      </div>
    </>
  );
}
