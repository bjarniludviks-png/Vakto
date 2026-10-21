import React, { useEffect, useRef, useState } from "react";
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
import { supabase } from "../src/lib/supabase";
import { getAccessState, markAccessClosed, READONLY_ROUTES } from "../src/lib/api/access";
import { launchRoute, onPushTap } from "../src/lib/push";

function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Starfslok (0088): eftir síðasta dag aðeins skjöl/samningar; eftir lokun er lotunni hent út.
  // Grunnurinn framfylgir þessu sjálfur (RLS) — hér er bara réttur skjár valinn.
  const [access, setAccess] = useState<"active" | "readonly" | "closed" | null>(null);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setAccess(null); return; }
    let live = true;
    getAccessState().then((a) => {
      if (!live) return;
      if (a.state === "closed") { markAccessClosed(); supabase.auth.signOut().catch(() => {}); }
      setAccess(a.state);
    }).catch(() => live && setAccess("active"));
    return () => { live = false; };
  }, [uid]);

  // Stjórnendur lenda á mælaborðinu þegar appið opnast; starfsfólk á Heim.
  const landed = useRef(false);
  const pushed = useRef(false); // opnað úr push → ekki skipta yfir á mælaborðið
  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) { landed.current = false; router.replace("/login"); return; }
    if (session && access === null) return; // bíður eftir aðgangsstöðu
    if (session && access === "readonly") {
      if (!READONLY_ROUTES.includes(String(segments[0] ?? ""))) router.replace("/starfslok");
      return;
    }
    if (session && onLogin) { router.replace("/"); return; }
    if (session && !onLogin && !landed.current && segments.length <= 1) {
      landed.current = true;
      isManager().then((m) => { if (m && !pushed.current) router.replace("/maelabord"); }).catch(() => {});
    }
  }, [session, loading, segments, router, access]);

  // Smellt á push (t.d. samningur til undirritunar) → opna þann skjá, bæði við kaldræsingu og í gangi.
  const ready = !!session && access !== null && access !== "closed";
  useEffect(() => {
    if (!ready) return;
    const go = (url: string) => { pushed.current = true; router.push(url as never); };
    launchRoute().then((u) => { if (u) go(u); }).catch(() => {});
    return onPushTap(go);
  }, [ready, router]);

  if (loading || (session && access === null)) {
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
