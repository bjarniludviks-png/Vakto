import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "VAKTO — Vaktaplan, mæting, laun og arðsemi á einum stað";

// Branded share card (og:image + twitter card).
export default function OgImage() {
  const bar = (h: number, c: string) => <div style={{ width: 34, height: h, background: c, borderRadius: 8 }} />;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 40 }}>
          {bar(46, "#f59331")}{bar(74, "#e9700f")}{bar(104, "#cf5f0c")}
          <div style={{ fontSize: 64, fontWeight: 800, color: "#e9700f", marginLeft: 16, letterSpacing: -2 }}>VAKTO</div>
        </div>
        <div style={{ fontSize: 60, fontWeight: 800, color: "#1a1a1f", lineHeight: 1.1, letterSpacing: -2, display: "flex" }}>
          Vaktaplan → mæting → laun → arðsemi.
        </div>
        <div style={{ fontSize: 30, color: "#5f6470", marginTop: 26, display: "flex" }}>
          Sjáðu laun sem hlutfall af veltu í rauntíma. Fyrir íslensk fyrirtæki.
        </div>
        <div style={{ position: "absolute", bottom: 54, right: 90, fontSize: 26, color: "#9296a6" }}>vakto.is</div>
      </div>
    ),
    size,
  );
}
