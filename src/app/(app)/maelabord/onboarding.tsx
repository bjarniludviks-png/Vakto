"use client";

// „Fyrstu skrefin“ — gátlisti nýs fyrirtækis á mælaborðinu. Hvert skref hakast sjálfkrafa
// þegar það er í raun gert (dashboard.server.ts reiknar út frá gögnunum). „Fela í bili“
// felur listann í 3 daga; hnappurinn „Fyrstu skrefin · n/7“ í hausnum opnar hann aftur.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/app/lang";
import type { Onboarding } from "./dashboard.server";

type Step = { key: keyof Omit<Onboarding, "show">; title: string; why: string; cta: string; href: string };

const STEPS: Step[] = [
  { key: "hasCompanyInfo", title: "Upplýsingar fyrirtækis", why: "Kennitala og heimilisfang fara á ráðningarsamninga, launaseðla og skírteini starfsfólks.", cta: "Opna Fyrirtækið mitt", href: "/stillingar" },
  { key: "hasLocation", title: "Starfsstöð", why: "Hver vinnustaður fær sitt vaktaplan, stimpilklukku og staðsetningu við stimplun.", cta: "Bæta við starfsstöð", href: "/stillingar?new=location" },
  { key: "hasStaff", title: "Starfsfólk", why: "Skráðu starfsfólk með netfangi. Það fær boð í VAKTO-appið og getur stimplað sig, séð vaktir og beðið um frí.", cta: "Bæta við starfsmanni", href: "/starfsfolk?new=1" },
  { key: "hasPayRules", title: "Kjarasamningur og launareglur", why: "Veldu kjarasamning á hvern starfsmann (t.d. Efling eða VR) svo yfirvinna, álag og orlof reiknist rétt.", cta: "Opna launareglur", href: "/stillingar?tab=launareglur" },
  { key: "hasSchedule", title: "Fyrsta vaktaplanið", why: "Raðaðu vöktum vikunnar og smelltu á „Birta plan“. Starfsfólk fær tilkynningu í símann.", cta: "Opna vaktaplan", href: "/vaktaplan" },
  { key: "hasClockIn", title: "Fyrsta stimplunin", why: "Starfsfólk stimplar sig inn í appinu, eða þú setur stimpilklukku á spjaldtölvu á staðnum.", cta: "Setja upp stimpilklukku", href: "/stillingar?tab=tengingar" },
  { key: "hasRevenue", title: "Velta og laun %", why: "Skráðu veltu eða meðalveltu á vikudag. Þá sérðu laun sem hlutfall af veltu, mikilvægustu tölu VAKTO.", cta: "Skrá veltu", href: "/stillingar?new=revenue" },
];

const HIDE_KEY = "vakto-onb-hidden-until";
const HIDE_DAYS = 3;

export function useOnboardingHidden(): [boolean, (v: boolean) => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(HIDE_KEY) ?? 0);
      if (until > Date.now()) requestAnimationFrame(() => setHidden(true));
    } catch { /* private mode */ }
  }, []);
  const set = (v: boolean) => {
    setHidden(v);
    try {
      if (v) localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86400e3));
      else localStorage.removeItem(HIDE_KEY);
    } catch { /* private mode */ }
  };
  return [hidden, set];
}

export const onboardingProgress = (o: Onboarding) => STEPS.filter((s) => o[s.key]).length;
export const ONBOARDING_TOTAL = STEPS.length;

const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.5l4 4 10-10" /></svg>;

export function OnboardingCard({ onboarding, onHide }: { onboarding: Onboarding; onHide: () => void }) {
  const { t } = useLang();
  const firstOpen = Math.max(0, STEPS.findIndex((s) => !onboarding[s.key]));
  const [sel, setSel] = useState(firstOpen);
  const done = onboardingProgress(onboarding);
  const step = STEPS[sel];
  const isDone = onboarding[step.key];
  return (
    <div className="onb">
      <div className="ohd">
        <div>
          <h3>{t("Fyrstu skrefin")}</h3>
          <div className="osub">{done} {t("af")} {STEPS.length} {t("klárað — hvert skref hakast sjálfkrafa þegar það er gert.")}</div>
        </div>
        <button type="button" className="ohide" onClick={onHide}>{t("Fela í bili")}</button>
      </div>
      <div className="obar"><i style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
      <div className="onb2">
        <ol className="olist">
          {STEPS.map((s, i) => {
            const d = onboarding[s.key];
            return (
              <li key={s.key}>
                <button type="button" className={`ostep2${d ? " done" : ""}${i === sel ? " sel" : ""}`} onClick={() => setSel(i)}>
                  <span className="n">{d ? <Check /> : i + 1}</span>
                  <span className="t">{t(s.title)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="odetail">
          <div className="oeyebrow">{t("Skref")} {sel + 1} {t("af")} {STEPS.length}{isDone ? ` · ${t("klárað")}` : ""}</div>
          <div className="otitle">{t(step.title)}</div>
          <p className="owhy">{t(step.why)}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={step.href} className={`btn${isDone ? " ghost" : ""}`}>{t(step.cta)}</Link>
            {sel < STEPS.length - 1 && <button type="button" className="btn ghost" onClick={() => setSel(sel + 1)}>{t("Næsta skref")}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
