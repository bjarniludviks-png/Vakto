// Litur á upphafsstafa-hring þegar starfsmaður hefur ekki valinn lit: fastur per manneskju
// (reiknaður úr auðkenninu) svo sami einstaklingur fær alltaf sama lit og nágrannar í lista greinast að.
export const AVATAR_PALETTE = ["#5b50e6", "#18a06a", "#e0533f", "#0891b2", "#ca8a04", "#9333ea", "#e11d48", "#1fb6a6", "#2563eb", "#c2410c", "#0f766e", "#db2777"];

export function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
