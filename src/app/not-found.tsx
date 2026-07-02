import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center", background: "#f4f4f6", color: "#1a1a1f", fontFamily: "var(--font-sans, system-ui), sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
        <div style={{ width: 12, height: 16, background: "#f59331", borderRadius: 3 }} />
        <div style={{ width: 12, height: 26, background: "#e9700f", borderRadius: 3 }} />
        <div style={{ width: 12, height: 36, background: "#cf5f0c", borderRadius: 3 }} />
        <div style={{ fontSize: 24, fontWeight: 800, color: "#e9700f", marginLeft: 8, letterSpacing: -1 }}>VAKTO</div>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, margin: 0 }}>Síðan fannst ekki</h1>
      <p style={{ color: "#5f6470", fontSize: 15, maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
        Þessi slóð er ekki til eða hefur verið færð. Farðu aftur á mælaborðið eða forsíðuna.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Link href="/maelabord" style={{ background: "#e9700f", color: "#fff", fontWeight: 600, fontSize: 14, padding: "11px 20px", borderRadius: 10, textDecoration: "none" }}>Á mælaborðið</Link>
        <Link href="/" style={{ background: "#fff", color: "#1a1a1f", fontWeight: 600, fontSize: 14, padding: "11px 20px", borderRadius: 10, textDecoration: "none", border: "1px solid #e3e4e8" }}>Forsíða</Link>
      </div>
    </div>
  );
}
