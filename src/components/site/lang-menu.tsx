"use client";

// Tungumálaval vefsins með fánum (IS/EN/DA/SV/NO). Fer á sömu síðu á hinu málinu (staðbundnar slóðir í
// i18n.ts). Á síðum sem eru aðeins til á íslensku (lögfræði o.fl.) skiptir það IS⇄EN á staðnum, en
// norðurlandamálin fara á forsíðu síns máls. Fánarnir eru einföld SVG (engin emoji).
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { setSiteLang, useSiteLang } from "./lang";
import { LANG_NAME, LANG_SHORT, PATHS, SITE_LANGS, pageFromPath, type SiteLang } from "./i18n";

export function Flag({ lang, size = 18 }: { lang: SiteLang; size?: number }) {
  const h = Math.round((size * 14) / 20);
  const common = { viewBox: "0 0 20 14", width: size, height: h, className: "ah-flag", "aria-hidden": true as const };
  switch (lang) {
    case "is": return <svg {...common}><rect width="20" height="14" fill="#02529C" /><rect x="5.5" width="3.5" height="14" fill="#fff" /><rect y="5.25" width="20" height="3.5" fill="#fff" /><rect x="6.35" width="1.8" height="14" fill="#DC1E35" /><rect y="6.1" width="20" height="1.8" fill="#DC1E35" /></svg>;
    case "da": return <svg {...common}><rect width="20" height="14" fill="#C8102E" /><rect x="6" width="2.2" height="14" fill="#fff" /><rect y="5.9" width="20" height="2.2" fill="#fff" /></svg>;
    case "sv": return <svg {...common}><rect width="20" height="14" fill="#006AA7" /><rect x="5.8" width="2.4" height="14" fill="#FECC02" /><rect y="5.8" width="20" height="2.4" fill="#FECC02" /></svg>;
    case "nb": return <svg {...common}><rect width="20" height="14" fill="#BA0C2F" /><rect x="5.5" width="3.5" height="14" fill="#fff" /><rect y="5.25" width="20" height="3.5" fill="#fff" /><rect x="6.35" width="1.8" height="14" fill="#00205B" /><rect y="6.1" width="20" height="1.8" fill="#00205B" /></svg>;
    default: return (
      <svg {...common}>
        <rect width="20" height="14" fill="#012169" />
        <path d="M0 0L20 14M20 0L0 14" stroke="#fff" strokeWidth="2.8" />
        <path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" strokeWidth="0.9" />
        <path d="M10 0v14M0 7h20" stroke="#fff" strokeWidth="4.2" />
        <path d="M10 0v14M0 7h20" stroke="#C8102E" strokeWidth="2.4" />
      </svg>
    );
  }
}

const LABEL: Record<SiteLang, string> = { is: "Tungumál", en: "Language", da: "Sprog", sv: "Språk", nb: "Språk" };

/** Hvert á að fara þegar `to` er valið á núverandi slóð. */
function target(pathname: string, to: SiteLang): string | null {
  const here = pageFromPath(pathname);
  if (here) return PATHS[to][here.page];
  // Síða sem er aðeins til á íslensku: IS/EN skiptist á staðnum, hin málin fara á sína forsíðu.
  return to === "is" || to === "en" ? null : PATHS[to].home;
}

export function LangMenu({ variant = "nav" }: { variant?: "nav" | "sheet" }) {
  const lang = useSiteLang();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", off);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", off); window.removeEventListener("keydown", esc); };
  }, [open]);

  const go = (to: SiteLang) => {
    setOpen(false);
    // Innskráning/nýskráning eru á IS/EN: norðurlandamálin fá ensku þar.
    if (to === "is" || to === "en") setSiteLang(to);
    const href = target(pathname, to);
    if (href && href !== pathname) router.push(href);
  };

  if (variant === "sheet") {
    return (
      <div className="ah-langs" role="group" aria-label={LABEL[lang]}>
        {SITE_LANGS.map((l) => (
          <button key={l} type="button" lang={l} aria-pressed={l === lang} onClick={() => go(l)}>
            <Flag lang={l} size={20} /><span>{LANG_NAME[l]}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="ah-lm" ref={box}>
      <button type="button" className="ah-lang" aria-haspopup="true" aria-expanded={open} aria-controls={id} aria-label={`${LABEL[lang]}: ${LANG_NAME[lang]}`} onClick={() => setOpen((o) => !o)}>
        <Flag lang={lang} size={18} />{LANG_SHORT[lang]}
        <svg className="ah-lm-car" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul id={id} className="ah-lm-list">
          {SITE_LANGS.map((l) => (
            <li key={l}>
              <button type="button" lang={l} aria-current={l === lang ? "true" : undefined} onClick={() => go(l)}>
                <Flag lang={l} size={20} /><span>{LANG_NAME[l]}</span>
                {l === lang && <svg className="ah-lm-ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
