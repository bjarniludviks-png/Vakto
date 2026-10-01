import AhFooter from "./ah-footer";
import SiteNav from "./site-nav";
import LegalEnNote from "./legal-en-note";

// Lögfræðisíður (/skilmalar, /personuvernd, /vafrakokur). Textinn kemur úr src/components/legal/*.
// Hann er aðeins til á íslensku; á ensku birtist ábending um það efst.
export default function AhLegal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="ah ah-legal">
      <SiteNav />
      <main className="ah-legal-main" lang="is">
        <LegalEnNote />
        <h1>{title}</h1>
        <p className="ah-legal-upd">Síðast uppfært {updated}. BGL Ventures ehf., kt. 490806-0400, hallo@vakto.is</p>
        <div className="ah-legal-body">{children}</div>
      </main>
      <AhFooter />
    </div>
  );
}
