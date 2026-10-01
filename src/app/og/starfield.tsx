// Stjörnuhiminn úr gömlu miðnætursólar-forsíðunni — notaður af /og/fb-cover og /og/fb-profile (Facebook-myndir).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Starfield({ layer }: { layer: 1 | 2 }) {
  const rnd = mulberry32(layer === 1 ? 0x5747a1 : 0x36c9d3);
  const cols = 16, rows = 9, cw = 1600 / cols, ch = 900 / rows;
  const colors = ["255,255,255", "255,244,230", "214,228,255"];
  const stars = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const keep = rnd() < (layer === 1 ? 0.62 : 0.5);
      const x = gx * cw + cw * (0.08 + rnd() * 0.84);
      const y = gy * ch + ch * (0.08 + rnd() * 0.84);
      const r = 0.5 + rnd() * (layer === 1 ? 1.0 : 0.8);
      const c = colors[Math.floor(rnd() * colors.length)];
      const o = 0.35 + rnd() * 0.55;
      if (!keep) continue;
      stars.push(<circle key={`${gx}-${gy}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)} fill={`rgba(${c},${o.toFixed(2)})`} />);
    }
  }
  return (
    <svg className={`ny-stars s${layer}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {stars}
    </svg>
  );
}
