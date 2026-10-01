"use client";

import { useSiteLang } from "./lang";

export default function LegalEnNote() {
  if (useSiteLang() !== "en") return null;
  return <p className="ah-legal-en" lang="en">This page is available in Icelandic only. Questions in English are welcome at hallo@vakto.is.</p>;
}
