// Chart primitives ported from the prototype (bars/stacked/paired). Pure, deterministic.
// Hover a bar/column for a .ctip tooltip with the exact numbers.
const comma = (n: number) => n.toString().replace(".", ",");

/** Labor% trend bars vs a target t (green ≤t, amber ≤t+3, red above).
 * labels default to V1..Vn; tips can add detail lines per bar. */
export function Bars({ vals, t, height = 170, labels, tips }: { vals: number[]; t: number; height?: number; labels?: string[]; tips?: string[] }) {
  const max = Math.max(...vals, t) * 1.12;
  return (
    <div className="bars" style={{ height }}>
      {vals.map((v, i) => {
        const h = Math.round((v / max) * 100);
        const c = v <= t ? "var(--good)" : v <= t + 3 ? "var(--warn)" : "var(--bad)";
        const lab = labels?.[i] ?? `V${i + 1}`;
        return (
          <div className="b" key={i}>
            <span className="ctip">{tips?.[i] ?? `${lab} · ${comma(v)}% (markmið ${comma(t)}%)`}</span>
            <span className="pc">{comma(v)}%</span>
            <div className="c" style={{ height: `${h}%`, background: c }} />
            <small>{lab}</small>
          </div>
        );
      })}
    </div>
  );
}

/** Stacked bars (e.g. payroll breakdown by month). */
export function Stacked({
  data, cols, segs, segNames, height = 240,
}: {
  data: number[][]; cols: string[]; segs: string[]; segNames?: string[]; height?: number;
}) {
  const max = Math.max(...data.map((d) => d.reduce((a, b) => a + b, 0))) * 1.1;
  return (
    <div className="sbars" style={{ height }}>
      {data.map((d, i) => {
        const tot = d.reduce((a, b) => a + b, 0);
        const hh = Math.round((tot / max) * 100);
        return (
          <div className="col" key={i}>
            <span className="ctip">
              {cols[i]} · {comma(+tot.toFixed(2))} m kr
              {segNames && d.map((v, j) => <span key={j}><br />{segNames[j]}: {comma(+v.toFixed(2))} m</span>)}
            </span>
            <div className="stack" style={{ height: `${hh}%` }}>
              {d.map((v, j) => (
                <div
                  key={j}
                  className="seg"
                  style={{ height: `${(v / tot) * 100}%`, background: segs[j] }}
                />
              ))}
            </div>
            <small>{cols[i]}</small>
          </div>
        );
      })}
    </div>
  );
}

/** Paired bars (this period teal vs previous brand). aName/bName label the tooltip;
 * unit is appended to values (default "m kr"). */
export function Paired({ a, b, height = 180, labels, aName = "Þetta tímabil", bName = "Fyrra tímabil", unit = "m kr" }: { a: number[]; b: number[]; height?: number; labels?: string[]; aName?: string; bName?: string; unit?: string }) {
  const max = Math.max(...a, ...b) * 1.1;
  return (
    <div className="sbars" style={{ height }}>
      {a.map((v, i) => {
        const lab = labels?.[i] ?? `V${i + 1}`;
        return (
          <div className="col" key={i}>
            <span className="ctip">{lab}<br />{aName}: {comma(+v.toFixed(2))} {unit}<br />{bName}: {comma(+b[i].toFixed(2))} {unit}</span>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
              <div style={{ width: "32%", height: `${Math.round((v / max) * 100)}%`, background: "var(--teal)", borderRadius: "5px 5px 2px 2px" }} />
              <div style={{ width: "32%", height: `${Math.round((b[i] / max) * 100)}%`, background: "var(--brand)", borderRadius: "5px 5px 2px 2px" }} />
            </div>
            <small>{lab}</small>
          </div>
        );
      })}
    </div>
  );
}
