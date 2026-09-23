// Standard screen scaffold: safe area, header (title + optional back + right
// actions), scrollable body with pull-to-refresh.
import React from "react";
import { ScrollView, View, RefreshControl, Pressable, StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Txt } from "./ui";
import { colors } from "../theme";

export function IconBtn({ children, onPress, label, badge }: { children: React.ReactNode; onPress?: () => void; label?: string; badge?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.panel2 : "transparent" })}
    >
      {children}
      {badge ? <View style={{ position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.bad, borderWidth: 2, borderColor: colors.panel }} /> : null}
    </Pressable>
  );
}

export function Header({
  title,
  subtitle,
  back,
  left,
  right,
  center,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  center?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ backgroundColor: colors.panel, paddingTop: insets.top + 6, paddingHorizontal: back ? 10 : 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
      {back ? (
        <IconBtn onPress={() => router.back()} label="Til baka">
          <ChevronLeft color={colors.ink} size={24} />
        </IconBtn>
      ) : left}
      <View style={{ flex: 1, minWidth: 0, alignItems: center ? "center" : "flex-start" }}>
        <Txt weight="bold" size={center ? 16 : 24} style={{ letterSpacing: -0.5 }} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt size={13} color={colors.ink2} numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (back ? <View style={{ width: 40 }} /> : null)}
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  children,
  back,
  left,
  right,
  center,
  refreshing,
  onRefresh,
  contentStyle,
  header,
  noScroll,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  center?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra header strip below the title row (segmented control, day strip…). */
  header?: React.ReactNode;
  noScroll?: boolean;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={title} subtitle={subtitle} back={back} left={left} right={right} center={center || !!back} />
      {header}
      {noScroll ? (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      ) : (
        <ScrollView
          contentContainerStyle={[{ padding: 16, gap: 14, paddingBottom: 40 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}
