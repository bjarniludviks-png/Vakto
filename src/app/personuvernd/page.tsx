import type { Metadata } from "next";
import LegalShell from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "VAKTO — Persónuvernd", description: "Hvernig VAKTO ehf. vinnur með persónuupplýsingar." };

export default function PrivacyPage() {
  return (
    <LegalShell title="Persónuverndarstefna" updated="21. september 2026">
      <p>VAKTO er vakta- og launakerfi fyrir vinnustaði. Þessi stefna lýsir því hvaða persónuupplýsingar VAKTO ehf. („VAKTO“, „við“) vinnur, í hvaða tilgangi, hversu lengi og hvaða réttindi þú hefur. Hún byggir á lögum nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga og almennu persónuverndarreglugerðinni (GDPR).</p>

      <h2>1. Tvö hlutverk: ábyrgðaraðili og vinnsluaðili</h2>
      <p><b>Ábyrgðaraðili.</b> Þegar þú stofnar aðgang, heimsækir vakto.is, notar spjallið á heimasíðunni eða hefur samband við okkur er VAKTO ehf. ábyrgðaraðili þeirra upplýsinga.</p>
      <p><b>Vinnsluaðili.</b> Þegar fyrirtæki (viðskiptavinur okkar) skráir starfsfólk sitt, vaktir, stimplanir og launaupplýsingar í VAKTO er fyrirtækið ábyrgðaraðili og VAKTO vinnsluaðili sem vinnur upplýsingarnar eingöngu samkvæmt fyrirmælum þess. Vinnslusamningur (DPA) er hluti af <a href="/skilmalar">skilmálum þjónustunnar</a>. Starfsfólk sem hefur spurningar um eigin upplýsingar í VAKTO ætti fyrst að leita til vinnuveitanda síns.</p>

      <h2>2. Hvaða upplýsingar við vinnum</h2>
      <h3>Um viðskiptavini og notendur (VAKTO er ábyrgðaraðili)</h3>
      <ul>
        <li>Aðgangsupplýsingar: nafn, netfang, lykilorð (geymt dulkóðað/hashað), hlutverk og fyrirtæki.</li>
        <li>Fyrirtækisupplýsingar: nafn, kennitala, heimilisfang, sími, netfang, áskriftarleið og greiðslustaða.</li>
        <li>Notkunar- og öryggisskrár: innskráningar, IP-tala, tegund vafra, tímastimplar og aðgerðaskrá (audit log) í kerfinu.</li>
        <li>Samskipti: skilaboð sem þú sendir okkur í tölvupósti eða í spjallinu á heimasíðunni, þ.m.t. nafn og netfang ef þú biður um að tala við manneskju.</li>
      </ul>
      <h3>Um starfsfólk viðskiptavina (VAKTO er vinnsluaðili)</h3>
      <ul>
        <li>Starfsmannaupplýsingar sem vinnuveitandi skráir: nafn, kennitala, netfang, sími, staða, deild, starfshlutfall, ráðningardagur, launaform, launataxti, kjarasamningur, stéttarfélag, lífeyrissjóður, bankaupplýsingar ef þær eru skráðar, prófílmynd.</li>
        <li>Vaktir, stimplanir (inn/út, tími, uppruni: sími eða kiosk), frávik, fríbeiðnir, vaktaskipti, tímabanki og orlofsstaða.</li>
        <li>Launaútreikningar og launakeyrslur, útflutningsskrár í launakerfi (Payday, DK, Excel).</li>
        <li>Skjöl: ráðningarsamningar (þ.m.t. rafrænt samþykki með nafni, tímastimpli og innskráningu), handbækur og önnur skjöl sem vinnuveitandi hleður upp.</li>
        <li>Spjall og fréttaveita innan fyrirtækisins: skilaboð, myndir, talskilaboð, viðbrögð, athugasemdir og lesstaða.</li>
        <li>Starfsmannaskírteini: nafn, staða, deild, starfsmannanúmer og QR-kóði. Sé skírteinið sett í Apple Wallet eða Google Wallet gilda skilmálar Apple/Google um geymslu þess í símanum.</li>
        <li>Push-tilkynningar: auðkenni tækis (push subscription) ef starfsmaður kveikir á tilkynningum.</li>
      </ul>
      <p>VAKTO safnar ekki staðsetningargögnum (GPS) og notar engar greiningar- eða auglýsingavafrakökur á vakto.is. Sjá <a href="/vafrakokur">vafrakökur</a>.</p>

      <h2>3. Tilgangur og lagagrundvöllur</h2>
      <ul>
        <li>Að veita þjónustuna (vaktaplan, stimpilklukka, laun, spjall, skjöl): efndir samnings (6. gr. 1. mgr. b GDPR) og fyrir starfsfólk: fyrirmæli ábyrgðaraðila í vinnslusamningi.</li>
        <li>Öryggi, aðgangsstýring, aðgerðaskrá og varnir gegn misnotkun: lögmætir hagsmunir (6. gr. 1. mgr. f).</li>
        <li>Reikningagerð og bókhald: lagaskylda (6. gr. 1. mgr. c), m.a. bókhaldslög.</li>
        <li>Spjallið á heimasíðunni: lögmætir hagsmunir af því að svara fyrirspurnum. Samtöl eru send til gervigreindarþjónustu (sjá kafla 5) og geymd í allt að 12 mánuði.</li>
        <li>Tölvupóstar um þjónustuna (t.d. plan birt, samningur bíður, prufa að renna út): efndir samnings. Við sendum ekki markaðspóst nema með samþykki.</li>
      </ul>

      <h2>4. Hvar gögnin eru geymd</h2>
      <p>Öll gögn eru geymd á Evrópska efnahagssvæðinu. Gagnagrunnur og skráageymsla eru hjá Supabase í gagnaveri á Írlandi (AWS eu-west-1). Vefþjónninn keyrir hjá Vercel í Dublin. Öll samskipti eru dulkóðuð (TLS) og gögn í hvíld eru dulkóðuð. Aðgangur að gögnum er afmarkaður við fyrirtæki (row level security) og hlutverk notanda.</p>

      <h2>5. Vinnsluaðilar (undirvinnsluaðilar)</h2>
      <table>
        <thead><tr><th>Aðili</th><th>Hlutverk</th><th>Staðsetning</th></tr></thead>
        <tbody>
          <tr><td>Supabase Inc.</td><td>Gagnagrunnur, auðkenning, skráageymsla, rauntímatengingar</td><td>ESB (Írland)</td></tr>
          <tr><td>Vercel Inc.</td><td>Hýsing vefsins og keyrsla kerfisins</td><td>ESB (Dublin); stýrilag í Bandaríkjunum undir stöðluðum samningsskilmálum (SCC)</td></tr>
          <tr><td>Resend Inc.</td><td>Sending tölvupósta úr kerfinu</td><td>Bandaríkin/ESB undir SCC</td></tr>
          <tr><td>Anthropic PBC</td><td>Gervigreind: svör spjallsins á heimasíðunni og tillögur að vaktaplani (aðeins þegar stjórnandi biður um það). Gögn eru ekki notuð til að þjálfa líkön.</td><td>Bandaríkin undir SCC</td></tr>
          <tr><td>Apple Inc. / Google LLC</td><td>Wallet-skírteini, eingöngu ef starfsmaður velur að bæta skírteininu í veskið sitt</td><td>Samkvæmt skilmálum Apple/Google</td></tr>
        </tbody>
      </table>
      <p>Við tilkynnum viðskiptavinum um breytingar á undirvinnsluaðilum með a.m.k. 30 daga fyrirvara.</p>

      <h2>6. Varðveislutími</h2>
      <ul>
        <li>Gögn viðskiptavinar eru geymd á meðan áskrift er virk. Við uppsögn getur viðskiptavinur flutt gögnin út (Excel/PDF). Gögnum er eytt innan 90 daga frá lokum áskriftar nema lög krefjist lengri varðveislu.</li>
        <li>Launa- og bókhaldsgögn sem tengjast reikningum VAKTO: 7 ár samkvæmt bókhaldslögum.</li>
        <li>Aðgerðaskrá og öryggisskrár: allt að 12 mánuðir.</li>
        <li>Samtöl í spjalli heimasíðunnar: allt að 12 mánuðir.</li>
      </ul>

      <h2>7. Réttindi þín</h2>
      <p>Þú átt rétt á aðgangi að upplýsingum um þig, leiðréttingu, eyðingu, takmörkun vinnslu, flutningi gagna og að andmæla vinnslu sem byggir á lögmætum hagsmunum. Sé vinnslan byggð á samþykki máttu afturkalla það hvenær sem er. Beiðnir sendast á <a href="mailto:hallo@vakto.is">hallo@vakto.is</a> og við svörum innan 30 daga. Starfsfólk viðskiptavina beinir beiðnum fyrst til vinnuveitanda síns (ábyrgðaraðila); við aðstoðum hann við að svara. Þú getur einnig kvartað til <a href="https://www.personuvernd.is" target="_blank" rel="noreferrer">Persónuverndar</a>.</p>

      <h2>8. Öryggi</h2>
      <p>Aðgangur er varinn með lykilorðum og innskráningarhlekkjum, allar tengingar eru dulkóðaðar, gögn eru aðskilin milli fyrirtækja í gagnagrunni, kiosk-stimpilklukkan er varin með leynilykli fyrirtækisins og allar mikilvægar aðgerðir eru skráðar í aðgerðaskrá. Verði öryggisbrestur sem varðar persónuupplýsingar tilkynnum við viðskiptavinum án ótilhlýðilegrar tafar og Persónuvernd innan 72 klukkustunda þegar það á við.</p>

      <h2>9. Börn</h2>
      <p>Þjónustan er ætluð fyrirtækjum og starfsfólki þeirra. Vinnuveitandi ber ábyrgð á að skráning starfsfólks undir 18 ára sé í samræmi við lög.</p>

      <h2>10. Breytingar</h2>
      <p>Við getum uppfært þessa stefnu. Efnislegar breytingar eru tilkynntar viðskiptavinum með tölvupósti eða í kerfinu áður en þær taka gildi. Gildandi útgáfa er alltaf á vakto.is/personuvernd.</p>

      <h2>11. Samband</h2>
      <p>VAKTO ehf., Ísland · <a href="mailto:hallo@vakto.is">hallo@vakto.is</a></p>
    </LegalShell>
  );
}
