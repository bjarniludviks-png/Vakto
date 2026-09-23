// VAKTO design tokens — ported from src/app/globals.css (design source of truth)
// and the approved app prototype (2026-09-23). Light + dark palette; `colors`
// is a live view of the active palette (screens call useTheme() to re-render).
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LIGHT = {
  ink: "#1a1a1f", ink2: "#5f6470", ink3: "#9296a6",
  line: "#e6e6e9", line2: "#f0f0f2", bg: "#f4f4f6", panel: "#ffffff", panel2: "#f8f8fa",
  brand: "#e9700f", brand2: "#f59331", brandDeep: "#cf5f0c", brandSoft: "#fdeedd",
  good: "#1f9d6b", goodSoft: "#e5f5ee", warn: "#bf8f3a", warnSoft: "#fbf1dc", bad: "#d8483a", badSoft: "#fbe9e6",
  info: "#2f6fe4", infoSoft: "#e7eefc", teal: "#1f9e9e",
  bubbleThem: "#eeeef1",
};
export type Palette = typeof LIGHT;
const DARK: Palette = {
  ...LIGHT,
  ink: "#f2f2f5", ink2: "#a4a4b0", ink3: "#6f6f7b",
  line: "#26262e", line2: "#1d1d24", bg: "#0c0c10", panel: "#15151a", panel2: "#1b1b21",
  brandDeep: "#f59331", brandSoft: "#33200f",
  good: "#2fb47e", goodSoft: "#123527", warn: "#d4a24a", warnSoft: "#332a14", bad: "#e5604f", badSoft: "#3a1a16",
  info: "#5b8df0", infoSoft: "#15243f",
  bubbleThem: "#26262e",
};

export type ThemeMode = "system" | "light" | "dark";
const KEY = "@vakto-theme";
let mode: ThemeMode = "system";
let sys: "light" | "dark" = Appearance.getColorScheme() === "dark" ? "dark" : "light";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
Appearance.addChangeListener(({ colorScheme }) => { sys = colorScheme === "dark" ? "dark" : "light"; emit(); });

export const resolvedTheme = (): "light" | "dark" => (mode === "system" ? sys : mode);
const palette = () => (resolvedTheme() === "dark" ? DARK : LIGHT);

/** Live palette — reads the active theme on every property access. */
export const colors: Palette = new Proxy(LIGHT, { get: (_t, k) => palette()[k as keyof Palette] }) as Palette;

export function setThemeMode(m: ThemeMode) {
  mode = m;
  AsyncStorage.setItem(KEY, m).catch(() => {});
  emit();
}
export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const v = (await AsyncStorage.getItem(KEY)) as ThemeMode | null;
    if (v === "light" || v === "dark" || v === "system") { mode = v; emit(); }
  } catch { /* ignore */ }
  return mode;
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Subscribe a component to theme changes. Returns { mode, dark, colors }. */
export function useTheme() {
  const snap = useSyncExternalStore(subscribe, () => `${mode}:${sys}`, () => `${mode}:${sys}`);
  void snap;
  return { mode, dark: resolvedTheme() === "dark", colors };
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "brand" | "info";
export const tone: Record<Tone, { bg: string; fg: string }> = new Proxy({} as Record<Tone, { bg: string; fg: string }>, {
  get: (_t, k) => {
    const c = palette();
    const map: Record<Tone, { bg: string; fg: string }> = {
      neutral: { bg: c.line2, fg: c.ink2 }, good: { bg: c.goodSoft, fg: c.good }, warn: { bg: c.warnSoft, fg: c.warn },
      bad: { bg: c.badSoft, fg: c.bad }, brand: { bg: c.brandSoft, fg: c.brandDeep }, info: { bg: c.infoSoft, fg: c.info },
    };
    return map[k as Tone];
  },
});

// Deild → litur (fallback þegar deild/vaktategund hefur engan lit í grunninum).
const DEPT_FALLBACK = ["#2f6fe4", "#1f9d6b", "#b45cc9", "#bf8f3a", "#0891b2", "#e0533f", "#8b7bff"];
export function deptColor(name: string | null | undefined, explicit?: string | null): string {
  if (explicit) return explicit;
  if (!name) return colors.brand;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DEPT_FALLBACK[h % DEPT_FALLBACK.length];
}

export const font = {
  regular: "GeneralSans-Regular",
  medium: "GeneralSans-Medium",
  semibold: "GeneralSans-Semibold",
  bold: "GeneralSans-Bold",
} as const;

export const radius = { card: 18, control: 14, chip: 12, pill: 999 } as const;

export const cardShadow = {
  shadowColor: "#121228",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 2,
} as const;

export const brandShadow = {
  shadowColor: "#e9700f",
  shadowOpacity: 0.35,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
} as const;
