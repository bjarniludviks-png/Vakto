"use client";

// Stillingar → Reglur og laun: sjálfgefnir launaliðir fyrirtækisins (0081 companies.pay_defaults).
// Nýir og núverandi starfsmenn erfa þá nema eigin stilling sé á starfsmannaspjaldinu.

import { useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { DEFAULT_PAY, ORLOF_DAYS, orlofPctForDays, orlofDaysForPct, type PaySettings } from "@/lib/paysettings";
import { DEFAULT_ORLOF, ORLOF_MODES } from "@/lib/payrules";
import { getPayDefaults, savePayDefaults } from "./actions";

type Defaults = Partial<PaySettings> & { orlof?: { mode: string; pct: number } };
type Key = "pensionPct" | "employerPensionPct" | "unionFeePct" | "sickFundPct" | "holidayFundPct" | "educationFundPct" | "memberFundPct";
const ROWS: [Key, string, string][] = [
  ["pensionPct", "Lífeyrisiðgjald starfsmanns", ""],
  ["employerPensionPct", "Mótframlag í lífeyrissjóð", ""],
  ["unionFeePct", "Félagsgjald", "dregst af launum"],
  ["sickFundPct", "Sjúkrasjóður", "greitt af fyrirtækinu"],
  ["holidayFundPct", "Orlofssjóður stéttarfélags", "greitt af fyrirtækinu"],
  ["educationFundPct", "Starfsmenntasjóður", "greitt af fyrirtækinu"],
  ["memberFundPct", "Félagsmannasjóður", "sum félög"],
];
const SEL: React.CSSProperties = { border: "1px solid var(--line)", padding: "5px 9px", font: "inherit", fontSize: 12.5, borderRadius: 8 };
const INP: React.CSSProperties = { width: 64, border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", font: "inherit", fontSize: 12.5, textAlign: "right" };

export function PayDefaultsCard() {
  const { t } = useLang();
  const [d, setD] = useState<Defaults | null>(null);
  useEffect(() => { getPayDefaults().then((r) => setD(r ?? {})).catch(() => setD({})); }, []);
  if (!d) return null;
  const orlof = { ...DEFAULT_ORLOF, ...(d.orlof ?? {}) };
  async function save(next: Defaults) {
    setD(next);
    const r = await savePayDefaults(next);
    toast(r.ok ? t("Vistað") : (r.error ?? "Villa"));
  }
  return (<>
    <div className="statline"><span className="k">{t("Orlof")} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t("sjálfgefið fyrir starfsfólk")}</span></span>
      <span className="v" style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <select style={SEL} value={orlofDaysForPct(orlof.pct) ?? orlof.pct} aria-label={t("Orlofsdagar")}
          onChange={(e) => save({ ...d, orlof: { ...orlof, pct: orlofPctForDays(Number(e.target.value)) } })}>
          {ORLOF_DAYS.map((n) => <option key={n} value={n}>{n} {t("dagar")} ({String(orlofPctForDays(n)).replace(".", ",")}%)</option>)}
          {orlofDaysForPct(orlof.pct) == null && <option value={orlof.pct}>{String(orlof.pct).replace(".", ",")}%</option>}
        </select>
        <select style={SEL} value={orlof.mode} aria-label={t("Meðhöndlun")} onChange={(e) => save({ ...d, orlof: { ...orlof, mode: e.target.value } })}>
          {ORLOF_MODES.map((m) => <option key={m.key} value={m.key}>{t(m.label)}</option>)}
        </select>
      </span>
    </div>
    {ROWS.map(([k, label, hint]) => (
      <div className="statline" key={k}><span className="k">{t(label)}{hint && <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}> · {t(hint)}</span>}</span>
        <span className="v"><input inputMode="decimal" aria-label={t(label)} style={INP}
          defaultValue={String(d[k] ?? DEFAULT_PAY[k]).replace(".", ",")}
          onBlur={(e) => { const v = Number(e.target.value.replace(",", ".")); if (!Number.isFinite(v) || v < 0 || v > 30 || v === (d[k] ?? DEFAULT_PAY[k])) return; void save({ ...d, [k]: v }); }} /> %</span>
      </div>
    ))}
    <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0", lineHeight: 1.5 }}>{t("Gildir fyrir allt starfsfólk nema annað sé stillt á starfsmannaspjaldinu (Laun → Skattkort, lífeyrir og sjóðir). Prósentur stéttarfélaga eru mismunandi — yfirfarðu þær gegn þínu félagi.")}</p>
  </>);
}
