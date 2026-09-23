// Shared VAKTO UI primitives — mirror the approved app prototype (cards, rows,
// pills, sheet, segmented control, hero, toast).
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Text,
  TextProps,
  View,
  ViewProps,
  Pressable,
  PressableProps,
  ActivityIndicator,
  Modal,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { ChevronRight } from "lucide-react-native";
import { colors, font, radius, cardShadow, brandShadow, tone as toneMap, type Tone } from "../theme";

type Weight = "regular" | "medium" | "semibold" | "bold";

export function Txt({
  weight = "regular",
  color = colors.ink,
  size = 14,
  style,
  ...rest
}: TextProps & { weight?: Weight; color?: string; size?: number }) {
  return <Text {...rest} style={[{ fontFamily: font[weight], color, fontSize: size }, style]} />;
}

export function Muted({ children, size = 13, style }: { children: React.ReactNode; size?: number; style?: TextProps["style"] }) {
  return (
    <Txt color={colors.ink2} size={size} style={style}>
      {children}
    </Txt>
  );
}

export function Eyebrow({ children, color = colors.ink3 }: { children: React.ReactNode; color?: string }) {
  return (
    <Txt weight="bold" size={11} color={color} style={{ letterSpacing: 0.9, textTransform: "uppercase" }}>
      {children}
    </Txt>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Txt weight="bold" size={16} style={{ letterSpacing: -0.2 }}>
      {children}
    </Txt>
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
          borderWidth: 1,
          borderColor: colors.line2,
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
  icon,
  size = "md",
  ...rest
}: PressableProps & {
  title: string;
  variant?: "primary" | "ghost" | "danger" | "good" | "soft";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const bg =
    variant === "primary" ? colors.brand
    : variant === "danger" ? colors.badSoft
    : variant === "good" ? colors.good
    : variant === "soft" ? colors.brandSoft
    : colors.panel2;
  const fg = variant === "ghost" ? colors.ink : variant === "danger" ? colors.bad : variant === "soft" ? colors.brandDeep : "#fff";
  const pad = size === "sm" ? { paddingVertical: 9, paddingHorizontal: 14 } : size === "lg" ? { paddingVertical: 17, paddingHorizontal: 18 } : { paddingVertical: 14, paddingHorizontal: 18 };
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: size === "sm" ? 11 : size === "lg" ? 16 : radius.control,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.line,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...pad,
          ...(variant === "primary" ? brandShadow : {}),
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon}
          <Txt weight="bold" color={fg} size={size === "sm" ? 13 : size === "lg" ? 17 : 15}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const { bg, fg } = toneMap[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Txt weight="bold" color={fg} size={11.5}>
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

const AV_COLORS = ["#e9700f", "#1f9d6b", "#2f6fe4", "#b45cc9", "#bf8f3a", "#0891b2", "#e0533f", "#8b7bff", "#16a34a", "#ca8a04"];
export function colorFor(name: string): string {
  let h = 0;
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function Avatar({
  name,
  size = 36,
  color,
  photo,
  ring,
}: {
  name: string;
  size?: number;
  color?: string | null;
  photo?: string | null;
  ring?: boolean;
}) {
  const bg = color || colorFor(name);
  const inner = photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Txt weight="bold" color="#fff" size={Math.round(size * 0.34)}>
        {initials(name)}
      </Txt>
    </View>
  );
  if (!ring) return inner;
  return <View style={{ borderWidth: 2, borderColor: colors.panel, borderRadius: size / 2 + 2 }}>{inner}</View>;
}

export function AvatarStack({ people, size = 26 }: { people: { name: string; color?: string | null; photo?: string | null }[]; size?: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {people.slice(0, 4).map((p, i) => (
        <View key={i} style={{ marginLeft: i ? -8 : 0 }}>
          <Avatar name={p.name} size={size} color={p.color} photo={p.photo} ring />
        </View>
      ))}
    </View>
  );
}

/** Rounded icon box used at the start of list rows. */
export function IconBox({ children, tone = "neutral", size = 38 }: { children: React.ReactNode; tone?: Tone; size?: number }) {
  const { bg } = toneMap[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}
export const iconColor = (t: Tone) => toneMap[t].fg;

/** Grouped list container + rows (Ég-flipinn, stillingar, skjöl…). */
export function List({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.panel, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}

export function Row({
  icon,
  title,
  sub,
  right,
  onPress,
  danger,
  last,
  chevron = true,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  chevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line2,
        backgroundColor: pressed ? colors.panel2 : "transparent",
      })}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="bold" size={14.5} color={danger ? colors.bad : colors.ink} numberOfLines={1}>
          {title}
        </Txt>
        {sub ? (
          <Txt size={12.5} color={colors.ink2} style={{ marginTop: 1 }} numberOfLines={2}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress && chevron && !right ? <ChevronRight color={colors.ink3} size={18} /> : null}
    </Pressable>
  );
}

/** Segmented control. */
export function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.panel2, borderRadius: 12, padding: 3, gap: 2 }}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            style={{
              flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10,
              backgroundColor: on ? colors.panel : "transparent",
              ...(on ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : {}),
            }}
          >
            <Txt weight="bold" size={13} color={on ? colors.ink : colors.ink2}>
              {it.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line2 }} />;
}

/** Key/value line inside a card. */
export function KV({ k, v, last }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line2 }}>
      <Txt size={13} weight="semibold" color={colors.ink2}>
        {k}
      </Txt>
      {typeof v === "string" ? (
        <Txt size={14.5} weight="bold" style={{ textAlign: "right", flexShrink: 1 }}>
          {v}
        </Txt>
      ) : (
        v
      )}
    </View>
  );
}

/** Bottom sheet (Modal) with drag handle. */
export function Sheet({
  open,
  onClose,
  children,
  title,
  scroll = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  scroll?: boolean;
}) {
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)" }} onPress={onClose} />
        <View style={{ backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", paddingBottom: 30 }}>
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: "center", marginTop: 10, marginBottom: 6 }} />
          <Body contentContainerStyle={{ padding: 18, paddingTop: 6, gap: 14 }} style={scroll ? undefined : { padding: 18, paddingTop: 6, gap: 14 }} keyboardShouldPersistTaps="handled">
            {title ? (
              <Txt weight="bold" size={18} style={{ letterSpacing: -0.3 }}>
                {title}
              </Txt>
            ) : null}
            {children}
          </Body>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Progress bar 0–1. */
export function Bar({ value, color }: { value: number; color?: string }) {
  const w = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(w * 100)}%`, height: "100%", borderRadius: 4, backgroundColor: color ?? colors.brand }} />
    </View>
  );
}

export function Empty({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 20, gap: 6 }}>
      {icon ? (
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>{icon}</View>
      ) : null}
      <Txt weight="bold" size={15}>
        {title}
      </Txt>
      {sub ? (
        <Txt size={13} color={colors.ink2} style={{ textAlign: "center" }}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMsg(null)), 2300);
    },
    [op]
  );
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 20, right: 20, bottom: 96, alignItems: "center", opacity: op }}>
          <View style={{ backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, maxWidth: "100%" }}>
            <Txt weight="semibold" size={13.5} color="#fff" style={{ textAlign: "center" }}>
              {msg}
            </Txt>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
export function useToast() {
  return useContext(ToastCtx);
}
