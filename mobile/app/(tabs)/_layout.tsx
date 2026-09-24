import React, { useCallback, useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { House, CalendarDays, MessageCircle, Newspaper, UserRound } from "lucide-react-native";
import { colors, font, useTheme } from "../../src/theme";
import { tr } from "../../src/lib/i18n";
import { useMe } from "../../src/lib/me-context";
import { unreadCounts, subscribeChat } from "../../src/lib/api/chat";
import { getMuted, onMuteChange } from "../../src/lib/mute";
import { syncPushWithDnd } from "../../src/lib/push";

export default function TabLayout() {
  useTheme();
  const { me } = useMe();
  const [unread, setUnread] = useState(0);

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
    return () => { ch.unsubscribe(); clearInterval(t); off(); };
  }, [me, refresh]);

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
      <Tabs.Screen name="index" options={{ title: tr("Heim"), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="vaktir" options={{ title: tr("Vaktir"), tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="spjall" options={{ title: tr("Spjall"), tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />, tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="frettir" options={{ title: tr("Fréttir"), tabBarIcon: ({ color, size }) => <Newspaper color={color} size={size} /> }} />
      <Tabs.Screen name="meira" options={{ title: tr("Ég"), tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
