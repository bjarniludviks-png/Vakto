import { ImageResponse } from "next/og";
import { vaktoLogoDataUri } from "@/components/brand/logo-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// VAKTO heimaskjás-íkon — þrílitu súlurnar á hvítum grunni (sama og app-íkonið í mobile/assets/icon.png).
export default function AppleIcon() {
  const m = Math.round(180 * 0.62); // 28-kassinn → súlurnar ná ~49% breiddar, eins og app-íkonið
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={vaktoLogoDataUri({ markOnly: true })} width={m} height={m} alt="" />
      </div>
    ),
    { ...size },
  );
}
