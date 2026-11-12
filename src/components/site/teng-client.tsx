"use client";

// Tengingar (/tengingar og /da/integrationer …): aðeins það sem VAKTO tengist í alvöru í dag, með leiðbeiningum
// sem lýsa raunverulegu viðmóti í Stillingum. Merki: opinber merki sem kerfið notar nú þegar í Stillingum
// (public/integrations, aldrei hlekkjuð af vef annarra) eða hlutlaus orðmerki. Texti í teng-text.ts.
import AhFooter from "./ah-footer";
import SiteNav from "./site-nav";
import { Glow } from "./home-client";
import { useSiteLang } from "./lang";
import { PATHS, appHref } from "./i18n";
import { HOME_TEXT } from "./home-text";
import { TENG_TEXT, type TengCat, type TengId, type TengPlannedId } from "./teng-text";

type Logo = { img: string } | { mark: string; color?: string } | { icon: "inventra" | "api" | "esign" | "mcp" | "wallet" | "calendar" | "excel" };
const LIVE: { id: TengId; name: string; cat: TengCat; logo: Logo }[] = [
  { id: "payday", name: "Payday", cat: "pay", logo: { img: "/integrations/payday.png" } },
  { id: "dk", name: "DK", cat: "pay", logo: { img: "/integrations/dk.png" } },
  { id: "businesscentral", name: "Business Central", cat: "pay", logo: { img: "/integrations/businesscentral.svg" } },
  { id: "excel", name: "Excel · CSV · PDF", cat: "pay", logo: { icon: "excel" } },
  { id: "shopify", name: "Shopify", cat: "rev", logo: { img: "/integrations/shopify.svg" } },
  { id: "woocommerce", name: "WooCommerce", cat: "rev", logo: { img: "/integrations/woocommerce.svg" } },
  { id: "inventra", name: "INVENTRA", cat: "rev", logo: { icon: "inventra" } },
  { id: "api", name: "API · Zapier · Make", cat: "rev", logo: { icon: "api" } },
  { id: "esign", name: "Taktikal", cat: "docs", logo: { icon: "esign" } },
  { id: "mcp", name: "Claude · ChatGPT", cat: "ai", logo: { icon: "mcp" } },
  { id: "wallet", name: "Apple & Google Wallet", cat: "staff", logo: { icon: "wallet" } },
  { id: "calendar", name: "Calendar", cat: "staff", logo: { icon: "calendar" } },
];
const CATS: TengCat[] = ["pay", "rev", "docs", "ai", "staff"];
const PLANNED: { id: TengPlannedId; name: string; logo: Logo }[] = [
  { id: "nordic", name: "Nordic payroll", logo: { mark: "N" } },
  { id: "uniconta", name: "Uniconta", logo: { mark: "U" } },
  { id: "h3", name: "H3 Laun", logo: { mark: "H3" } },
  { id: "m365", name: "Microsoft 365", logo: { mark: "M" } },
  { id: "fortnox", name: "Fortnox", logo: { img: "/integrations/fortnox.png" } },
  { id: "noona", name: "Noona", logo: { img: "/integrations/noona.png" } },
  { id: "dineout", name: "Dineout", logo: { img: "/integrations/dineout.png" } },
  { id: "regla", name: "Regla", logo: { img: "/integrations/regla.png" } },
];

const ICON: Record<string, React.ReactNode> = {
  excel: <><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h8M12 8v10" /></>,
  api: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></>,
  esign: <><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h5" /><path d="M8 17c1.5-1.5 2.5 1 4-.5s2 .5 3.5 0" /></>,
  mcp: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 14.5h2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" /></>,
};

function LogoTile({ logo, name }: { logo: Logo; name: string }) {
  if ("img" in logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <span className="ti-logo"><img src={logo.img} alt="" width={30} height={30} loading="lazy" /></span>;
  }
  if ("mark" in logo) return <span className="ti-logo ti-mark" aria-hidden="true">{logo.mark}</span>;
  if (logo.icon === "inventra") return <span className="ti-logo ti-inv" aria-hidden="true"><i style={{ height: 9 }} /><i style={{ height: 14 }} /><i style={{ height: 19 }} /></span>;
  return <span className="ti-logo ti-ico" aria-hidden="true" title={name}><svg viewBox="0 0 24 24">{ICON[logo.icon]}</svg></span>;
}

const Arrow = ({ dir }: { dir: "out" | "in" }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`ti-arr ${dir}`}>{dir === "out" ? <path d="M5 12h13M13 7l5 5-5 5" /> : <path d="M19 12H6M11 7l-5 5 5 5" />}</svg>
);

