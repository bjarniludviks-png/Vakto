import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import AhLegal from "@/components/site/ah-legal";
import "@/components/site/home.css";
import "@/components/site/legal.css";

// Opin síða (engin innskráning): hvernig notandi eyðir aðgangi sínum (Apple 5.1.1(v) / Google Play).
export const viewport = siteViewport;
export const metadata: Metadata = {
  title: "VAKTO: Eyða aðgangi",
  description: "Hvernig þú eyðir aðgangi þínum að VAKTO og hvaða gögn eru geymd skv. lögum.",
  alternates: { canonical: "/eyda-adgangi" },
};

export default function DeleteAccountPage() {
  return (
    <AhLegal title="Eyða aðgangi" updated="21. október 2026">
      <p>Þú getur hvenær sem er beðið um að aðgangi þínum að VAKTO verði eytt. Það er gert á annan hvorn veginn hér að neðan.</p>

      <h2>1. Í appinu</h2>
      <p>Opnaðu VAKTO-appið og farðu í <b>Ég → Stillingar → Eyða aðgangi</b>. Staðfestu með <b>Eyða aðganginum mínum</b>. Aðganginum er lokað strax og þú ert skráð(ur) út.</p>

      <h2>2. Með tölvupósti</h2>
      <p>Sendu póst á <a href="mailto:hjalp@vakto.is?subject=Ey%C3%B0a%20a%C3%B0gangi">hjalp@vakto.is</a> frá netfanginu sem aðgangurinn er skráður á og biddu um eyðingu. Við staðfestum móttöku og lokum aðganginum.</p>
      <p>Ef þú ert eigandi fyrirtækis í VAKTO skaltu hafa samband á <a href="mailto:hjalp@vakto.is">hjalp@vakto.is</a>, því þá þarf einnig að ganga frá fyrirtækinu og gögnum starfsfólks.</p>

      <h2>3. Hvað er eytt</h2>
      <p>Aðganginum er lokað strax og ekki er lengur hægt að skrá sig inn. Persónuupplýsingum þínum (t.d. innskráningu, prófíl, mynd, síma, spjalli og tilkynningastillingum) er eytt innan 30 daga frá beiðninni.</p>

      <h2>4. Hvað er geymt og hve lengi</h2>
      <p>Gögn sem vinnuveitandinn þarf lögum samkvæmt að geyma, svo sem launa- og tímaskráningar, launaseðlar og undirritaðir ráðningarsamningar, eru geymd eins lengi og lög krefjast (t.d. bókhaldslög). Vinnuveitandinn er ábyrgðaraðili þeirra gagna og VAKTO geymir þau fyrir hans hönd. Þeim er eytt þegar varðveisluskyldu lýkur.</p>

      <h2>5. Spurningar</h2>
      <p>Nánar um meðferð persónuupplýsinga í <a href="/personuvernd">persónuverndarstefnunni</a>. Spurningar sendast á <a href="mailto:hjalp@vakto.is">hjalp@vakto.is</a>.</p>
    </AhLegal>
  );
}
