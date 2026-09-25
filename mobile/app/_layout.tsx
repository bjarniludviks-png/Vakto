import React, { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { MeProvider } from "../src/lib/me-context";
import { ToastProvider } from "../src/components/ui";
import { colors, useTheme, loadThemeMode } from "../src/theme";
import { loadLang } from "../src/lib/i18n";
import { isManager } from "../src/lib/api/ops";

function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Stjórnendur lenda á mælaborðinu þegar appið opnast; starfsfólk á Heim.
  const landed = useRef(false);
  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) { landed.current = false; router.replace("/login"); return; }
    if (session && onLogin) { router.replace("/"); return; }
    if (session && !onLogin && !landed.current && segments.length <= 1) {
      landed.current = true;
      isManager().then((m) => { if (m) router.replace("/maelabord"); }).catch(() => {});
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const { dark } = useTheme();
  useEffect(() => { loadThemeMode(); loadLang(); }, []);
  const [fontsLoaded] = useFonts({
    "GeneralSans-Regular": require("../assets/fonts/GeneralSans-Regular.otf"),
    "GeneralSans-Medium": require("../assets/fonts/GeneralSans-Medium.otf"),
    "GeneralSans-Semibold": require("../assets/fonts/GeneralSans-Semibold.otf"),
    "GeneralSans-Bold": require("../assets/fonts/GeneralSans-Bold.otf"),
  });

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <Gate>
        <MeProvider>
          <ToastProvider>
            <StatusBar style={dark ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          </ToastProvider>
        </MeProvider>
      </Gate>
    </AuthProvider>
  );
}
