// VAKTO design tokens — ported from src/app/globals.css (design source of truth).
// Do not redesign: same ink/line/brand/semantic palette, General Sans, 14px card radius.

export const colors = {
  // ink / neutral
  ink: "#1a1a1f",
  ink2: "#5f6470",
  ink3: "#9296a6",
  // lines / backgrounds
  line: "#e6e6e9",
  line2: "#f3f3f5",
  bg: "#f4f4f6",
  panel: "#ffffff",
  // brand (orange)
  brand: "#e9700f",
  brand2: "#f59331",
  brandDeep: "#cf5f0c",
  brandSoft: "#fdf1e6",
  // semantic
  good: "#1f9d6b",
  goodSoft: "#e8f5ef",
  warn: "#bf8f3a",
  warnSoft: "#f5efe1",
  bad: "#d8483a",
  badSoft: "#fbe9e6",
  teal: "#1f9e9e",
} as const;

export const font = {
  regular: "GeneralSans-Regular",
  medium: "GeneralSans-Medium",
  semibold: "GeneralSans-Semibold",
  bold: "GeneralSans-Bold",
} as const;

export const radius = {
  card: 14,
  control: 10,
  pill: 999,
} as const;

// Soft card shadow (matches --shadow-card airiness; RN approximation)
export const cardShadow = {
  shadowColor: "#121228",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;
