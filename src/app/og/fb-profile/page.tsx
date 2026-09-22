import type { Metadata } from "next";
import "../../ny/ny.css";
import "../og.css";
import { Starfield } from "../../ny/ny-client";

// Facebook-prófílmynd (1080×1080): VAKTO-súlurnar á dökka bakgrunninum með ljóma.
export const metadata: Metadata = { title: "VAKTO — profile image", robots: { index: false, follow: false } };

export default function FbProfilePage() {
  return (
    <div className="ny og og-profile">
      <div className="ny-aurora" aria-hidden="true">
        <Starfield layer={1} />
        <Starfield layer={2} />
        <i className="a1" /><i className="a2" /><i className="a3" />
        <span className="ny-rays r1" /><span className="ny-rays r2" /><span className="ny-rays r3" />
        <span className="ny-underglow" />
      </div>
      <div className="mark">
        <svg width="460" height="460" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" />
          <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" />
          <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" />
        </svg>
      </div>
    </div>
  );
}
