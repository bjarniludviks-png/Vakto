// Chart primitives ported from the prototype (bars/stacked/paired). Pure, deterministic.
const comma = (n: number) => n.toString().replace(".", ",");

/** Labor% trend bars vs a target t (green ≤t, amber ≤t+3, red above). */
export function Bars({ vals, t, height = 170 }: { vals: number[]; t: number; height?: number }) {
  const max = Math.max(...vals, t) * 1.12;
  return (
    <div className="bars" style={{ height }}>
      {vals.map((v, i) => {
        const h = Math.round((v / max) * 100);
        const c = v <= t ? "var(--good)" : v <= t + 3 ? "var(--warn)" : "var(--bad)";
        return (
          <div className="b" key={i}>
            <span className="pc">{comma(v)}%</span>
            <div className="c" style={{ height: `${h}%`, background: c }} />
            <small>V{i + 1}</small>
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
          <div className="col" key={i} title={`${cols[i]} · samtals ${comma(+tot.toFixed(2))} m kr`}>
            <div className="stack" style={{ height: `${hh}%` }}>
              {d.map((v, j) => (
                <div
                  key={j}
                  className="seg"
                  title={segNames ? `${segNames[j]}: ${comma(+v.toFixed(2))} m kr` : undefined}
                  style={{ height: `${(v / tot) * 100}%`, background: segs[j], cursor: "pointer" }}
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

/** Paired bars (this period teal vs previous brand). */
export function Paired({ a, b, height = 180 }: { a: number[]; b: number[]; height?: number }) {
  const max = Math.max(...a, ...b) * 1.1;
  return (
    <div className="sbars" style={{ height }}>
      {a.map((v, i) => (
        <div className="col" key={i}>
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
            <div style={{ width: "32%", height: `${Math.round((v / max) * 100)}%`, background: "var(--teal)", borderRadius: "5px 5px 2px 2px" }} />
            <div style={{ width: "32%", height: `${Math.round((b[i] / max) * 100)}%`, background: "var(--brand)", borderRadius: "5px 5px 2px 2px" }} />
          </div>
          <small>V{i + 1}</small>
        </div>
      ))}
    </div>
  );
}
