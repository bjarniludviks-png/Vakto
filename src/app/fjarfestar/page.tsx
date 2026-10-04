import type { Metadata } from "next";
import { cookies } from "next/headers";
import SiteNav from "@/components/site/site-nav";
import AhFooter from "@/components/site/ah-footer";
import { Glow } from "@/components/site/home-client";
import "@/components/site/home.css";
import "./fj.css";
import { COOKIE, token } from "./gate";
import { unlock } from "./actions";
import { Calculator } from "./calculator";
import { PLANS } from "@/lib/pricing";
import { nf } from "@/lib/format";

// Fjárfestasíða (lykilorðsvarin, noindex). Áætlanir byggja á raunverulegu verðskránni í src/lib/pricing.ts.
export const metadata: Metadata = { title: "VAKTO: Fjárfestar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PATH = [{ y: 2026, n: 10 }, { y: 2027, n: 150 }, { y: 2028, n: 450 }, { y: 2029, n: 1000 }, { y: 2030, n: 1800 }, { y: 2031, n: 2500 }];
const ARPA = PLANS.v2.base + (15 - PLANS.v2.included) * PLANS.v2.extra; // meðalfyrirtæki: 15 virkir starfsmenn

export default async function Fjarfestar({ searchParams }: { searchParams: Promise<{ villa?: string }> }) {
  const { villa } = await searchParams;
  const ok = (await cookies()).get(COOKIE)?.value === token();
  return (
    <div className="ah fj">
      <Glow />
      <SiteNav />
      {!ok ? (
        <main className="fj-gate">
          <h1>Fjárfestar</h1>
          <p>Viðskiptaáætlun VAKTO 2026–2031. Sláðu inn lykilorðið sem þú fékkst.</p>
          <form action={unlock}>
            <input name="pw" type="password" autoFocus required placeholder="Lykilorð" aria-label="Lykilorð" />
            {villa && <span className="fj-err">Rangt lykilorð.</span>}
            <button>Opna</button>
          </form>
        </main>
      ) : (
        <main className="fj-main">
          <header className="fj-hero">
            <div className="fj-eye">Fjárfestar · Trúnaðarmál</div>
            <h1>Launin eru stærsti kostnaðurinn.<br /><span>Nú sést hann í rauntíma.</span></h1>
            <p>Vaktaplan, stimpilklukka, laun eftir kjarasamningi og ráðningarsamningar í einu kerfi, með laun sem hlutfall af veltu á hverjum degi. Smíðað af rekstraraðila, í notkun á Íslandi í dag.</p>
          </header>

          <div className="fj-kpis">
            {[["2.500", "fyrirtæki í áskrift 2031"], ["≈ 750 m.kr.", "árstekjur í lok 2031"], ["2029", "hagnaður hefst"], ["740 m.kr.", "fjármögnun, 3 áfangar"]].map(([v, l]) => (
              <div key={l}><b>{v}</b><span>{l}</span></div>
            ))}
          </div>

          <section className="fj-sec">
            <h2>Staðan í dag</h2>
            <div className="fj-grid3">
              {[
                ["Varan er tilbúin", "Vefkerfi og app fyrir iPhone og Android: vaktaplan, stimpilklukka, tímaskráning, launakeyrsla, ráðningarsamningar, spjall og fréttaveita."],
                ["Í notkun hjá viðskiptavinum", "Fyrstu fyrirtækin keyra rekstur sinn á VAKTO. Áskrift með korti, reikningar og innheimta eru sjálfvirk."],
                ["Tengt við það sem fyrir er", "Laun fara í Payday eða DK, samningar eru undirritaðir með rafrænum skilríkjum (Taktikal) og velta kemur úr kassakerfi eða er skráð."],
              ].map(([h, p]) => <div key={h} className="fj-card"><h3>{h}</h3><p>{p}</p></div>)}
            </div>
          </section>

          <section className="fj-sec">
            <h2>Tekjulíkanið</h2>
            <div className="fj-grid3">
              <div className="fj-card fj-num"><span>Grunnáskrift</span><b>9.990 kr</b><p>á mánuði, 5 virkir starfsmenn innifaldir</p></div>
              <div className="fj-card fj-num"><span>Hver virkur starfsmaður umfram</span><b>1.490 kr</b><p>á mánuði. Tekjur vaxa með viðskiptavininum</p></div>
              <div className="fj-card fj-num"><span>Meðalfyrirtæki (15 starfsmenn)</span><b>{nf(ARPA)} kr</b><p>á mánuði · {nf(ARPA * 12)} kr á ári, án VSK</p></div>
            </div>
            <p className="fj-note">Auk þess 490 kr. á hverja undirskrift með rafrænum skilríkjum. Allt án VSK.</p>
          </section>

          <section className="fj-sec"><Calculator /></section>

          <section className="fj-sec">
            <h2>Leiðin að 2.500</h2>
            <div className="fj-path">
              {PATH.map((p) => (
                <div key={p.y}>
                  <b>{nf(p.n)}</b>
                  <i style={{ height: `${Math.max(4, (p.n / 2500) * 170)}px`, opacity: 0.4 + (p.n / 2500) * 0.6 }} />
                  <span>{p.y}</span>
                </div>
              ))}
            </div>
            <div className="fj-grid3 fj-mk">
              {[["2026–27", "Ísland og Færeyjar"], ["2028", "Noregur, Írland, Danmörk"], ["2029–31", "Svíþjóð, Finnland, Holland, Eistland, Pólland"]].map(([y, l]) => (
                <div key={y} className="fj-card"><span>{y}</span><h3>{l}</h3></div>
              ))}
            </div>
            <p className="fj-note">Víetnamska er þegar í appinu, sem opnar leið að víetnömskum veitingastöðum um öll Norðurlönd.</p>
          </section>

          <section className="fj-sec">
            <h2>Fjármögnun</h2>
            <div className="fj-grid3">
              {[["2026–27", "40 m.kr.", "Forsproti · sala á Íslandi, app og stuðningur"], ["2028", "200 m.kr.", "Seed · Noregur, Írland, Danmörk og söluteymi"], ["2030", "500 m.kr.", "A-umferð · Evrópa"]].map(([y, a, l]) => (
                <div key={y} className="fj-card fj-num"><span>{y}</span><b>{a}</b><p>{l}</p></div>
              ))}
            </div>
            <p className="fj-note">Styrkir: Tækniþróunarsjóður, EIC Accelerator · Sjóðir: íslenskir og norrænir vísisjóðir · Fjárfestar úr veitinga- og þjónustugeiranum</p>
          </section>

          <p className="fj-fine">Áætlanir, ekki loforð. Tekjur miðast við verðskrá VAKTO án VSK og meðalfyrirtæki með 15 virka starfsmenn. Trúnaðarmál.</p>
        </main>
      )}
      <AhFooter />
    </div>
  );
}