export default function TengClient() {
  const lang = useSiteLang();
  const t = TENG_TEXT[lang];
  const P = PATHS[lang];
  return (
    <div className="ah ah-teng">
      <a className="ah-skip" href="#efni">{HOME_TEXT[lang].skip}</a>
      <Glow />
      <SiteNav current="integrations" />
      <main id="efni">
        {/* ---------- hetja ---------- */}
        <section className="ti-hero">
          <p className="ah-eyebrow">{t.eyebrow}</p>
          <h1>{t.h1[0]}<br /><span>{t.h1[1]}</span></h1>
          <p className="ah-lede">{t.lede}</p>
          <div className="ti-wall" aria-hidden="true">
            {LIVE.filter((x) => "img" in x.logo || x.id === "inventra").map((x) => <LogoTile key={x.id} logo={x.logo} name={x.name} />)}
          </div>
          {t.regionNote && <p className="vp-local ti-region"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg><span>{t.regionNote}</span></p>}
          <a className="ah-link ti-jump" href="#listi">{t.jump} ↓</a>
        </section>

        {/* ---------- forskot VAKTO ---------- */}
        <section className="ah-sec ti-edge" aria-labelledby="ti-edge-h">
          <div className="ti-edge-in">
            <div className="ti-edge-tx">
              <p className="ah-eyebrow">{t.edgeEyebrow}</p>
              <h2 id="ti-edge-h">{t.edgeH[0]}<br /><span>{t.edgeH[1]}</span></h2>
              <p>{t.edgeP}</p>
            </div>
            <ul className="ti-edge-l">
              {t.edge.map(([h, p]) => <li key={h}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg><div><b>{h}</b><span>{p}</span></div></li>)}
            </ul>
          </div>
        </section>

        {/* ---------- virkar tengingar eftir flokkum ---------- */}
        <div id="listi">
          {CATS.map((c) => (
            <section key={c} className="ah-sec ti-cat" aria-labelledby={`ti-${c}`}>
              <div className="ti-cat-h">
                <h2 id={`ti-${c}`}>{t.cats[c].h}</h2>
                <p>{t.cats[c].p}</p>
              </div>
              <div className="ti-grid">
                {LIVE.filter((x) => x.cat === c).map((x) => {
                  const it = t.items[x.id];
                  return (
                    <article key={x.id} className="ti-card" id={x.id}>
                      <header>
                        <LogoTile logo={x.logo} name={x.name} />
                        <div><h3>{x.id === "calendar" ? it.sub : x.name}</h3><small>{x.id === "calendar" ? "ICS" : it.sub}</small></div>
                        <span className="ti-pill live">{t.live}</span>
                      </header>
                      <p className="ti-d">{it.d}</p>
                      {(it.out.length > 0 || it.in.length > 0) && (
                        <ul className="ti-flow">
                          {it.out.map((f) => <li key={f}><Arrow dir="out" /><span><b>{t.outL}:</b> {f}</span></li>)}
                          {it.in.map((f) => <li key={f}><Arrow dir="in" /><span><b>{t.inL}:</b> {f}</span></li>)}
                        </ul>
                      )}
                      <details className="ti-how">
                        <summary>{t.stepsL}</summary>
                        <div className="ti-need"><b>{t.needL}</b><ul>{it.need.map((n) => <li key={n}>{n}</li>)}</ul></div>
                        <ol>{it.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* ---------- á leiðinni ---------- */}
        <section className="ah-sec ti-planned" aria-labelledby="ti-planned-h">
          <div className="ti-cat-h">
            <h2 id="ti-planned-h">{t.plannedH}</h2>
            <p>{t.plannedP}</p>
          </div>
          <div className="ti-pgrid">
            {PLANNED.map((x) => {
              const it = t.planned[x.id];
              return (
                <article key={x.id} className="ti-pcard">
                  <LogoTile logo={x.logo} name={x.name} />
                  <div>
                    <h3>{it.name ?? x.name}</h3>
                    <small>{it.sub}</small>
                    <p>{it.d}</p>
                  </div>
                  <span className="ti-pill soon">{t.soon}</span>
                </article>
              );
            })}
          </div>
          <div className="ti-ask">
            <div><b>{t.askH}</b> <span>{t.askP}</span></div>
            <a className="ah-btn ah-btn-sm" href="mailto:hallo@vakto.is?subject=VAKTO%20tenging">{t.askBtn}</a>
          </div>
        </section>

        {/* ---------- lokaákall ---------- */}
        <section className="vp-end">
          <h2>{t.endH}</h2>
          <p>{t.endP}</p>
          <a className="ah-btn ah-btn-lg" href={appHref(lang, "/nyskraning")}>{t.endBtn}</a>
          <p className="vp-end-or"><a href={P.price}>{t.endPrice} →</a></p>
        </section>
      </main>
      <AhFooter />
    </div>
  );
}
