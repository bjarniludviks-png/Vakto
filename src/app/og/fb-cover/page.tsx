import type { Metadata } from "next";
import "../../ny/ny.css";
import "../og.css";
import { Starfield } from "../../ny/ny-client";

// Facebook-forsíðumynd (1640×624) í sama stíl og hetjan á forsíðunni.
// Ekki í nav/sitemap; renderað í public/social með scripts/render-social.mjs.
export const metadata: Metadata = { title: "VAKTO — Facebook cover", robots: { index: false, follow: false } };

export default function FbCoverPage() {
  return (
    <div className="ny og og-cover">
      <div className="ny-aurora" aria-hidden="true">
        <Starfield layer={1} />
        <Starfield layer={2} />
        <i className="a1" /><i className="a2" /><i className="a3" />
        <span className="ny-rays r1" /><span className="ny-rays r2" /><span className="ny-rays r3" />
        <span className="ny-horizon" />
        <span className="ny-underglow" />
      </div>
      <div className="txt">
        <h1>Einfaldasta vaktakerfið.<br />Sem gerir meira.</h1>
        <span className="site">vakto.is</span>
      </div>
      <div className="shot"><img src="/showcase/2026/maelabord.jpg" alt="" /></div>
    </div>
  );
}
