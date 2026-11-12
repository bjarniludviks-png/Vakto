// Tungumál og slóðir opna vefsins (nóv. 2026). Íslenska er á rótinni (/, /verd …) eins og áður og
// þar ræður valið í localStorage hvort efnið birtist á íslensku eða ensku. Hin málin eiga sínar
// eigin slóðir (/en, /da, /sv, /no) svo leitarvélar finni þau og hreflang vísi rétt.
// Þessi skrá er sameiginleg (engin "use client") svo bæði síður (metadata) og íhlutir geta notað hana.

export type SiteLang = "is" | "en" | "da" | "sv" | "nb";
export const SITE_LANGS: SiteLang[] = ["is", "en", "da", "sv", "nb"];
/** Mál með eigin slóðaforskeyti (íslenska er á rótinni). */
export type PrefixedLang = Exclude<SiteLang, "is">;
export const PREFIX: Record<PrefixedLang, string> = { en: "en", da: "da", sv: "sv", nb: "no" };
export const langFromPrefix = (p: string): PrefixedLang | null =>
  (Object.keys(PREFIX) as PrefixedLang[]).find((l) => PREFIX[l] === p) ?? null;

export type PageKey = "home" | "price" | "contractors" | "about" | "integrations";
export const PAGE_KEYS: PageKey[] = ["home", "price", "contractors", "about", "integrations"];

/** Slóð hverrar síðu á hverju máli (staðbundin heiti, ekki íslensk heiti undir forskeyti). */
export const PATHS: Record<SiteLang, Record<PageKey, string>> = {
  is: { home: "/", price: "/verd", contractors: "/verktakar", about: "/um-okkur", integrations: "/tengingar" },
  en: { home: "/en", price: "/en/pricing", contractors: "/en/contractors", about: "/en/about", integrations: "/en/integrations" },
  da: { home: "/da", price: "/da/priser", contractors: "/da/haandvaerkere", about: "/da/om-os", integrations: "/da/integrationer" },
  sv: { home: "/sv", price: "/sv/priser", contractors: "/sv/hantverkare", about: "/sv/om-oss", integrations: "/sv/integrationer" },
  nb: { home: "/no", price: "/no/priser", contractors: "/no/handverkere", about: "/no/om-oss", integrations: "/no/integrasjoner" },
};

/** Síða út frá slóð (t.d. "/da/priser" → { lang: "da", page: "price" }). null ef slóðin er ekki markaðssíða. */
export function pageFromPath(pathname: string): { lang: SiteLang; page: PageKey } | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  for (const lang of SITE_LANGS) for (const page of PAGE_KEYS) if (PATHS[lang][page] === p) return { lang, page };
  return null;
}

/** Undirslóð (á eftir forskeyti) → síða, fyrir [locale]/[slug]. */
export function pageFromSlug(lang: PrefixedLang, slug: string): PageKey | null {
  const want = `/${PREFIX[lang]}/${slug}`;
  return PAGE_KEYS.find((k) => k !== "home" && PATHS[lang][k] === want) ?? null;
}

/** hreflang-gildi (BCP 47). Norska = bokmål. */
export const HREFLANG: Record<SiteLang, string> = { is: "is", en: "en", da: "da", sv: "sv", nb: "nb" };
export const OG_LOCALE: Record<SiteLang, string> = { is: "is_IS", en: "en_GB", da: "da_DK", sv: "sv_SE", nb: "nb_NO" };
export const LANG_NAME: Record<SiteLang, string> = { is: "Íslenska", en: "English", da: "Dansk", sv: "Svenska", nb: "Norsk" };
export const LANG_SHORT: Record<SiteLang, string> = { is: "IS", en: "EN", da: "DA", sv: "SV", nb: "NO" };

/** alternates fyrir metadata: canonical + hreflang fyrir öll mál + x-default (íslenska). */
export function alternatesFor(page: PageKey, lang: SiteLang) {
  const languages: Record<string, string> = {};
  for (const l of SITE_LANGS) languages[HREFLANG[l]] = PATHS[l][page];
  languages["x-default"] = PATHS.is[page];
  return { canonical: PATHS[lang][page], languages };
}

// ---------- Tölur og gjaldmiðill ----------
// Verð eru enn aðeins í íslenskum krónum. Gjaldmiðill er skilgreindur per mál svo hægt sé að setja inn
// DKK/SEK/NOK síðar á einum stað — en við búum ALDREI til staðbundin verð sem eru ekki til.
export type Currency = { code: "ISK"; perMonth: string };
export const CURRENCY: Record<SiteLang, Currency> = {
  is: { code: "ISK", perMonth: "kr/mán" },
  en: { code: "ISK", perMonth: "ISK/mo" },
  da: { code: "ISK", perMonth: "ISK/md." },
  sv: { code: "ISK", perMonth: "ISK/mån" },
  nb: { code: "ISK", perMonth: "ISK/mnd." },
};

/** Heiltala með þúsundaskilum máls: 9.990 (is/da) · 9,990 (en) · 9 990 (sv/nb, grannt bil). Ákveðið, ekki Intl. */
export function fmtNum(lang: SiteLang, n: number): string {
  const s = Math.round(Math.abs(n)).toString();
  const sep = lang === "en" ? "," : lang === "sv" || lang === "nb" ? " " : ".";
  return (n < 0 ? "−" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Upphæð í gjaldmiðli máls. Íslenska: „9.990 kr“; enska: „ISK 9,990“; norðurlandamál: „9.990 ISK“
 *  (ekki „kr“, sem Danir, Svíar og Norðmenn myndu lesa sem sínar krónur). */
export function fmtMoney(lang: SiteLang, n: number): string {
  if (lang === "is") return `${fmtNum(lang, n)} kr`;
  if (lang === "en") return `ISK ${fmtNum(lang, n)}`;
  return `${fmtNum(lang, n)} ${CURRENCY[lang].code}`;
}

/** Hlekkur inn í nýskráningu/innskráningu: þær síður eru á IS/EN/PL/VI, svo önnur mál fá ensku. */
export function appHref(lang: SiteLang, path: string): string {
  if (lang === "is") return path;
  return `${path}${path.includes("?") ? "&" : "?"}lang=en`;
}
