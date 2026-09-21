import Link from "next/link";
import "./legal.css";

// Dökk, hljóðlát umgjörð fyrir lögfræðisíðurnar (persónuvernd, skilmálar, vafrakökur).
export const LEGAL_LINKS = [
  ["/personuvernd", "Persónuvernd"],
  ["/skilmalar", "Skilmálar"],
  ["/vafrakokur", "Vafrakökur"],
] as const;

export default function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="lg">
      <header className="lg-top">
        <Link className="lg-logo" href="/">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" /><rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" /><rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" /></svg>
          VAKTO
        </Link>
        <nav>{LEGAL_LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
      </header>
      <main className="lg-main">
        <h1>{title}</h1>
        <p className="lg-upd">Síðast uppfært {updated} · VAKTO ehf. · <a href="mailto:hallo@vakto.is">hallo@vakto.is</a></p>
        {children}
      </main>
      <footer className="lg-foot">
        <span>© 2026 VAKTO ehf.</span>
        <Link href="/">vakto.is</Link>
        <a href="mailto:hallo@vakto.is">Hafa samband</a>
      </footer>
    </div>
  );
}
