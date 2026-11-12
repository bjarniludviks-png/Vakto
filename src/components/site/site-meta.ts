// Titlar og lýsingar (metadata/OG) markaðssíðnanna á hverju máli, ásamt hjálparfalli sem býr til
// Metadata með canonical, hreflang og OG-locale. Sameiginleg skrá (engin "use client").
import type { Metadata } from "next";
import { OG_LOCALE, SITE_LANGS, alternatesFor, type PageKey, type SiteLang } from "./i18n";
import * as da from "./text/da";
import * as sv from "./text/sv";
import * as nb from "./text/nb";

export type PageMeta = { title: string; desc: string };
export type MetaText = Record<PageKey, PageMeta>;

const is: MetaText = {
  home: { title: "VAKTO: vaktakerfi, vaktaplan, stimpilklukka og laun", desc: "Vaktakerfi fyrir íslenska vinnustaði: vaktaplan, stimpilklukka, launakeyrsla eftir kjarasamningi og rafrænir ráðningarsamningar. Laun sem hlutfall af veltu í rauntíma. 14 daga frí prufa." },
  price: { title: "VAKTO: Verð", desc: "Vaktaplanið er frítt fyrir allt að 5 starfsmenn. Grunnur frá 9.990 kr á mánuði með launum, appi og stimpilklukku. Öll verð opin, engin binding." },
  contractors: { title: "VAKTO Verk: tímaskráning, verkskýrslur og samþykkt fyrir verktaka", desc: "Tímataka með staðsetningu á verkstað, myndir, efni og akstur — og viðskiptavinurinn samþykkir verkskýrsluna með einum smelli. Fyrir verktaka og einyrkja. 2.990 kr. á mánuði." },
  about: { title: "VAKTO: Um okkur", desc: "VAKTO er búið til af rekstraraðila sem fann aldrei einfalt kerfi fyrir vaktir, laun og starfsfólk." },
  integrations: { title: "VAKTO: Tengingar við Payday, DK, Business Central, Shopify og fleiri", desc: "Kerfin sem VAKTO tengist í dag, hvaða gögn fara á milli og hvernig þú tengir þau, skref fyrir skref. VAKTO reiknar launin sjálft, svo það sem fer í launakerfið er þegar rétt." },
};

const en: MetaText = {
  home: { title: "VAKTO: shift scheduling, time clock and payroll", desc: "Workforce software for Icelandic workplaces: scheduling, time clock, payroll by union agreement and e-signed employment contracts. Labor as a share of revenue in real time. 14-day free trial." },
  price: { title: "VAKTO: Pricing", desc: "The schedule is free for up to 5 employees. Grunnur from ISK 9,990 a month with payroll, the app and the time clock. Open pricing, no commitment." },
  contractors: { title: "VAKTO Verk: time tracking, job reports and approval for contractors", desc: "Time tracking with on-site location, photos, materials and mileage — and the customer approves the job report with one tap. For contractors and sole traders." },
  about: { title: "VAKTO: About", desc: "VAKTO was built by an operator who never found a simple system for shifts, payroll and staff." },
  integrations: { title: "VAKTO: Integrations with Payday, DK, Business Central, Shopify and more", desc: "The systems VAKTO connects to today, what data moves between them and how to connect, step by step. VAKTO calculates the pay itself, so what lands in payroll is already right." },
};

export const META: Record<SiteLang, MetaText> = { is, en, da: da.meta, sv: sv.meta, nb: nb.meta };

/** Metadata síðu á máli: titill, lýsing, canonical, hreflang fyrir öll mál og OG með réttu locale. */
export function pageMetadata(page: PageKey, lang: SiteLang, extra?: { images?: string[] }): Metadata {
  const m = META[lang][page];
  const alt = alternatesFor(page, lang);
  return {
    title: m.title,
    description: m.desc,
    alternates: alt,
    openGraph: {
      type: "website", siteName: "VAKTO", url: alt.canonical, title: m.title, description: m.desc,
      locale: OG_LOCALE[lang], alternateLocale: SITE_LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      ...(extra?.images ? { images: extra.images } : {}),
    },
    twitter: { card: "summary_large_image", title: m.title, description: m.desc },
  };
}
