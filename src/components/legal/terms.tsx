// Efni síðunnar /skilmalar — birt í AhLegal (src/components/site/ah-legal.tsx) — (/skilmalar).
export const TERMS_META = { title: "Þjónustuskilmálar", updated: "21. október 2026" };

export function TermsBody() {
  return (
    <>
      <p>Þessir skilmálar gilda um notkun fyrirtækja („viðskiptavinur“, „þú“) á VAKTO, vakta- og launakerfi sem BGL Ventures ehf., kt. 490806-0400 („VAKTO“, „við“) rekur á vakto.is og í tengdum öppum. Með því að stofna aðgang samþykkir þú skilmálana fyrir hönd fyrirtækisins.</p>

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
        <li>VAKTO býðst í fjórum áskriftarleiðum. Verð á mánuði, án virðisaukaskatts:
          <ul>
            <li><b>Frítt</b> — 0 kr. Vaktaplan á vefnum (deiling sem PDF/hlekkur og tölvupóstur um vaktir) fyrir allt að 5 starfsmenn og 1 stað. Starfsmannaappið, stimpilklukka, spjall, beiðnir, launakeyrslur, ráðningarsamningar og VAKTO AI fylgja ekki.</li>
            <li><b>Grunnur</b> — 9.990 kr. með 8 virkum starfsmönnum innifalda, og 1.190 kr. fyrir hvern virkan starfsmann umfram. 1 staður, 25 AI-spurningar á mánuði.</li>
            <li><b>Vöxtur</b> — 24.990 kr. með 25 virkum starfsmönnum innifalda, og 990 kr. fyrir hvern virkan starfsmann umfram. Fleiri staðir, AI-vaktaplan, vaktarar og skýrslur á tímaáætlun, vinnuyfirlit og starfslok; 100 AI-spurningar á mánuði.</li>
            <li><b>Rekstur</b> — 54.990 kr. með 60 virkum starfsmönnum innifalda, og 790 kr. fyrir hvern virkan starfsmann umfram. Allt í Vexti auk aukinnar þjónustu; 300 AI-spurningar á mánuði.</li>
          </ul>
        </li>
        <li>Virkur starfsmaður er sá sem átti skráða vakt eða stimplaði sig í mánuðinum; ekki er greitt fyrir skráða starfsmenn sem vinna ekki. Grunnverðið er greitt fyrirfram en virkir starfsmenn umfram innifalda eru gerðir upp eftir á fyrir mánuðinn sem lauk.</li>
        <li><b>AI-pakkar:</b> klárist AI-spurningarnar sem fylgja leiðinni getur stjórnandi kveikt á AI-pökkum: 50 spurningar á <b>1.490 kr.</b>, aðeins innheimt fyrir pakka sem eru notaðir og aldrei umfram það hámark á mánuði sem stjórnandinn velur. Til að verja þjónustuna gegn misnotkun má VAKTO gera hlé á VAKTO AI út mánuðinn ef kostnaður við notkunina verður óhóflegur miðað við áskriftina.</li>
        <li>Undirritun samninga með rafrænum skilríkjum er valkvæð og kostar <b>490 kr. á hverja undirskrift</b>; undirritun með kóða í tölvupósti er alltaf innifalin. AI-pakkar og undirskriftir eru gerð upp eftir á.</li>
        <li>Sé greitt árlega fyrirfram er veittur <b>15% afsláttur</b> af grunnverði og verði á hvern virkan starfsmann (námundað að 10 kr.). Afslátturinn gildir ekki um AI-pakka og undirskriftir.</li>
        <li>Skipta má um leið hvenær sem er í Stillingum → Áskrift. Breytingin tekur gildi strax fyrir eiginleika og nýja verðið á næsta reikningi; ekki er endurgreitt né innheimt hlutfallslega fyrir yfirstandandi tímabil. Ef skipt er upp á meðan árgjald er í gildi bætist mismunur grunnverðsins við mánaðarreikningana út árið.</li>
        <li><b>Eldra verð:</b> viðskiptavinir sem greiddu samkvæmt eldri verðskrá áður en leiðirnar tóku gildi halda henni í 12 mánuði — á því tímabili er innheimt það sem lægra er, eldra verðið eða nýja verðið, fyrir grunnverð og virka starfsmenn.</li>
        <li>Nýir viðskiptavinir á Grunni eða Vexti fá <b>14 daga fría prufu</b> með öllum eiginleikum Vaxtar. Greiðslukort er skráð við nýskráningu á öruggri greiðslusíðu Straums (Kvika banka); VAKTO geymir aldrei kortanúmer. Ekkert er dregið af kortinu á meðan prufan stendur. Að prufu lokinni hefst áskriftin sjálfkrafa og mánaðargjaldið er tekið af kortinu á gjalddaga, nema áskriftinni hafi verið sagt upp áður. Fría leiðin krefst ekki greiðslukorts.</li>
        <li>Mánaðargjaldið er tekið af skráðu korti fyrirfram fyrir hvert tímabil og kvittun send í tölvupósti. Takist greiðsla ekki er reynt aftur næstu daga og viðskiptavinur látinn vita; berist greiðsla ekki innan 14 daga má VAKTO loka aðgangi þar til greitt er. Gögn eru varðveitt á meðan.</li>
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
      <p>VAKTO reiknar laun út frá þeim launaprófílum, kjarasamningum, álagsreglum og stimplunum sem viðskiptavinur skráir. Útreikningarnir eru hjálpartæki: <b>viðskiptavinur ber ábyrgð á að yfirfara niðurstöður, að réttir kjarasamningar og taxtar séu skráðir og að laun séu rétt greidd.</b> VAKTO býr til launaseðla og launayfirlit út frá þessum gögnum. Skil á staðgreiðslu, tryggingagjaldi og iðgjöldum til lífeyrissjóða og stéttarfélaga fara ekki fram í VAKTO; viðskiptavinur annast þau sjálfur eða í launakerfi sínu (t.d. Payday eða DK) og ber ábyrgð á að launaseðlar sem hann afhendir starfsfólki séu réttir og uppfylli lög. Ráðningarsamningar sem búnir eru til í VAKTO byggja á sniðmáti og upplýsingum viðskiptavinar; viðskiptavinur ber ábyrgð á efni þeirra.</p>

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
      <p>BGL Ventures ehf., kt. 490806-0400, Ísland · <a href="mailto:hallo@vakto.is">hallo@vakto.is</a></p>
    </>
  );
}
