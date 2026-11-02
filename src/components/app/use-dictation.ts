"use client";

// Tal í texta með Web Speech API vafrans (Chrome, Edge, Safari). Firefox styður það ekki — þá er
// `supported` false og hnappurinn falinn. Ekkert hljóð fer um okkar þjóna; vafrinn sér um greininguna.
import { useEffect, useRef, useState } from "react";
import type { Lang } from "./lang";

type RecResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<RecResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecCtor = new () => Recognition;

/** Villukóðar Web Speech API sem notandinn þarf að vita af. */
export type DictationError = "denied" | "no-mic" | "lang" | "other";

const LOCALE: Record<Lang, string> = { is: "is-IS", en: "en-US", pl: "pl-PL", vi: "vi-VN" };

function ctor(): RecCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Talar inn í textareit. `start(base)` byrjar að hlusta og skrifar `base` + það sem sagt er
 * (bráðabirgðaniðurstöður streyma inn jafnóðum) með `onText`. Sendir ekkert sjálft.
 */
export function useDictation({ lang, onText, onError }: { lang: Lang; onText: (t: string) => void; onError: (e: DictationError) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  // Nýjustu köllin án þess að endurræsa greininguna þegar þau breytast.
  const cb = useRef({ onText, onError });
  useEffect(() => { cb.current = { onText, onError }; });

  // Athugað eftir mount svo þjóns- og vafrabirting passi saman.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- window er aðeins til í vafranum
  useEffect(() => { setSupported(!!ctor()); }, []);
  useEffect(() => () => { rec.current?.abort(); rec.current = null; }, []);

  function stop() {
    const r = rec.current; if (!r) return;
    rec.current = null; // seinni onresult-atburðir eru hunsaðir (t.d. eftir að spurningin var send)
    r.onresult = null;
    try { r.stop(); } catch { /* þegar stöðvað */ }
    setListening(false);
  }

  function start(base: string) {
    const C = ctor(); if (!C || rec.current) return;
    const r = new C();
    r.lang = LOCALE[lang] ?? "is-IS";
    r.interimResults = true;
    r.continuous = true;
    const prefix = base && !/\s$/.test(base) ? `${base} ` : base;
    r.onresult = (e) => {
      if (rec.current !== r) return;
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0]?.transcript ?? "";
      cb.current.onText(prefix + said.replace(/^\s+/, ""));
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      cb.current.onError(
        e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied"
          : e.error === "audio-capture" ? "no-mic"
          : e.error === "language-not-supported" ? "lang" : "other",
      );
    };
    r.onend = () => { if (rec.current === r) rec.current = null; setListening(false); };
    rec.current = r;
    try { r.start(); setListening(true); } catch { rec.current = null; cb.current.onError("other"); }
  }

  return { supported, listening, start, stop, toggle: (base: string) => (listening ? stop() : start(base)) };
}
