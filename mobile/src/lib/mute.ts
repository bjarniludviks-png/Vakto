// Þöggun spjallrása — geymd í símanum (felur ólesið-merki og hljóð fyrir rásina).
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@vakto-muted";
let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

export async function getMuted(): Promise<Set<string>> {
  if (cache) return cache;
  try { cache = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]") as string[]); } catch { cache = new Set(); }
  return cache;
}
export async function isMuted(id: string): Promise<boolean> {
  return (await getMuted()).has(id);
}
export async function toggleMute(id: string): Promise<boolean> {
  const m = await getMuted();
  if (m.has(id)) m.delete(id); else m.add(id);
  await AsyncStorage.setItem(KEY, JSON.stringify([...m])).catch(() => {});
  listeners.forEach((l) => l());
  return m.has(id);
}
export function onMuteChange(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// Þagga allt (Ekki trufla) — tímastimpill (ms) þar til kveikt er aftur; null = ekki þaggað.
const DND_KEY = "@vakto-dnd";
let dndCache: number | null | undefined;
export async function getDnd(): Promise<number | null> {
  if (dndCache === undefined) {
    try { const v = await AsyncStorage.getItem(DND_KEY); dndCache = v ? Number(v) : null; } catch { dndCache = null; }
  }
  if (dndCache && dndCache !== Infinity && dndCache < Date.now()) { dndCache = null; AsyncStorage.removeItem(DND_KEY).catch(() => {}); }
  return dndCache ?? null;
}
export async function setDnd(until: number | null): Promise<void> {
  dndCache = until;
  if (until) await AsyncStorage.setItem(DND_KEY, String(until)).catch(() => {}); else await AsyncStorage.removeItem(DND_KEY).catch(() => {});
  listeners.forEach((l) => l());
}
export function dndLabel(until: number | null): string {
  if (!until) return "";
  if (until === Infinity) return "þar til þú kveikir aftur";
  const d = new Date(until);
  const today = new Date().toDateString() === d.toDateString();
  return `til ${today ? "" : "morguns "}kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
