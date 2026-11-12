"use client";

// Hvað fylgir kjarasamningnum — sýnt um leið og félag er valið (Nýr starfsmaður, starfsmannaspjald → Laun):
// staðallinn sem launavélin notar (álag/yfirvinna), orlofsréttur og veikindaréttur miðað við starfsaldur.
// Sama regla og launakeyrslan (agreementFor/resolveRuleSet) og réttindin (entitlements.ts).

import { useLang } from "@/components/app/lang";
import { CUSTOM_UNION, UNION_PRESETS, agreementFor } from "@/lib/payrules";
import { AGREEMENTS_LIB, UNION_ORDER, agreementForPreset } from "@/lib/agreements";
import { AGREEMENTS, addMonths, birthDateFromKennitala, familyFor, isoDate, orlofRight, sickRight } from "@/lib/entitlements";

const pct = (n: number) => String(n).replace(".", ",");
const dm = (iso: string) => { const [y, m, d] = iso.split("-"); return `${+d}.${+m}.${y}`; };

export function AgreementSummary({ union, agreement, onAgreement, hireDate, priorMonths = 0, kennitala }: {
  union: string; agreement: string; onAgreement?: (v: string) => void;
  hireDate?: string | null; priorMonths?: number; kennitala?: string | null;
}) {
  const { t } = useLang();
  if (!union || union === CUSTOM_UNION || union.startsWith("tpl:")) return null;
  const isPreset = !!UNION_PRESETS[union];
  const auto = agreementFor(union, null);
  const used = agreementFor(union, agreement ? { agreement } : null);
  const r = UNION_PRESETS[used];
  const lib = agreementForPreset(used);
  const fam = familyFor(union) ?? familyFor(used);
  const today = isoDate(new Date());
  const start = hireDate ? addMonths(hireDate, -Math.max(0, priorMonths)) : null;
  const birth = birthDateFromKennitala(kennitala ?? null);
  const o = fam ? orlofRight({ family: fam, hireDate: start, birth, asOf: today }) : null;
  const s = fam ? sickRight({ family: fam, hireDate: start, asOf: today }) : null;
  return (
    <div className="agr-sum" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", background: "var(--panel)", fontSize: 12.5, lineHeight: 1.55, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
        <b>{t("Reiknað eftir")}: {used}</b>
        {onAgreement && (
          <select value={agreement} onChange={(e) => onAgreement(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", font: "inherit", fontSize: 12, maxWidth: "100%" }} aria-label={t("Samningur sem launin eru reiknuð eftir")}>
            <option value="">{isPreset ? union : `${t("Sjálfvirkt")} (${auto})`}</option>
            <PresetOptions />
          </select>
        )}
      </div>
      <div className="muted">
        {t("Kvöld")} {pct(r.eve)} % · {t("helgar")} {pct(r.weekend)} % · {t("nætur")} {pct(r.night)} % · {t("yfirvinna")} {pct(r.overtime)} % · {t("stórhátíð")} {pct(r.holiday)} %
        {lib && lib.status !== "verified" ? <span style={{ color: "var(--warn)" }}> · {t(lib.status === "partial" ? "staðfest að hluta" : "óstaðfest")}</span> : null}
      </div>
      {o && s ? (
        <div style={{ marginTop: 6 }}>
          <div>{t("Orlof")}: <b>{o.now.days} {t("dagar")} · {pct(o.now.pct)} %</b>{o.next ? <span className="muted"> — {o.next.days} {t("dagar")} {t("frá")} {dm(o.next.from)}</span> : null}</div>
          <div>{t("Veikindaréttur")}: <b>{s.label}</b>{s.next ? <span className="muted"> — {s.next.label} {t("frá")} {dm(s.next.from)}</span> : null}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{AGREEMENTS[fam!].name}{!hireDate ? ` · ${t("settu ráðningardag til að sjá réttinn miðað við starfsaldur")}` : ""}{!birth && o.now.days < 25 ? ` · ${t("25 dagar eftir 6 mánuði ef 22 ára — kennitalan segir til um aldur")}` : ""}</div>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 6 }}>{t("Orlofs- og veikindaréttur fyrir þetta félag er ekki kominn inn í VAKTO — fylgstu með honum handvirkt.")}</div>
      )}
    </div>
  );
}

/** Afbrigði kjarasamninga í vali, flokkuð eftir félagi (Kjarasamningasafn) — eldri staðlar VAKTO aftast. */
export function PresetOptions() {
  const listed = new Set<string>();
  const groups = UNION_ORDER.map((u) => {
    const items = AGREEMENTS_LIB.filter((a) => a.union === u && !a.legacy && !listed.has(a.preset) && (listed.add(a.preset), true));
    return { u, items };
  });
  const legacy = Object.keys(UNION_PRESETS).filter((k) => !listed.has(k));
  return (
    <>
      {groups.filter((g) => g.items.length).map((g) => (
        <optgroup key={g.u} label={g.u}>
          {g.items.map((a) => <option key={a.preset} value={a.preset}>{a.preset}</option>)}
        </optgroup>
      ))}
      {legacy.length > 0 && <optgroup label="Eldri staðlar">{legacy.map((k) => <option key={k} value={k}>{k}</option>)}</optgroup>}
    </>
  );
}
