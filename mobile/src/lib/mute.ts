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
