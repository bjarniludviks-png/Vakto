// Standard screen scaffold: safe area, header row (title + avatar), scrollable body.
import React from "react";
import { ScrollView, View, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { Txt, Avatar, Muted } from "./ui";
import { colors } from "../theme";
import { useMe } from "../lib/me-context";

export function Screen({
  title,
  subtitle,
  children,
  back,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 18,
          paddingVertical: 12,
          gap: 12,
        }}
      >
        {back ? (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft color={colors.ink} size={22} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Txt weight="bold" size={22}>
            {title}
          </Txt>
          {subtitle ? <Muted>{subtitle}</Muted> : null}
        </View>
        {!back && me ? <Avatar name={me.fullName} /> : null}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingTop: 4, gap: 14, paddingBottom: 40 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
