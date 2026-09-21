import type { Metadata } from "next";
import LegalShell from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "VAKTO — Skilmálar", description: "Þjónustuskilmálar VAKTO ehf." };

export default function TermsPage() {
  return (
    <LegalShell title="Þjónustuskilmálar" updated="21. september 2026">
      <p>Þessir skilmálar gilda um notkun fyrirtækja („viðskiptavinur“, „þú“) á VAKTO, vakta- og launakerfi sem VAKTO ehf., kt. 490806-0400 („VAKTO“, „við“) rekur á vakto.is og í tengdum öppum. Með því að stofna aðgang samþykkir þú skilmálana fyrir hönd fyrirtækisins.</p>

      <h2>1. Þjónustan</h2>
      <p>VAKTO veitir aðgang að vefkerfi með vaktaplani, stimpilklukku, tímaskráningu, launaútreikningi, útflutningi í launakerfi, skýrslum, spjalli, fréttaveitu, starfsmannaskírteinum og ráðningarsamningum. Kerfið er þjónusta í áskrift (SaaS) og er þróað áfram; eiginleikar geta bæst við, breyst eða verið teknir út með sanngjörnum fyrirvara ef um verulega skerðingu er að ræða.</p>

      <h2>2. Aðgangur og notendur</h2>
      <ul>
        <li>Sá sem stofnar aðgang ber ábyrgð á að hafa heimild til þess fyrir hönd fyrirtækisins og verður stjórnandi þess.</li>
        <li>Viðskiptavinur ber ábyrgð á aðgangsorðum sinna notenda, á að úthluta hlutverkum rétt (stjórnandi, vaktstjóri, starfsmaður) og á allri notkun undir aðgangi sínum.</li>
        <li>Viðskiptavinur ábyrgist að hann megi skrá upplýsingar um starfsfólk sitt í kerfið og að starfsfólk hafi verið upplýst um vinnsluna, sbr. <a href="/personuvernd">persónuverndarstefnu</a>.</li>
      </ul>

      <h2>3. Verð og greiðslur</h2>
      <ul>
        <li>Áskrift kostar <b>5.990 kr. á mánuði</b> fyrir fyrirtækið með 5 notendur innifalda og <b>590 kr. á mánuði fyrir hvern notanda umfram 5</b>. Sé greitt árlega fyrirfram er veittur um 15% afsláttur (5.090 kr. + 500 kr. á notanda umfram). Öll verð eru án virðisaukaskatts.</li>
        <li>Notandi er hver starfsmaður eða stjórnandi sem er virkur í kerfinu á reikningstímabilinu. Fjöldi notenda er talinn í lok hvers tímabils.</li>
        <li>Nýir viðskiptavinir fá <b>14 daga fría prufu</b> með öllu innifalið. Ekki þarf greiðslukort til að byrja. Að prufu lokinni þarf að staðfesta áskrift; annars lokast aðgangurinn en gögn eru varðveitt í 90 daga.</li>
        <li>Reikningar eru gefnir út mánaðarlega (eða árlega) fyrirfram með 14 daga greiðslufresti. Sé reikningur ekki greiddur eftir áminningu má VAKTO takmarka aðgang þar til greitt er.</li>
        <li>VAKTO má breyta verðum með minnst 60 daga fyrirvara; breytingar taka gildi við næsta reikningstímabil eftir fyrirvarann.</li>
      </ul>

      <h2>4. Binding og uppsögn</h2>
      <p>Áskrift er án bindingar. Þú getur sagt henni upp hvenær sem er í Stillingum eða með tölvupósti; uppsögn tekur gildi í lok yfirstandandi reikningstímabils og fyrirframgreidd árleg áskrift er ekki endurgreidd fyrir þann tíma sem eftir er nema um það sé samið. VAKTO má segja upp samningi með 60 daga fyrirvara, eða fyrirvaralaust ef skilmálar eru brotnir alvarlega.</p>

      <h2>5. Gögn viðskiptavinar</h2>
      <ul>
        <li>Viðskiptavinur á gögnin sem hann skráir í VAKTO. VAKTO fær aðeins þá heimild sem þarf til að veita þjónustuna.</li>
        <li>Viðskiptavinur getur flutt gögn sín út hvenær sem er (Excel, PDF, launaskrár). Við lok áskriftar er gögnum eytt innan 90 daga nema lög krefjist lengri varðveislu.</li>
        <li>VAKTO tekur regluleg öryggisafrit. Viðskiptavinur ber sjálfur ábyrgð á að flytja út og geyma gögn sem hann þarf að halda samkvæmt lögum (t.d. launagögn).</li>
      </ul>

      <h2>6. Vinnslusamningur (DPA)</h2>
      <p>Að því marki sem VAKTO vinnur persónuupplýsingar um starfsfólk viðskiptavinar er VAKTO vinnsluaðili og viðskiptavinur ábyrgðaraðili í skilningi persónuverndarlaga. Eftirfarandi gildir sem vinnslusamningur samkvæmt 28. gr. GDPR:</p>
      <ul>
        <li><b>Efni og tilgangur:</b> vinnsla sem þarf til að veita þjónustuna sem lýst er í 1. gr.; tegundir gagna og skráðra einstaklinga eru taldar upp í persónuverndarstefnu.</li>
        <li><b>Fyrirmæli:</b> VAKTO vinnur gögnin eingöngu samkvæmt skjalfestum fyrirmælum viðskiptavinar (þ.m.t. notkun kerfisins) og samkvæmt lögum.</li>
        <li><b>Trúnaður:</b> starfsfólk VAKTO sem hefur aðgang að gögnum er bundið trúnaði.</li>
        <li><b>Öryggi:</b> VAKTO viðhefur viðeigandi tæknilegar og skipulagslegar ráðstafanir, sbr. 8. gr. persónuverndarstefnu.</li>
        <li><b>Undirvinnsluaðilar:</b> viðskiptavinur samþykkir þá undirvinnsluaðila sem taldir eru upp í persónuverndarstefnu; breytingar eru tilkynntar með 30 daga fyrirvara og viðskiptavinur getur andmælt með því að segja upp áskrift.</li>
        <li><b>Aðstoð:</b> VAKTO aðstoðar viðskiptavin við að svara beiðnum skráðra einstaklinga og við mat á áhrifum á persónuvernd eftir því sem sanngjarnt er.</li>
        <li><b>Öryggisbrestir:</b> tilkynntir viðskiptavini án ótilhlýðilegrar tafar.</li>
        <li><b>Eyðing/skil:</b> við lok þjónustu eru gögn skilað (útflutningur) og eytt, sbr. 5. gr.</li>
        <li><b>Úttektir:</b> viðskiptavinur getur óskað eftir upplýsingum sem sýna að VAKTO uppfylli skyldur sínar, með sanngjörnum fyrirvara og að hámarki einu sinni á ári.</li>
      </ul>

      <h2>7. Launaútreikningar og ábyrgð viðskiptavinar</h2>
      <p>VAKTO reiknar laun út frá þeim launaprófílum, kjarasamningum, álagsreglum og stimplunum sem viðskiptavinur skráir. Útreikningarnir eru hjálpartæki: <b>viðskiptavinur ber ábyrgð á að yfirfara niðurstöður, að réttir kjarasamningar og taxtar séu skráðir og að laun séu rétt greidd.</b> Formlegir launaseðlar og skil til skattyfirvalda og lífeyrissjóða fara fram í launakerfi viðskiptavinar (t.d. Payday eða DK). Ráðningarsamningar sem búnir eru til í VAKTO byggja á sniðmáti og upplýsingum viðskiptavinar; viðskiptavinur ber ábyrgð á efni þeirra.</p>

      <h2>8. Leyfileg notkun</h2>
      <p>Óheimilt er að nota VAKTO í ólögmætum tilgangi, að reyna að komast í gögn annarra fyrirtækja, að trufla rekstur kerfisins, að endurselja þjónustuna án samnings eða að hlaða upp efni sem brýtur gegn rétti annarra. Viðskiptavinur ábyrgist að stimplanir og skráningar séu réttar og ekki notaðar til að fara á svig við vinnuverndar- eða kjarasamningsreglur.</p>

      <h2>9. Aðgengi og þjónusta</h2>
      <p>VAKTO stefnir að því að kerfið sé aðgengilegt allan sólarhringinn. Tilkynnt viðhald fer fram utan háannatíma þegar það er hægt. Stuðningur er veittur á <a href="mailto:hallo@vakto.is">hallo@vakto.is</a> og í kerfinu á virkum dögum. Kerfi þriðju aðila (Payday, DK, Apple Wallet, Google Wallet, tölvupóstþjónusta) eru utan stjórnar VAKTO.</p>

      <h2>10. Hugverkaréttur</h2>
      <p>VAKTO á allan rétt á hugbúnaðinum, hönnun hans og vörumerkinu. Viðskiptavinur fær tímabundinn, óframseljanlegan afnotarétt á meðan áskrift stendur. Viðskiptavinur á gögnin sín, sbr. 5. gr.</p>

      <h2>11. Ábyrgðartakmörkun</h2>
      <p>Þjónustan er veitt eins og hún er. VAKTO ber ekki ábyrgð á óbeinu tjóni, rekstrartapi eða tjóni sem rekja má til rangra skráninga viðskiptavinar, rangra launaútreikninga sem ekki voru yfirfarnir, bilana hjá þriðju aðilum eða atvika sem VAKTO fær ekki ráðið við. Heildarábyrgð VAKTO vegna samningsins takmarkast við þá fjárhæð sem viðskiptavinur greiddi fyrir þjónustuna síðustu 12 mánuði á undan atvikinu. Takmarkanirnar gilda ekki um tjón af ásetningi eða stórfelldu gáleysi.</p>

      <h2>12. Breytingar á skilmálum</h2>
      <p>VAKTO má breyta skilmálunum. Efnislegar breytingar eru tilkynntar með tölvupósti eða í kerfinu með minnst 30 daga fyrirvara. Haldi viðskiptavinur áfram að nota þjónustuna eftir að breytingar taka gildi telst hann hafa samþykkt þær.</p>

      <h2>13. Lög og varnarþing</h2>
      <p>Um skilmálana gilda íslensk lög. Rísi ágreiningur sem ekki tekst að leysa með samkomulagi skal reka mál fyrir Héraðsdómi Reykjavíkur.</p>

      <h2>14. Samband</h2>
      <p>VAKTO ehf., kt. 490806-0400, Ísland · <a href="mailto:hallo@vakto.is">hallo@vakto.is</a></p>
    </LegalShell>
  );
}
