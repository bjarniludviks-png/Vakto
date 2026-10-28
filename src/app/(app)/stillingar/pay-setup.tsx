"use client";

// Stillingar → Reglur og laun: launatímabil að vild (mánaðarlegt frá hvaða degi sem er, hálfsmánaðarlegt,
// tveggja vikna, vikulegt) + hvernig yfirvinna er talin. „Sérsniðið“ tímabil í Launakeyrslum er alltaf til.

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { DateField } from "@/components/app/fields";
import { payPeriodOf, shiftPayPeriod, type PayPeriodCfg } from "@/lib/periods";
import type { OtMode } from "@/lib/payrules";
import { getPaySetup, savePaySetup } from "./pay-setup-actions";

const SEL: React.CSSProperties = { border: "1px solid var(--line)", padding: "5px 9px", font: "inherit", fontSize: 12.5 };
const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${+d}.${+m}.`; };
/** Mánudagur þessarar viku — sjálfgefinn fyrsti dagur viku-/tveggja vikna tímabils. */
const thisMonday = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function PaySetupRows() {
  const { t } = useLang();
  const [cfg, setCfg] = useState<PayPeriodCfg | null>(null);
  const [ot, setOt] = useState<OtMode>("week");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getPaySetup().then((r) => {
      if (!r) return;
      setCfg(r.period); setOt(r.otMode); setSaved(JSON.stringify([r.period, r.otMode]));
    }).catch(() => {});
  }, []);
  if (!cfg) return null;

  const kind = cfg.kind;
  const dirty = JSON.stringify([cfg, ot]) !== saved;
  const cur = payPeriodOf(todayISO(), cfg);
  const next = shiftPayPeriod(cur.from, cfg, 1);

  async function save() {
    if (!cfg) return;
    setBusy(true);
    const r = await savePaySetup({ period: cfg, otMode: ot });
    setBusy(false);
    if (r.ok) setSaved(JSON.stringify([cfg, ot]));
    toast(r.ok ? t("Launatímabil vistað") : (r.error ?? "Villa"));
  }

  return (
    <div id="launatimabil">
      <div className="statline"><span className="k">{t("Launatímabil")}</span>
        <select className="badge" style={SEL} value={kind} onChange={(e) => {
          const k = e.target.value as PayPeriodCfg["kind"];
          setCfg(k === "month" ? { kind: "month", startDay: 1 } : k === "semimonth" ? { kind: "semimonth" } : { kind: k, anchor: thisMonday() });
        }}>
          <option value="month">{t("Mánaðarlega")}</option>
          <option value="semimonth">{t("Hálfsmánaðarlega")}</option>
          <option value="biweekly">{t("Á tveggja vikna fresti")}</option>
          <option value="weekly">{t("Vikulega")}</option>
        </select>
      </div>
      {kind === "month" && (
        <div className="statline"><span className="k">{t("Tímabilið byrjar")} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t("dagur mánaðar, 1 = mánaðamót")}</span></span>
          <select className="badge" style={SEL} value={String(cfg.kind === "month" ? cfg.startDay ?? 1 : 1)}
            onChange={(e) => setCfg({ kind: "month", startDay: Number(e.target.value) })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d === 1 ? `1. → ${t("mánaðamóta")}` : `${d}. → ${d - 1}.`}</option>
            ))}
          </select>
        </div>
      )}
      {(kind === "weekly" || kind === "biweekly") && (
        <div className="statline"><span className="k">{t("Fyrsti dagur tímabils")} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t("tímabilin telja frá þessum degi")}</span></span>
          <DateField value={cfg.kind === kind ? cfg.anchor : thisMonday()} onChange={(v) => v && setCfg({ kind, anchor: v })} />
        </div>
      )}
      <div className="statline"><span className="k">{t("Yfirvinna reiknast")} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t("40 klst. á viku")}</span></span>
        <select className="badge" style={SEL} value={ot} onChange={(e) => setOt(e.target.value as OtMode)}>
          <option value="week">{t("Per almanaksviku")}</option>
          <option value="period">{t("Að meðaltali yfir launatímabilið")}</option>
        </select>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0", lineHeight: 1.5 }}>
        {t("Núverandi tímabil")}: {dm(cur.from)}–{dm(cur.to)} · {t("næsta")}: {dm(next.from)}–{dm(next.to)}{" "}
        {ot === "period"
          ? t("Vaktavinna: yfirvinna er það sem fer umfram 40 klst. á viku að meðaltali yfir tímabilið (t.d. greiðasölusamningur SGS–SA gr. 3.2.4), svo þung vika jafnast á móti léttri.")
          : t("Hver almanaksvika er gerð upp sér — allt umfram 40 klst. í viku er yfirvinna.")}{" "}
        {t("Í Launakeyrslum má alltaf velja „Sérsniðið“ tímabil.")}
      </p>
      {dirty && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? t("Vista…") : t("Vista launatímabil")}</button>
        </div>
      )}
    </div>
  );
}
