"use client";

// Google Analytics 4 á opna vefnum (ekki inni í kerfinu), AÐEINS eftir samþykki.
// Óvirkt ef NEXT_PUBLIC_GA_ID er ekki sett. Valið er geymt í localStorage("vakto-consent").
import Script from "next/script";
import { useEffect, useState } from "react";
import { useSiteLang } from "./lang";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const KEY = "vakto-consent";
const T = {
  is: { text: "Við notum vafrakökur til að mæla hvernig vefurinn er notaður (Google Analytics). Ekkert er sett nema þú leyfir það.", more: "Nánar", no: "Hafna", yes: "Leyfa" },
  en: { text: "We use cookies to measure how the website is used (Google Analytics). Nothing is set unless you allow it.", more: "Details", no: "Decline", yes: "Allow" },
};

export default function SiteAnalytics() {
  const t = T[useSiteLang()];
  const [state, setState] = useState<"unknown" | "granted" | "denied" | "loading">("loading");
  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem(KEY); } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- les vafra-geymslu eftir hydration
    setState(v === "granted" || v === "denied" ? v : "unknown");
  }, []);
  if (!GA_ID) return null;
  const choose = (v: "granted" | "denied") => { try { localStorage.setItem(KEY, v); } catch {} setState(v); };
  return (
    <>
      {state === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}</Script>
        </>
      )}
      {state === "unknown" && (
        <div className="ah-consent" role="dialog" aria-label="Vafrakökur">
          <p>{t.text} <a href="/vafrakokur">{t.more}</a></p>
          <div className="ah-consent-btns">
            <button type="button" onClick={() => choose("denied")}>{t.no}</button>
            <button type="button" className="yes" onClick={() => choose("granted")}>{t.yes}</button>
          </div>
        </div>
      )}
    </>
  );
}
