"use client";

// Markaðssíða VAKTO Verk (verktakar og einyrkjar). Aðeins það sem er til í dag er kynnt sem tilbúið;
// annað er merkt „Væntanlegt“.
import { useEffect, useState } from "react";
import AhFooter from "@/components/site/ah-footer";
import SiteNav from "@/components/site/site-nav";
import { Glow } from "@/components/site/home-client";
import { VERKTAKI_PLAN } from "@/lib/plans";
import { nf } from "@/lib/format";

const SIGNUP = "/nyskraning?plan=verktaki";

function Clock() {
  const [s, setS] = useState(2 * 3600 + 17 * 60 + 41);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{`${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`}</>;
}

const FEATURES: { t: string; p: string; soon?: boolean; i: React.ReactNode }[] = [
  { t: "Tímataka á verkstað", p: "Ýttu á Byrja þegar þú mætir. Síminn staðfestir að þú sért á staðnum og viðskiptavinurinn sér það í skýrslunni.", i: <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /> },
  { t: "Myndir og athugasemdir", p: "Taktu mynd fyrir og eftir. Myndirnar fylgja verkskýrslunni sjálfkrafa, engin leit í myndasafninu.", i: <><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></> },
  { t: "Samþykkt með einum smelli", p: "Viðskiptavinurinn fær hlekk, sér tíma, efni, myndir og upphæðir og samþykkir. Nafn og tími eru skráð.", i: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16.5 9.5" /></> },
  { t: "Efni, útlagt og akstur", p: "Skráðu efni og útlagðan kostnað á verkið og kílómetra við hverja tímatöku. Allt tekið saman fyrir þig.", i: <><path d="M3 7h13v10H3zM16 10h3.5L21 12.5V17h-5" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></> },
  { t: "35 % endurgreiðslan reiknuð", p: "Vinna og efni eru aðskilin í skýrslunni og húseigandinn sér hvað hann fær endurgreitt af vsk. af vinnu.", i: <><path d="M4 20 20 4" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></> },
  { t: "Teymi þegar þú stækkar", p: "Bættu við starfsmanni eða undirverktaka. Hver skráir sína tíma, þú sérð allt og sendir eina skýrslu.", i: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14.6c2.6.2 4.4 2 5 5.4" /></> },
  { t: "Tilboð og verksamningar", p: "Búðu til tilboð eða verksamning sem viðskiptavinurinn undirritar rafrænt. Samþykkt tilboð verður að verki.", soon: true, i: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></> },
  { t: "Reikningar í Payday", p: "Samþykkt skýrsla verður að reikningi í bókhaldinu þínu, með vinnu og efni aðskilið.", soon: true, i: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></> },
  { t: "VAKTO AI fyrir verkin", p: "„Skrifaðu verkskýrslu úr myndunum“ eða „hvað vann ég mikið fyrir Jón í október?“ og AI sér um rest.", soon: true, i: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" /> },
];

const FAQ: [string, string][] = [
  ["Fyrir hverja er VAKTO Verk?", "Iðnaðarmenn, verktaka og einyrkja sem vinna á tímagjaldi eða í verkum: rafvirkja, smiði, pípara, málara, garðyrkju, þrif, tölvu- og ráðgjafarvinnu. Allt frá einum manni upp í lítið teymi."],
  ["Þarf viðskiptavinurinn að stofna aðgang?", "Nei. Hann fær hlekk í tölvupósti eða skilaboðum, opnar skýrsluna í símanum og samþykkir eða biður um lagfæringu."],
  ["Er staðsetningin alltaf rakin?", "Nei. Staðsetningin er aðeins lesin þegar þú byrjar og stöðvar tímatöku, til að staðfesta að þú hafir verið á verkstaðnum. Engin stöðug rakning."],
  ["Get ég notað þetta í tölvunni líka?", "Já. Allt sem er í appinu er líka á vakto.is: verk, tímar, efni, myndir og skýrslur."],
  ["Hvað ef ég er ekki með vsk-númer?", "Skýrslan reiknar vsk. sjálfgefið. Stillingar fyrir þá sem eru undir veltumörkum eru á leiðinni. Hafðu samband og við hjálpum þér."],
  ["Er binding?", "Nei. 14 daga frí prufa og svo mánaðarleg áskrift sem þú getur sagt upp hvenær sem er."],
];

export default function VerktakarClient() {
  const p = VERKTAKI_PLAN;
  return (
    <div className="ah vk-site">
      <Glow />
      <SiteNav />
      <main id="efni">
        {/* ---------- hetja ---------- */}
        <section className="vks-hero">
          <div className="vks-hero-tx">
            <p className="ah-eyebrow">VAKTO Verk · vakt og verk</p>
            <h1>Verkið, tíminn<br />og samþykktin.<br /><span>Í einu appi.</span></h1>
            <p className="vks-lede">Byrjaðu tímatöku á verkstaðnum, taktu myndir og skráðu efni. Viðskiptavinurinn samþykkir verkskýrsluna með einum smelli, og deilur um tímana heyra sögunni til.</p>
            <div className="vks-cta">
              <a className="ah-btn ah-btn-lg" href={SIGNUP}>Prófa frítt í 14 daga</a>
              <span className="vks-price-note">{nf(p.base)} kr. á mánuði · engin binding</span>
            </div>
          </div>
          <div className="vks-stage" aria-hidden="true">
            <div className="vks-phone">
              <div className="vks-notch" />
              <div className="vks-screen">
                <div className="vks-app-top"><span>Verk</span><b>+</b></div>
                <div className="vks-live">
                  <div className="vks-live-h"><i />Tímataka í gangi</div>
                  <div className="vks-live-t"><Clock /></div>
                  <div className="vks-live-j">Baðherbergi · Laugavegi 5</div>
                  <div className="vks-live-geo">● Staðfest á verkstað</div>
                  <div className="vks-live-b">Stöðva</div>
                </div>
                <div className="vks-kpi"><div><small>Í mánuðinum</small><b>86,5 klst.</b></div><div><small>Opin verk</small><b>4</b></div></div>
                <div className="vks-job"><b>Eldhús, Kópavogi</b><small>Anna Jónsdóttir · 12,0 klst.</small></div>
                <div className="vks-job"><b>Raflagnir, Grafarholti</b><small>Byggás ehf. · 31,5 klst.</small></div>
              </div>
            </div>
            <div className="vks-float vks-f1"><b>Samþykkt</b><span>Anna Jónsdóttir · í dag 16:42</span></div>
            <div className="vks-float vks-f2"><span className="vks-thumbs"><i /><i /><i /></span><span>3 myndir í skýrslu</span></div>
          </div>
        </section>

        {/* ---------- vandinn ---------- */}
        <section className="vks-pain">
          <div className="vks-pain-in">
            <p className="vks-q">„Ég vann miklu meira en þetta.“<br /><span>„Ég borga ekki fyrir tíma sem ég sá ekki.“</span></p>
            <p className="vks-pain-p">Flestir verktakar þekkja samtalið. Tímarnir eru í kollinum, kvittanirnar í hanskahólfinu og myndirnar týndar í símanum. VAKTO Verk safnar þessu saman á meðan þú vinnur, og viðskiptavinurinn sér allt áður en reikningurinn fer út.</p>
          </div>
        </section>

        {/* ---------- skref ---------- */}
        <section className="ah-sec vks-steps">
          <p className="ah-eyebrow">Svona virkar þetta</p>
          <h2>Þrjú skref.<br /><span>Engin pappírsvinna.</span></h2>
          <ol>
            <li><b>1</b><h3>Byrjaðu á staðnum</h3><p>Opnaðu verkið og ýttu á Byrja. Síminn skráir tímann og staðfestir staðsetninguna.</p></li>
            <li><b>2</b><h3>Skráðu á meðan þú vinnur</h3><p>Myndir, efni, útlagður kostnaður og akstur fara beint á verkið, á nokkrum sekúndum.</p></li>
            <li><b>3</b><h3>Sendu til samþykktar</h3><p>Veldu tímabil og sendu hlekk. Viðskiptavinurinn samþykkir og þú veist að reikningurinn verður greiddur.</p></li>
          </ol>
        </section>

        {/* ---------- samþykktarsíðan ---------- */}
        <section className="ah-sec vks-approve">
          <div className="vks-approve-tx">
            <p className="ah-eyebrow">Það sem viðskiptavinurinn sér</p>
            <h2>Gegnsæi sem<br /><span>byggir traust.</span></h2>
            <p className="vks-lede">Engin innskráning, ekkert app. Viðskiptavinurinn opnar hlekkinn, sér hverja tímaskráningu með staðfestingu á verkstað, myndirnar, efnið og upphæðirnar — og samþykkir. Þú sérð samþykktina í VAKTO um leið.</p>
            <ul className="vks-ticks">
              <li>Tímar með staðfestingu á verkstað</li>
              <li>Vinna, efni og vsk. sundurliðað</li>
              <li>Endurgreiðsla vsk. af vinnu reiknuð fyrir húseigandann</li>
              <li>Nafn og tími samþykktar skráð</li>
            </ul>
          </div>
          <div className="vks-doc" aria-hidden="true">
            <div className="vks-doc-h"><div><small>Verkskýrsla frá</small><b>Jón Rafvirki ehf.</b></div><span>Bíður samþykktar</span></div>
            <div className="vks-doc-t">Baðherbergi, Laugavegi 5<small>1.–31. október</small></div>
            <div className="vks-doc-k"><div><b>24,5 klst.</b><small>Vinna</small></div><div><b>38 km</b><small>Akstur</small></div><div><b>402.169 kr.</b><small>Samtals m. vsk.</small></div></div>
            <div className="vks-doc-r"><span>Vinna (24,5 klst. × 9.500 kr.)</span><b>232.750 kr.</b></div>
            <div className="vks-doc-r"><span>Efni</span><b>91.580 kr.</b></div>
            <div className="vks-doc-r"><span>Virðisaukaskattur 24 %</span><b>77.839 kr.</b></div>
            <div className="vks-doc-r tot"><span>Samtals</span><b>402.169 kr.</b></div>
            <div className="vks-doc-n">Endurgreiðsla vsk. af vinnu á íbúðarhúsnæði: um <b>19.551 kr.</b></div>
            <div className="vks-doc-btns"><span className="ok">Samþykkja</span><span>Biðja um lagfæringu</span></div>
          </div>
        </section>

        {/* ---------- eiginleikar ---------- */}
        <section className="ah-sec vks-feat">
          <p className="ah-eyebrow">Allt sem verktaki þarf</p>
          <h2>Hannað fyrir vinnuna<br /><span>á vettvangi.</span></h2>
          <div className="vks-grid">
            {FEATURES.map((f) => (
              <article key={f.t} className={f.soon ? "soon" : ""}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{f.i}</svg>
                <h3>{f.t}{f.soon && <em>Væntanlegt</em>}</h3>
                <p>{f.p}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- verð ---------- */}
        <section className="ah-sec vks-pricing" id="verd">
          <div className="vks-pcard">
            <p className="ah-eyebrow">Verð</p>
            <h2 className="vks-pname">Verktaki</h2>
            <div className="vks-pp"><b>{nf(p.base)}</b><span>kr. á mánuði án vsk.</span></div>
            <p className="vks-pinc">Einn notandi innifalinn. Hver viðbótarnotandi {nf(p.extraPerEmployee ?? 0)} kr.</p>
            <ul className="vks-ticks">
              <li>Ótakmörkuð verk og viðskiptavinir</li>
              <li>Tímataka með staðfestingu á verkstað</li>
              <li>Myndir, efni, útlagt og akstur</li>
              <li>Verkskýrslur og samþykkt viðskiptavinar</li>
              <li>App fyrir iPhone og Android, og vefur</li>
              <li>VAKTO AI, {p.aiQuestions} spurningar á mánuði</li>
            </ul>
            <a className="ah-btn ah-btn-lg" href={SIGNUP}>Prófa frítt í 14 daga</a>
            <p className="vks-fine">Engin binding. Rekur þú fyrirtæki með vaktavinnu? <a href="/verd">Sjá leiðir fyrir fyrirtæki</a>.</p>
          </div>
        </section>

        {/* ---------- spurningar ---------- */}
        <section className="ah-sec vks-faq">
          <h2>Spurt og svarað</h2>
          <div className="vks-faq-l">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>

        <section className="vks-final">
          <h2>Minni pappírsvinna.<br /><span>Fleiri samþykktir reikningar.</span></h2>
          <a className="ah-btn ah-btn-lg" href={SIGNUP}>Byrja frítt</a>
        </section>
      </main>
      <AhFooter />
    </div>
  );
}
