import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { House, CalendarDays, MessageCircle, Newspaper, UserRound, Gauge } from "lucide-react-native";
import { colors, font, useTheme } from "../../src/theme";
import { tr } from "../../src/lib/i18n";
import { useMe } from "../../src/lib/me-context";
import { unreadCounts, subscribeChat } from "../../src/lib/api/chat";
import { getMuted, onMuteChange } from "../../src/lib/mute";
import { syncPushWithDnd } from "../../src/lib/push";
import { isManager } from "../../src/lib/api/ops";

export default function TabLayout() {
  useTheme();
  const { me } = useMe();
  const [unread, setUnread] = useState(0);
  const [manager, setManager] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!me) return;
    const [c, m] = await Promise.all([unreadCounts().catch(() => ({})), getMuted()]);
    setUnread(Object.entries(c).reduce((a, [id, n]) => a + (m.has(id) ? 0 : n), 0));
  }, [me]);

  useEffect(() => {
    refresh();
    if (!me) return;
    const ch = subscribeChat(() => refresh(), () => refresh());
    const t = setInterval(refresh, 30000);
    const off = onMuteChange(() => { refresh(); syncPushWithDnd(me).catch(() => {}); });
    syncPushWithDnd(me).catch(() => {});
    isManager().then(setManager).catch(() => setManager(false));
    return () => { ch.unsubscribe(); clearInterval(t); off(); };
  }, [me, refresh]);

  // iOS: kerfisvalmyndin (Liquid Glass á iOS 26). Hún tekur mest fimm flipa, svo
  // stjórnendur fá Mælaborð í stað Frétta — fréttaveitan er þá undir „Ég“.
  if (Platform.OS === "ios") {
    if (manager === null) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
    const T = NativeTabs.Trigger;
    return (
      <NativeTabs tintColor={colors.brand} badgeBackgroundColor={colors.bad} labelStyle={{ fontFamily: font.semibold, fontSize: 10.5 }}>
        <T name="maelabord" hidden={!manager}><T.Icon sf={{ default: "gauge.with.dots.needle.50percent", selected: "gauge.with.dots.needle.50percent" }} /><T.Label>{tr("Mælaborð")}</T.Label></T>
        <T name="index"><T.Icon sf={{ default: "house", selected: "house.fill" }} /><T.Label>{tr("Heim")}</T.Label></T>
        <T name="vaktir"><T.Icon sf="calendar" /><T.Label>{tr("Vaktir")}</T.Label></T>
        <T name="spjall"><T.Icon sf={{ default: "bubble.left", selected: "bubble.left.fill" }} /><T.Label>{tr("Spjall")}</T.Label>{unread > 0 ? <T.Badge>{String(unread)}</T.Badge> : null}</T>
        <T name="frettir" hidden={manager}><T.Icon sf={{ default: "newspaper", selected: "newspaper.fill" }} /><T.Label>{tr("Fréttir")}</T.Label></T>
        <T name="meira"><T.Icon sf={{ default: "person", selected: "person.fill" }} /><T.Label>{tr("Ég")}</T.Label></T>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line2, height: 84, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 10.5 },
        tabBarBadgeStyle: { backgroundColor: colors.bad, color: "#fff", fontFamily: font.bold, fontSize: 10.5, minWidth: 17, height: 17, lineHeight: 15 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="maelabord" options={{ title: tr("Mælaborð"), href: manager ? undefined : null, tabBarIcon: ({ color, size }) => <Gauge color={color} size={size} /> }} />
      <Tabs.Screen name="index" options={{ title: tr("Heim"), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="vaktir" options={{ title: tr("Vaktir"), tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="spjall" options={{ title: tr("Spjall"), tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />, tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="frettir" options={{ title: tr("Fréttir"), tabBarIcon: ({ color, size }) => <Newspaper color={color} size={size} /> }} />
      <Tabs.Screen name="meira" options={{ title: tr("Ég"), tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
