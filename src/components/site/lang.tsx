"use client";

// Tungumál vefsins (IS/EN). Sami localStorage-lykill og appið notar ("vakto-lang"), svo valið fylgir
// notandanum inn í kerfið. ?lang=en í slóð stillir það líka (t.d. fyrir hlekki í enskum pósti).
import { useEffect, useSyncExternalStore } from "react";

export type SiteLang = "is" | "en";
const KEY = "vakto-lang";
const EVT = "vakto-site-lang";

function read(): SiteLang {
  try { return localStorage.getItem(KEY) === "en" ? "en" : "is"; } catch { return "is"; }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}

export function useSiteLang(): SiteLang {
  return useSyncExternalStore(subscribe, read, () => "is");
}

export function setSiteLang(l: SiteLang) {
  try { localStorage.setItem(KEY, l); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/** Les ?lang=en|is einu sinni og heldur <html lang> réttu. */
export function useLangSync() {
  const lang = useSiteLang();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "is") setSiteLang(q);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return lang;
}

export function LangToggle() {
  const lang = useSiteLang();
  return (
    <button type="button" className="ah-lang" onClick={() => setSiteLang(lang === "is" ? "en" : "is")} aria-label={lang === "is" ? "Switch to English" : "Skipta yfir á íslensku"}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
      {lang === "is" ? "EN" : "IS"}
    </button>
  );
}
