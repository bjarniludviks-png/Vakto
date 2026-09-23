// VAKTO design tokens — ported from src/app/globals.css (design source of truth)
// and the approved app prototype (2026-09-23). Do not redesign.

export const colors = {
  // ink / neutral
  ink: "#1a1a1f",
  ink2: "#5f6470",
  ink3: "#9296a6",
  // lines / backgrounds
  line: "#e6e6e9",
  line2: "#f0f0f2",
  bg: "#f4f4f6",
  panel: "#ffffff",
  panel2: "#f8f8fa",
  // brand (orange)
  brand: "#e9700f",
  brand2: "#f59331",
  brandDeep: "#cf5f0c",
  brandSoft: "#fdeedd",
  // semantic
  good: "#1f9d6b",
  goodSoft: "#e5f5ee",
  warn: "#bf8f3a",
  warnSoft: "#fbf1dc",
  bad: "#d8483a",
  badSoft: "#fbe9e6",
  info: "#2f6fe4",
  infoSoft: "#e7eefc",
  teal: "#1f9e9e",
  // chat
  bubbleThem: "#eeeef1",
} as const;

export type Tone = "neutral" | "good" | "warn" | "bad" | "brand" | "info";
export const tone: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.line2, fg: colors.ink2 },
  good: { bg: colors.goodSoft, fg: colors.good },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  bad: { bg: colors.badSoft, fg: colors.bad },
  brand: { bg: colors.brandSoft, fg: colors.brandDeep },
  info: { bg: colors.infoSoft, fg: colors.info },
};

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

export const radius = {
  card: 18,
  control: 14,
  chip: 12,
  pill: 999,
} as const;

// Soft card shadow (RN approximation of --shadow-card)
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
