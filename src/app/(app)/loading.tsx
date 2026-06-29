// Shown instantly on navigation while the next screen's data loads —
// removes the "blank wait" between tabs.
export default function Loading() {
  return (
    <div style={{ padding: "4px 2px" }}>
      <div className="sk-line" style={{ width: 180, height: 26, marginBottom: 10 }} />
      <div className="sk-line" style={{ width: 240, height: 14, marginBottom: 22 }} />
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div className="kpi" key={i}><div className="sk-line" style={{ width: "60%", height: 12, marginBottom: 12 }} /><div className="sk-line" style={{ width: "45%", height: 24 }} /></div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 20 }}>
        <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <div className="sk-line" key={i} style={{ width: `${90 - i * 8}%`, height: 16 }} />)}
        </div>
      </div>
    </div>
  );
}
