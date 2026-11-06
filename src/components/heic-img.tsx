"use client";

// Mynd sem ræður líka við HEIC. Eldri útgáfur appsins sendu myndir úr myndasafni iPhone sem HEIC
// (með .jpg-endingu). Safari birtir þær en Chrome/Edge ekki, svo reiturinn varð auður á tölvu.
// Ef vafrinn getur ekki birt myndina er hún sótt, breytt í JPEG í vafranum (heic-to, hlaðið
// aðeins þegar þarf) og birt úr blob-slóð. Niðurstaðan er geymd svo hver mynd er umbreytt einu sinni.

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

const cache = new Map<string, Promise<string | null>>();

/** Skilar blob-slóð með JPEG ef `url` er HEIC, annars null. */
export function heicFallback(url: string): Promise<string | null> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const head = new Uint8Array(await blob.slice(4, 12).arrayBuffer());
        const brand = String.fromCharCode(...head);
        if (!/^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(brand)) return null;
        const { heicTo } = await import("heic-to/next");
        const jpg = await heicTo({ blob, type: "image/jpeg", quality: 0.85 });
        return URL.createObjectURL(jpg);
      } catch {
        return null;
      }
    })();
    cache.set(url, p);
  }
  return p;
}

export function HeicImg({ src, onError, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [fixed, setFixed] = useState<{ src: string; out: string } | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  const shown = fixed && fixed.src === src ? fixed.out : src;
  const tryFix = () => { heicFallback(src).then((out) => { if (out) setFixed({ src, out }); }); };
  // Villan getur komið áður en React tengir onError (myndin úr server-HTML), svo athugað er líka við tengingu.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0 && el.currentSrc === src) tryFix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...rest}
      ref={ref}
      src={shown}
      onError={(e) => {
        onError?.(e);
        if (shown === src) tryFix();
      }}
    />
  );
}
