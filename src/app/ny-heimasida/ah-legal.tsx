import AhFooter, { AhLogo } from "./ah-footer";

// Lögfræðisíður í útliti nýju forsíðunnar. Textinn kemur úr src/components/legal/* (sami og á /skilmalar o.s.frv.).
export default function AhLegal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="ah ah-legal">
      <nav className="ah-nav sc">
        <a href="/ny-heimasida" aria-label="VAKTO forsíða"><AhLogo /></a>
        <div className="ah-nav-links">
          <a href="/ny-heimasida/personuvernd">Persónuvernd</a><a href="/ny-heimasida/skilmalar">Skilmálar</a><a href="/ny-heimasida/vafrakokur">Vafrakökur</a>
        </div>
        <div className="ah-nav-cta">
          <a href="/ny-heimasida/innskraning" className="ah-nav-in">Innskráning</a>
          <a href="/ny-heimasida/prufa" className="ah-btn ah-btn-sm">Prófa frítt</a>
        </div>
      </nav>
      <main className="ah-legal-main">
        <h1>{title}</h1>
        <p className="ah-legal-upd">Síðast uppfært {updated}. VAKTO ehf., kt. 490806-0400, hallo@vakto.is</p>
        <div className="ah-legal-body">{children}</div>
      </main>
      <AhFooter />
    </div>
  );
}
