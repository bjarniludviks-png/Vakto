import React from "react";
import { Tabs } from "expo-router";
import { House, CalendarDays, MessageCircle, Newspaper, Menu } from "lucide-react-native";
import { colors, font } from "../../src/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Heim",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="vaktir"
        options={{
          title: "Vaktir",
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="spjall"
        options={{
          title: "Spjall",
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="frettir"
        options={{
          title: "Fréttir",
          tabBarIcon: ({ color, size }) => <Newspaper color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meira"
        options={{
          title: "Meira",
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
