// Sama litapalletta og reikningur og á vefnum (src/lib/avatar.ts) svo hver manneskja fær sama lit alls staðar.
const AV_COLORS = ["#5b50e6", "#18a06a", "#e0533f", "#0891b2", "#ca8a04", "#9333ea", "#e11d48", "#1fb6a6", "#2563eb", "#c2410c", "#0f766e", "#db2777"];
export function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < (key || "").length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
