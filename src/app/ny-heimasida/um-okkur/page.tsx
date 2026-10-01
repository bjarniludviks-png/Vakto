import type { Metadata } from "next";
import "../home.css";
import "./um.css";
import AhFooter, { AhLogo } from "../ah-footer";

// Um okkur: saga stofnandans. Allur texti byggir á orðum Bjarna sjálfs (okt. 2026).
export const metadata: Metadata = {
  title: "VAKTO: Um okkur",
  description: "VAKTO er búið til af rekstraraðila sem fann aldrei einfalt kerfi fyrir vaktir, laun og starfsfólk.",
  robots: { index: false, follow: false },
};

const PAINS: [string, string][] = [
  ["Ráðningarsamningar týndust.", "Nú verður samningurinn til úr gögnum starfsmannsins, báðir undirrita rafrænt og undirritað eintak er geymt á einum stað."],
  ["Starfsmannaskírteinin gleymdust.", "Það er ekki gott þegar eftirlitsaðilar koma í heimsókn. Nú er skírteinið í símanum hjá öllum, í Apple og Google Wallet."],
  ["Reglur og HACCP náðu ekki til allra.", "Nú eru þær í vasanum hjá öllu starfsfólki, sem getur auðveldlega nálgast þær og skoðað."],
  ["Yfirvinnan kom í ljós um mánaðamót.", "Nú sé ég laun sem hlutfall af veltu og frávik á einfaldan hátt, og raunverulegan kostnað í rauntíma þegar vikið er frá vaktaplaninu."],
  ["Kjarasamningar og skilmálar tóku tíma.", "Nú hjálpar gervigreind að finna rétta kjarasamninginn og semja skilmála á faglegan hátt. Þeir fara beint í ráðningarsamninginn, sem er undirritaður rafrænt."],
];

export default function Page() {
  return (
    <div className="ah ah-about">
      <nav className="ah-nav sc">
        <a href="/ny-heimasida" aria-label="VAKTO forsíða"><AhLogo /></a>
        <div className="ah-nav-links">
          <a href="/ny-heimasida#kerfid">Kerfið</a><a href="/ny-heimasida#samningar">Samningar</a><a href="/ny-heimasida#verd">Verð</a>
        </div>
        <div className="ah-nav-cta">
          <a href="/ny-heimasida/innskraning" className="ah-nav-in">Innskráning</a>
          <a href="/ny-heimasida/prufa" className="ah-btn ah-btn-sm">Prófa frítt</a>
        </div>
      </nav>
      <main id="efni">
        <section className="ab-hero">
          <picture>
            <source media="(max-width: 760px)" srcSet="/showcase/forsida/um/bjarni-portrait.jpg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/showcase/forsida/um/bjarni-wide.jpg" alt="Bjarni Lúðvíksson, stofnandi VAKTO" width={2400} height={1600} fetchPriority="high" />
          </picture>
          <div className="ab-hero-tx">
            <h1>Ég bjó til kerfið sem mig vantaði.</h1>
            <p>Bjarni Lúðvíksson, stofnandi VAKTO</p>
          </div>
        </section>

        <section className="ab-story">
          <p className="ab-lead">Ég hef komið að rekstri á mörgum sviðum: veitingastöðum, framleiðslueldhúsi, ferðaþjónustu og gistiheimilum. Í öllum þeim rekstri fann ég aldrei almennilegt kerfi sem hentaði og var einfalt í notkun, bæði fyrir mig og starfsfólkið.</p>
          <p className="ab-lead">VAKTO er svarið við því sem fór í taugarnar á mér árum saman.</p>
        </section>

        <section className="ab-pains" aria-label="Það sem VAKTO leysir">
          {PAINS.map(([h, p]) => (
            <div className="ab-pain" key={h}>
              <h2>{h}</h2>
              <p>{p}</p>
            </div>
          ))}
        </section>

        <figure className="ab-quote">
          <blockquote>„Ég var alltof oft að taka eftir öllum yfirvinnutímunum hjá starfsfólkinu þegar mánuðurinn var gerður upp. Nú er það út sögunni.“</blockquote>
          <figcaption>Bjarni Lúðvíksson</figcaption>
        </figure>

        <section className="ab-cta">
          <h2>Prófaðu VAKTO í þínum rekstri.</h2>
          <p>14 dagar frítt, engin binding. Eða sendu mér línu á <a href="mailto:hallo@vakto.is">hallo@vakto.is</a>.</p>
          <a className="ah-btn ah-btn-lg" href="/ny-heimasida/prufa">Prófa frítt</a>
        </section>
      </main>
      <AhFooter />
    </div>
  );
}
