// VAKTO-merkið í appinu — sama merki og í hliðarstiku vefkerfisins (src/components/brand/vakto-logo.tsx):
// 26px súlukassi, 9px bil, „VAKTO“ í General Sans Bold sem útlína (logo-geometry.ts er búið til af
// scripts/brand/generate-logo.mts í rót verkefnisins — ekki breyta með höndum).
import React from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { LOGO_BOX, LOGO_GAP, WORDMARK_D, WORDMARK_WIDTH } from "./logo-geometry";

export const MARK_BARS = [
  { x: 3, y: 15, w: 5.4, h: 10, rx: 1.6 },
  { x: 11.3, y: 9, w: 5.4, h: 16, rx: 1.6 },
  { x: 19.6, y: 3, w: 5.4, h: 22, rx: 1.6 },
] as const;
const TONES = ["#f59331", "#e9700f", "#cf5f0c"] as const;
/** Hvíta útgáfan (á appelsínugulu): súlurnar í þremur ógagnsæisþrepum. */
export const WHITE_BAR_OPACITY = [0.7, 0.85, 1] as const;

/** default = þrílitar súlur + dökkt orðmerki · on-dark = þrílitar + hvítt orðmerki · white = allt hvítt */
export type LogoVariant = "default" | "on-dark" | "white";

export function VaktoMark({ size = 26, variant = "default" }: { size?: number; variant?: LogoVariant }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {MARK_BARS.map((b, i) => (
        <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx}
          fill={variant === "white" ? "#fff" : TONES[i]} fillOpacity={variant === "white" ? WHITE_BAR_OPACITY[i] : 1} />
      ))}
    </Svg>
  );
}

/** Orðmerkið eitt; `size` = hæð súlukassans sem það á við (breidd fylgir). */
export function VaktoWordmark({ size = 26, color = "#1a1a1f" }: { size?: number; color?: string }) {
  const s = size / LOGO_BOX;
  return (
    <Svg width={WORDMARK_WIDTH * s} height={size} viewBox={`0 0 ${WORDMARK_WIDTH} ${LOGO_BOX}`}>
      <Path d={WORDMARK_D} fill={color} />
    </Svg>
  );
}

export const logoWidth = (size: number) => ((LOGO_BOX + LOGO_GAP + WORDMARK_WIDTH) * size) / LOGO_BOX;
export const logoGap = (size: number) => (LOGO_GAP * size) / LOGO_BOX;

export function VaktoLogo({ size = 26, variant = "default", ink, style }: { size?: number; variant?: LogoVariant; ink?: string; style?: ViewStyle }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="VAKTO" style={[{ flexDirection: "row", alignItems: "center" }, style]}>
      <VaktoMark size={size} variant={variant} />
      <View style={{ marginLeft: logoGap(size) }}>
        <VaktoWordmark size={size} color={ink ?? (variant === "default" ? "#1a1a1f" : "#fff")} />
      </View>
    </View>
  );
}
