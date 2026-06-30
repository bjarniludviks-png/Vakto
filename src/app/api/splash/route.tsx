import { ImageResponse } from "next/og";

// Read ?w & ?h per request (must stay dynamic so searchParams resolve).
export const dynamic = "force-dynamic";

// Branded iOS launch image — VAKTO logo on brand orange, sized per device.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const w = Math.min(2000, Math.max(320, Number(sp.get("w")) || 1170));
  const h = Math.min(3000, Math.max(480, Number(sp.get("h")) || 2532));
  const unit = Math.round(Math.min(w, h) * 0.07);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#e9700f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: unit }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: unit * 0.34 }}>
          <div style={{ width: unit * 0.6, height: unit * 1.15, background: "rgba(255,255,255,0.72)", borderRadius: unit * 0.22 }} />
          <div style={{ width: unit * 0.6, height: unit * 1.85, background: "rgba(255,255,255,0.88)", borderRadius: unit * 0.22 }} />
          <div style={{ width: unit * 0.6, height: unit * 2.55, background: "#ffffff", borderRadius: unit * 0.22 }} />
        </div>
        <div style={{ color: "#fff", fontSize: unit * 0.92, fontWeight: 800, letterSpacing: unit * 0.06 }}>VAKTO</div>
      </div>
    ),
    { width: w, height: h },
  );
}
