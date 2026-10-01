"use client";

// Um okkur (IS/EN). Allur texti byggir á orðum Bjarna sjálfs (okt. 2026).
import AhFooter from "./ah-footer";
import SiteNav from "./site-nav";
import { useSiteLang } from "./lang";

const A = {
  is: {
    h1: "Ég bjó til kerfið sem mig vantaði.", by: "Bjarni Lúðvíksson, stofnandi VAKTO", alt: "Bjarni Lúðvíksson, stofnandi VAKTO",
    lead1: "Ég hef komið að rekstri á mörgum sviðum: veitingastöðum, framleiðslueldhúsi, ferðaþjónustu og gistiheimilum. Í öllum þeim rekstri fann ég aldrei almennilegt kerfi sem hentaði og var einfalt í notkun, bæði fyrir mig og starfsfólkið.",
    lead2: "VAKTO er svarið við því sem fór í taugarnar á mér árum saman.",
    painsAria: "Það sem VAKTO leysir",
    pains: [
      ["Ráðningarsamningar týndust.", "Nú verður samningurinn til úr gögnum starfsmannsins, báðir undirrita rafrænt og undirritað eintak er geymt á einum stað."],
      ["Starfsmannaskírteinin gleymdust.", "Það er ekki gott þegar eftirlitsaðilar koma í heimsókn. Nú er skírteinið í símanum hjá öllum, í Apple og Google Wallet."],
      ["Reglur og HACCP náðu ekki til allra.", "Nú eru þær í vasanum hjá öllu starfsfólki, sem getur auðveldlega nálgast þær og skoðað."],
      ["Yfirvinnan kom í ljós um mánaðamót.", "Nú sé ég laun sem hlutfall af veltu og frávik á einfaldan hátt, og raunverulegan kostnað í rauntíma þegar vikið er frá vaktaplaninu."],
      ["Kjarasamningar og skilmálar tóku tíma.", "Nú hjálpar gervigreind að finna rétta kjarasamninginn og semja skilmála á faglegan hátt. Þeir fara beint í ráðningarsamninginn, sem er undirritaður rafrænt."],
    ],
    quote: "„Ég var alltof oft að taka eftir öllum yfirvinnutímunum hjá starfsfólkinu þegar mánuðurinn var gerður upp. Nú er það út sögunni.“",
    ctaH: "Prófaðu VAKTO í þínum rekstri.", ctaP: "14 dagar frítt, engin binding. Eða sendu mér línu á ", try: "Prófa frítt",
  },
  en: {
    h1: "I built the system I needed.", by: "Bjarni Lúðvíksson, founder of VAKTO", alt: "Bjarni Lúðvíksson, founder of VAKTO",
    lead1: "I've run businesses in many fields: restaurants, a production kitchen, tourism and guesthouses. In all of them I never found a proper system that fit and was simple to use, for me and for the staff.",
    lead2: "VAKTO is the answer to what frustrated me for years.",
    painsAria: "What VAKTO solves",
    pains: [
      ["Employment contracts went missing.", "Now the contract is created from the employee's details, both parties sign electronically and the signed copy is kept in one place."],
      ["Employee ID cards were forgotten.", "That's not good when inspectors drop by. Now everyone has the card on their phone, in Apple and Google Wallet."],
      ["Rules and HACCP didn't reach everyone.", "Now they're in every employee's pocket, easy to find and read."],
      ["Overtime showed up at month end.", "Now I see labor as a share of revenue and deviations at a glance, and the real cost in real time when the schedule isn't followed."],
      ["Union agreements and terms took time.", "Now AI helps find the right union agreement and draft terms professionally. They go straight into the employment contract, which is signed electronically."],
    ],
    quote: "“Far too often I only noticed all the staff overtime when the month was being closed. That's a thing of the past.”",
    ctaH: "Try VAKTO in your business.", ctaP: "14 days free, no commitment. Or drop me a line at ", try: "Try free",
  },
};

export default function AboutClient() {
  const t = A[useSiteLang()];
  return (
    <div className="ah ah-about">
      <SiteNav current="about" />
      <main id="efni">
        <section className="ab-hero">
          <picture>
            <source media="(max-width: 760px)" srcSet="/showcase/forsida/um/bjarni-portrait.jpg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/showcase/forsida/um/bjarni-wide.jpg" alt={t.alt} width={2400} height={1600} fetchPriority="high" />
          </picture>
          <div className="ab-hero-tx">
            <h1>{t.h1}</h1>
            <p>{t.by}</p>
          </div>
        </section>
        <section className="ab-story">
          <p className="ab-lead">{t.lead1}</p>
          <p className="ab-lead">{t.lead2}</p>
        </section>
        <section className="ab-pains" aria-label={t.painsAria}>
          {t.pains.map(([h, p]) => (
            <div className="ab-pain" key={h}><h2>{h}</h2><p>{p}</p></div>
          ))}
        </section>
        <figure className="ab-quote">
          <blockquote>{t.quote}</blockquote>
          <figcaption>Bjarni Lúðvíksson</figcaption>
        </figure>
        <section className="ab-cta">
          <h2>{t.ctaH}</h2>
          <p>{t.ctaP}<a href="mailto:hallo@vakto.is">hallo@vakto.is</a>.</p>
          <a className="ah-btn ah-btn-lg" href="/nyskraning">{t.try}</a>
        </section>
      </main>
      <AhFooter />
    </div>
  );
}
