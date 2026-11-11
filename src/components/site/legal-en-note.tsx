"use client";

import { useSiteLang } from "./lang";
import type { SiteLang } from "./i18n";
import * as da from "./text/da";
import * as sv from "./text/sv";
import * as nb from "./text/nb";

// Lögfræðisíðurnar eru aðeins á íslensku. Önnur mál fá stutta athugasemd efst.
const NOTE: Record<Exclude<SiteLang, "is">, string> = {
  en: "This page is available in Icelandic only. Questions in English are welcome at hallo@vakto.is.",
  da: da.legalNote, sv: sv.legalNote, nb: nb.legalNote,
};

export default function LegalEnNote() {
  const lang = useSiteLang();
  if (lang === "is") return null;
  return <p className="ah-legal-en" lang={lang}>{NOTE[lang]}</p>;
}
