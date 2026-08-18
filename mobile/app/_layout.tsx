import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { MeProvider } from "../src/lib/me-context";
import { colors } from "../src/theme";

function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) router.replace("/login");
    if (session && onLogin) router.replace("/");
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
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </MeProvider>
      </Gate>
    </AuthProvider>
  );
}
