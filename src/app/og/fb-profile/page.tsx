import type { Metadata } from "next";
import "../ny.css";
import "../og.css";
import { Starfield } from "../starfield";
import { VaktoMark } from "@/components/brand/vakto-logo";

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
        <VaktoMark size={460} />
      </div>
    </div>
  );
}
