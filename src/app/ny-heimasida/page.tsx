import type { Metadata } from "next";
import AppleHome from "./home-client";
import "./home.css";

// Tilraun (okt. 2026): Apple-leg forsíða við hliðina á núverandi forsíðu (/).
// Ekki tengd í valmynd og ekki í leitarvélum fyrr en eigandinn hefur samþykkt hana.
export const metadata: Metadata = {
  title: "VAKTO — Vaktin, launin og yfirsýnin",
  description: "Vaktaplan, stimpilklukka, launakeyrsla og ráðningarsamningar — og launakostnaður sem hlutfall af veltu, í rauntíma.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AppleHome />;
}
