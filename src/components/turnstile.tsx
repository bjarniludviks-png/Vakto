"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile (ósýnileg bot-vörn). Birtist aðeins ef
// NEXT_PUBLIC_TURNSTILE_SITE_KEY er sett; annars skilar onToken(null) strax.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; theme?: "light" | "dark" | "auto"; callback: (t: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function Turnstile({ onToken, theme = "dark" }: { onToken: (token: string | null) => void; theme?: "light" | "dark" | "auto" }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !ref.current || !window.turnstile || idRef.current) return;
      idRef.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY, theme,
        callback: (t) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };
    if (window.turnstile) render();
    else {
      const s = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (s) s.addEventListener("load", render);
      else {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true; script.defer = true; script.dataset.turnstile = "1";
        script.addEventListener("load", render);
        document.head.appendChild(script);
      }
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} style={{ marginBottom: 14 }} />;
}
