import { ImageResponse } from "next/og";
import { LOGO_INK, vaktoLogoDataUri } from "@/components/brand/logo-svg";

// Read ?w & ?h per request (must stay dynamic so searchParams resolve).
export const dynamic = "force-dynamic";

// Branded iOS launch image — hvíta VAKTO-merkið á appelsínugulu, stærð eftir tæki.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const w = Math.min(2000, Math.max(320, Number(sp.get("w")) || 1170));
  const h = Math.min(3000, Math.max(480, Number(sp.get("h")) || 2532));
  // Hvíta merkið (súlur + orðmerki) á appelsínugulu, ~46% af skammhliðinni.
  const lw = Math.round(Math.min(w, h) * 0.46), lh = Math.round((lw * (LOGO_INK.y1 - LOGO_INK.y0)) / (LOGO_INK.x1 - LOGO_INK.x0));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#e9700f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) */}
        <img src={vaktoLogoDataUri({ crop: true, variant: "white" })} width={lw} height={lh} alt="VAKTO" />
      </div>
    ),
    { width: w, height: h },
  );
}
