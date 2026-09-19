// "1 klst síðan" — relative timestamps for the feed and chat, Icelandic.
// Pure function of (iso, now) so the caller decides when to re-render.
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "núna";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} mín síðan`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "1 klst síðan" : `${h} klst síðan`;
  const d = Math.round(h / 24);
  if (d === 1) return "í gær";
  if (d < 7) return `${d} dögum síðan`;
  const w = Math.round(d / 7);
  if (w < 5) return w === 1 ? "1 viku síðan" : `${w} vikum síðan`;
  const dt = new Date(t);
  return `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}`;
}
