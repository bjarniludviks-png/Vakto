// Shown when a company's access has been suspended by the VAKTO admin.
export default function AdgangurLokadur() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f6", fontFamily: "'General Sans', system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 420, background: "#fff", borderRadius: 16, padding: "36px 34px", boxShadow: "0 1px 2px rgba(18,18,40,.04), 0 12px 30px -16px rgba(18,18,40,.14)", textAlign: "center" }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d8483a" strokeWidth="1.8" style={{ margin: "0 auto 14px", display: "block" }}>
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 10px", color: "#1a1a1f" }}>Aðgangur fyrirtækisins er lokaður</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#5f6470", margin: "0 0 18px" }}>
          Aðgangi fyrirtækisins þíns að VAKTO hefur verið lokað tímabundið.
          Hafðu samband við okkur til að opna hann aftur.
        </p>
        <a href="mailto:help@vakto.is" style={{ display: "inline-block", background: "#e9700f", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14.5, padding: "11px 22px", borderRadius: 10 }}>
          help@vakto.is
        </a>
        <p style={{ fontSize: 12, color: "#9296a6", marginTop: 16 }}>VAKTO · vakto.is</p>
      </div>
    </div>
  );
}
