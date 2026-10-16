"use client";

// Tungumál vefsins. Sami localStorage-lykill og appið notar ("vakto-lang"), svo valið fylgir
// notandanum inn í kerfið. ?lang=en|pl|vi|is í slóð stillir það líka (t.d. fyrir hlekki í pósti).
// Markaðssíðan sjálf er aðeins til á IS/EN (useSiteLang: pl/vi sjá ensku), en innskráning,
// nýskráning og spjallið nota fulla valið (useFullLang).
import { useEffect, useSyncExternalStore } from "react";

export type SiteLang = "is" | "en";
export type FullLang = "is" | "en" | "pl" | "vi";
const KEY = "vakto-lang";
const EVT = "vakto-site-lang";
const FULL: FullLang[] = ["is", "en", "pl", "vi"];
const isFull = (v: unknown): v is FullLang => FULL.includes(v as FullLang);

function readFull(): FullLang {
  try { const v = localStorage.getItem(KEY); return isFull(v) ? v : "is"; } catch { return "is"; }
}
function read(): SiteLang {
  return readFull() === "is" ? "is" : "en";
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}

/** Tungumál markaðsefnisins (IS/EN). */
export function useSiteLang(): SiteLang {
  return useSyncExternalStore(subscribe, read, () => "is");
}

/** Fulla valið (IS/EN/PL/VI) — fyrir innskráningu, nýskráningu og spjallið. */
export function useFullLang(): FullLang {
  return useSyncExternalStore(subscribe, readFull, () => "is");
}

export function setSiteLang(l: FullLang) {
  try { localStorage.setItem(KEY, l); } catch {}
  window.dispatchEvent(new Event(EVT));
}

function useQueryLang() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (isFull(q)) setSiteLang(q);
  }, []);
}

/** Les ?lang= einu sinni og heldur <html lang> réttu (markaðssíður: IS/EN). */
export function useLangSync() {
  const lang = useSiteLang();
  useQueryLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return lang;
}

/** Eins og useLangSync en skilar fulla valinu (innskráning/nýskráning). */
export function useFullLangSync() {
  const lang = useFullLang();
  useQueryLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return lang;
}

const Globe = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
);

export function LangToggle() {
  const lang = useSiteLang();
  return (
    <button type="button" className="ah-lang" onClick={() => setSiteLang(lang === "is" ? "en" : "is")} aria-label={lang === "is" ? "Switch to English" : "Skipta yfir á íslensku"}>
      <Globe />
      {lang === "is" ? "EN" : "IS"}
    </button>
  );
}

const NAMES: Record<FullLang, string> = { is: "Íslenska", en: "English", pl: "Polski", vi: "Tiếng Việt" };

/** Tungumálaval með öllum fjórum málunum (innskráning/nýskráning). Native select ofan á hnappnum. */
export function LangPicker() {
  const lang = useFullLang();
  return (
    <span className="ah-lang" style={{ position: "relative" }}>
      <Globe />
      {lang.toUpperCase()}
      <select
        value={lang}
        onChange={(e) => setSiteLang(e.target.value as FullLang)}
        aria-label="Language / Tungumál / Język"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit" }}
      >
        {FULL.map((l) => <option key={l} value={l}>{NAMES[l]}</option>)}
      </select>
    </span>
  );
}
