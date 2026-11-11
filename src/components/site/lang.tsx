"use client";

// Tungumál vefsins. Sami localStorage-lykill og appið notar ("vakto-lang"), svo valið fylgir
// notandanum inn í kerfið. ?lang=en|pl|vi|is í slóð stillir það líka (t.d. fyrir hlekki í pósti).
// Á íslensku slóðunum (/, /verd …) er markaðsefnið IS/EN eftir þessu vali (pl/vi sjá ensku). Slóðir með
// forskeyti (/en, /da, /sv, /no) festa málið með SiteLocale (sjá i18n.ts). Innskráning, nýskráning og
// spjallið nota fulla valið (useFullLang).
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { SiteLang } from "./i18n";

export type { SiteLang } from "./i18n";
export type FullLang = "is" | "en" | "pl" | "vi";
const KEY = "vakto-lang";
const EVT = "vakto-site-lang";
const FULL: FullLang[] = ["is", "en", "pl", "vi"];
const isFull = (v: unknown): v is FullLang => FULL.includes(v as FullLang);

function readFull(): FullLang {
  try { const v = localStorage.getItem(KEY); return isFull(v) ? v : "is"; } catch { return "is"; }
}
function read(): "is" | "en" {
  return readFull() === "is" ? "is" : "en";
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}

/** Mál sem slóðin festir (/en, /da, /sv, /no). null = íslensku slóðirnar, þar sem valið ræður. */
const Forced = createContext<SiteLang | null>(null);
export function SiteLocale({ lang, children }: { lang: SiteLang; children: ReactNode }) {
  return <Forced.Provider value={lang}>{children}</Forced.Provider>;
}
/** True þegar síðan er á slóð með forskeyti (málið fest). */
export function useForcedLang(): SiteLang | null {
  return useContext(Forced);
}

/** Tungumál markaðsefnisins: fasta málið á slóðum með forskeyti, annars IS/EN eftir vali. */
export function useSiteLang(): SiteLang {
  const forced = useContext(Forced);
  const stored = useSyncExternalStore(subscribe, read, () => "is" as const);
  return forced ?? stored;
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

/** Les ?lang= einu sinni og heldur <html lang> réttu (rót-layoutið er alltaf lang="is"). */
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
