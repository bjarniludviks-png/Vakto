// Efni síðunnar /vafrakokur — birt í AhLegal (src/components/site/ah-legal.tsx) — (/vafrakokur).
export const COOKIES_META = { title: "Vafrakökur", updated: "16. október 2026" };

export function CookiesBody() {
  return (
    <>
      <div className="lg-note">Stutta útgáfan: á opna vefnum (forsíðu og kynningarsíðum) mælum við notkun með Google Analytics og árangur auglýsinga með Meta Pixel <b>aðeins ef þú leyfir það</b>. Inni í kerfinu sjálfu eru engar greiningarvafrakökur, aðeins það sem þarf til að þú getir skráð þig inn og til að muna stillingarnar þínar.</div>

      <h2>1. Nauðsynlegar vafrakökur</h2>
      <table>
        <thead><tr><th>Nafn</th><th>Tilgangur</th><th>Líftími</th></tr></thead>
        <tbody>
          <tr><td>sb-*-auth-token</td><td>Innskráning (Supabase Auth). Heldur þér innskráðum og endurnýjar lotuna.</td><td>Þar til þú skráir þig út, að hámarki nokkrar vikur</td></tr>
          <tr><td>vakto-impersonating, vakto-impersonating-ui</td><td>Aðeins þegar VAKTO-stuðningur skráir sig inn sem fyrirtæki til að aðstoða; sýnir borða efst og leið til baka.</td><td>Lota</td></tr>
        </tbody>
      </table>
      <p>Þessar kökur eru forsenda þess að þjónustan virki og krefjast ekki samþykkis samkvæmt lögum um fjarskipti.</p>

      <h2>2. Geymsla í vafranum (localStorage)</h2>
      <p>Til að muna stillingar geymum við nokkur gildi í vafranum þínum. Þau fara aldrei til þriðju aðila og innihalda ekki persónuupplýsingar.</p>
      <table>
        <thead><tr><th>Lykill</th><th>Tilgangur</th></tr></thead>
        <tbody>
          <tr><td>vakto-lang</td><td>Valið tungumál (íslenska/enska)</td></tr>
          <tr><td>vakto-theme</td><td>Ljóst eða dökkt þema</td></tr>
          <tr><td>vakto-rail, vakto-dash-*, vakto:period:*</td><td>Hvernig þú síðast stilltir hliðarstiku, mælaborð og tímabil</td></tr>
          <tr><td>vakto-onb-hidden</td><td>Að þú hafir lokað byrjunarleiðbeiningum</td></tr>
          <tr><td>vakto-kiosk-mode, vakto-kiosk-lang</td><td>Stillingar stimpilklukku á spjaldtölvu</td></tr>
          <tr><td>vakto-home-chat</td><td>Auðkenni samtals í spjallinu á heimasíðunni svo þú getir haldið því áfram</td></tr>
          <tr><td>vakto-consent</td><td>Hvort þú leyfðir eða hafnaðir greiningarvafrakökum á opna vefnum</td></tr>
        </tbody>
      </table>

      <h2>3. Greiningar- og auglýsingavafrakökur (aðeins með samþykki)</h2>
      <p>Á opna vefnum (forsíðu, Um okkur, innskráningu, nýskráningu og þessum síðum) birtist val um að leyfa eða hafna greiningu. Ef þú velur „Leyfa“ notum við Google Analytics 4 til að sjá hvaða síður eru skoðaðar, hvaðan gestir koma og hvernig vefurinn virkar, í samanteknu formi. Við notum einnig Meta Pixel til að mæla hvort auglýsingar okkar á Facebook og Instagram leiða til heimsókna og nýskráninga, og til að birta þær fólki sem líklegt er að hafi áhuga. Ef þú velur „Hafna“ eða velur ekkert eru engar greiningarvafrakökur settar. Hvorugt er nokkurn tímann notað inni í kerfinu sjálfu.</p>
      <table>
        <thead><tr><th>Nafn</th><th>Tilgangur</th><th>Líftími</th></tr></thead>
        <tbody>
          <tr><td>_ga</td><td>Google Analytics: greinir á milli heimsókna (handahófskennt auðkenni)</td><td>2 ár</td></tr>
          <tr><td>_ga_*</td><td>Google Analytics: heldur utan um lotu</td><td>2 ár</td></tr>
          <tr><td>_fbp</td><td>Meta Pixel: greinir á milli heimsókna til að mæla árangur auglýsinga</td><td>3 mánuðir</td></tr>
          <tr><td>_fbc</td><td>Meta Pixel: geymir að þú komst inn af auglýsingu (aðeins ef svo er)</td><td>3 mánuðir</td></tr>
        </tbody>
      </table>
      <p>Valið þitt er geymt í vafranum (localStorage: <code>vakto-consent</code>). Þú getur breytt því hvenær sem er með því að eyða geymslu vefsins í stillingum vafrans; þá ertu spurð(ur) aftur.</p>

      <h2>4. Aðrir þriðju aðilar</h2>
      <p>Fyrir utan það sem talið er upp í kafla 3 notum við enga auglýsingarakningu. Innbyggð myndbönd frá öðrum eða ytri efnishlutar eru ekki notaðir. Sé starfsmannaskírteini bætt í Apple Wallet eða Google Wallet gilda skilmálar Apple/Google um það í símanum.</p>

      <h2>5. Hvernig þú stjórnar þessu</h2>
      <p>Þú getur eytt vafrakökum og geymslu í stillingum vafrans. Sé nauðsynlegum kökum eytt þarftu að skrá þig inn aftur.</p>

      <h2>6. Samband</h2>
      <p>Spurningar um vafrakökur og persónuvernd: <a href="mailto:hallo@vakto.is">hallo@vakto.is</a>. Sjá einnig <a href="/personuvernd">persónuverndarstefnu</a>.</p>
    </>
  );
}
