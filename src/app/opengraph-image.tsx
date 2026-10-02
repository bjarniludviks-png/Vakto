import { ImageResponse } from "next/og";
import { regular, semibold } from "@/lib/fonts/general-sans";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "VAKTO: vaktaplan, stimpilklukka og laun á einum stað";

const font = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64")).buffer;

// Deilimynd (og:image + twitter) í útliti vakto.is: ljós grunnur, appelsínugulur bjarmi, fyrirsögn forsíðunnar.
export default function OgImage() {
  const bar = (h: number) => <div style={{ width: 20, height: h, background: "#e9700f", borderRadius: 5 }} />;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 84px",
        background: "radial-gradient(circle at 92% 0%, rgba(245,147,49,.55), rgba(253,227,200,.6) 34%, #fbfbfd 62%)", fontFamily: "General Sans", color: "#1d1d1f" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          {bar(28)}{bar(44)}{bar(60)}
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: 4, marginLeft: 16, lineHeight: 1 }}>VAKTO</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 82, fontWeight: 600, letterSpacing: -3, lineHeight: 1.02 }}>Vaktin, launin og yfirsýnin.</div>
          <div style={{ fontSize: 82, fontWeight: 600, letterSpacing: -3, lineHeight: 1.02, color: "#86868b" }}>Á einum stað.</div>
          <div style={{ fontSize: 30, color: "#4a4a4f", marginTop: 30 }}>Vaktaplan, stimpilklukka, laun og ráðningarsamningar. Laun sem % af veltu í rauntíma.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#6e6e73" }}>
          <span>vakto.is</span><span style={{ color: "#b85309", fontWeight: 600 }}>14 daga frí prufa</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "General Sans", data: font(regular), weight: 400 }, { name: "General Sans", data: font(semibold), weight: 600 }] },
  );
}
