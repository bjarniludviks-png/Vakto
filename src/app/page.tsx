import type { Metadata } from "next";
import AppleHome from "@/components/site/home-client";
import "@/components/site/home.css";

// Forsíða vakto.is (okt. 2026): Apple-leg síða með alvöru skjámyndum úr kerfinu og appinu.
// Komponentar og stílar síðunnar eru í src/components/site/.
export const metadata: Metadata = {
  title: "VAKTO: vaktaplan, stimpilklukka og laun",
  description: "Vaktaplan, stimpilklukka, launakeyrsla og ráðningarsamningar. Og launakostnaður sem hlutfall af veltu, í rauntíma.",
};

export default function Page() {
  return <AppleHome />;
}
