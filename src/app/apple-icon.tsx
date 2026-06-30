import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// VAKTO home-screen icon — white ascending bars on the brand orange.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#e9700f", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14, paddingBottom: 50 }}>
        <div style={{ width: 24, height: 46, background: "rgba(255,255,255,0.72)", borderRadius: 9 }} />
        <div style={{ width: 24, height: 74, background: "rgba(255,255,255,0.88)", borderRadius: 9 }} />
        <div style={{ width: 24, height: 102, background: "#ffffff", borderRadius: 9 }} />
      </div>
    ),
    { ...size },
  );
}
