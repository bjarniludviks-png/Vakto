"use client";

// Google Analytics 4 og Meta Pixel á opna vefnum (ekki inni í kerfinu), AÐEINS eftir samþykki.
// Hvort um sig óvirkt ef NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID er ekki sett.
// Valið er geymt í localStorage("vakto-consent"). Nýskráning sendir CompleteRegistration með trackSignup().
import Script from "next/script";
import { useEffect, useState } from "react";
import { useSiteLang } from "./lang";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const KEY = "vakto-consent";
const T = {
  is: { text: "Við notum vafrakökur til að mæla hvernig vefurinn er notaður og hvort auglýsingarnar okkar skila sér (Google Analytics og Meta). Ekkert er sett nema þú leyfir það.", more: "Nánar", no: "Hafna", yes: "Leyfa" },
  en: { text: "We use cookies to measure how the website is used and whether our ads work (Google Analytics and Meta). Nothing is set unless you allow it.", more: "Details", no: "Decline", yes: "Allow" },
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
  if (!GA_ID && !PIXEL_ID) return null;
  const choose = (v: "granted" | "denied") => { try { localStorage.setItem(KEY, v); } catch {} setState(v); };
  return (
    <>
      {state === "granted" && GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}</Script>
        </>
      )}
      {state === "granted" && PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}</Script>
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

/** Nýskráning tókst: segir Meta frá henni (aðeins ef gestur leyfði mælingar og pixillinn er hlaðinn). */
export function trackSignup() {
  const w = window as unknown as { fbq?: (...a: unknown[]) => void };
  try { w.fbq?.("track", "CompleteRegistration"); } catch {}
}
