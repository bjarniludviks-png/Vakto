// Shared VAKTO UI primitives — mirror the web prototype look (cards, pills, type scale).
import React from "react";
import {
  Text,
  TextProps,
  View,
  ViewProps,
  Pressable,
  PressableProps,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { colors, font, radius, cardShadow } from "../theme";

type Weight = "regular" | "medium" | "semibold" | "bold";

export function Txt({
  weight = "regular",
  color = colors.ink,
  size = 14,
  style,
  ...rest
}: TextProps & { weight?: Weight; color?: string; size?: number }) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: font[weight], color, fontSize: size }, style]}
    />
  );
}

export function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.panel,
          borderRadius: radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.line,
          padding: 16,
          ...cardShadow,
        },
        style,
      ]}
    />
  );
}

export function Btn({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  ...rest
}: PressableProps & {
  title: string;
  variant?: "primary" | "ghost" | "danger" | "good";
  loading?: boolean;
  style?: ViewProps["style"];
}) {
  const bg =
    variant === "primary"
      ? colors.brand
      : variant === "danger"
        ? colors.bad
        : variant === "good"
          ? colors.good
          : "transparent";
  const fg = variant === "ghost" ? colors.ink : "#fff";
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.control,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.line,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Txt weight="semibold" color={fg} size={15}>
          {title}
        </Txt>
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "brand";
}) {
  const map = {
    neutral: { bg: colors.line2, fg: colors.ink2 },
    good: { bg: colors.goodSoft, fg: colors.good },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    bad: { bg: colors.badSoft, fg: colors.bad },
    brand: { bg: colors.brandSoft, fg: colors.brandDeep },
  } as const;
  const { bg, fg } = map[tone];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <Txt weight="medium" color={fg} size={12}>
        {label}
      </Txt>
    </View>
  );
}

/** Avatar initials — first two letters of the FIRST name (Mína→MÍ), per brief. */
export function initials(name: string): string {
  const first = (name || "").trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  size = 38,
  bg = colors.brandSoft,
  fg = colors.brandDeep,
}: {
  name: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt weight="semibold" color={fg} size={size * 0.36}>
        {initials(name)}
      </Txt>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Txt weight="semibold" size={16} style={{ marginBottom: 10 }}>
      {children}
    </Txt>
  );
}

export function Muted({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
  return (
    <Txt color={colors.ink2} size={size}>
      {children}
    </Txt>
  );
}
