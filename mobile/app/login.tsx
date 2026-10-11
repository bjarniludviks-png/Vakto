// Innskráning — stutt vörumerkjahreyfing þegar appið opnast: súlurnar í merkinu rísa hver af
// annarri, merkið færist upp og innskráningarblaðið rennur inn að neðan. Virðir „Minnka hreyfingu“.
import React, { useEffect, useRef, useState } from "react";
import { tr } from "../src/lib/i18n";
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, Easing, AccessibilityInfo, Pressable, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Eye, EyeOff } from "lucide-react-native";
import { supabase, isSupabaseConfigured } from "../src/lib/supabase";
import { Txt, Btn, Muted } from "../src/components/ui";
import { colors, radius, font, useTheme } from "../src/theme";

const BARS = [{ h: 22, o: 0.7 }, { h: 35, o: 0.85 }, { h: 48, o: 1 }];
const OUT = Easing.bezier(0.23, 1, 0.32, 1);
const HERO = 250; // sýnileg hæð appelsínugula haussins þegar blaðið er komið upp

const inputStyle = () => ({
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.control,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
  fontFamily: font.regular,
  color: colors.ink,
  backgroundColor: colors.panel2,
} as const);

export default function Login() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  // hreyfigildi: súlur (0→1 hver), orðmerki, færsla merkis upp, blað, innihald blaðs
  const bars = useRef(BARS.map(() => new Animated.Value(0))).current;
  const word = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(0)).current;
  const rows = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (!live) return;
      const all = [...bars, word, lift, sheet, ...rows];
      if (reduce) { all.forEach((v) => v.setValue(1)); return; }
      const t = (v: Animated.Value, duration: number, delay = 0) => Animated.timing(v, { toValue: 1, duration, delay, easing: OUT, useNativeDriver: true });
      Animated.sequence([
        Animated.parallel([...bars.map((v, i) => t(v, 420, 120 + i * 110)), t(word, 380, 480)]),
        Animated.delay(260),
        Animated.parallel([t(lift, 560), t(sheet, 620, 40), ...rows.map((v, i) => t(v, 380, 260 + i * 70))]),
      ]).start();
    });
    return () => { live = false; };
  }, [bars, word, lift, sheet, rows]);

  async function signIn() {
    setError(null); setNote(null);
    if (!isSupabaseConfigured()) { setError("Tenging við VAKTO er ekki uppsett í þessari útgáfu."); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError("Innskráning tókst ekki — athugaðu netfang og lykilorð.");
    // Gate in _layout redirects on success.
  }

  async function forgot() {
    setError(null); setNote(null);
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) { setError("Sláðu inn netfangið þitt fyrst — þá sendum við þér hlekk."); return; }
    setSending(true);
    await supabase.auth.resetPasswordForEmail(addr, { redirectTo: "https://www.vakto.is/nytt-lykilord" }).catch(() => {});
    setSending(false);
    // Sama svar hvort sem netfangið er til eða ekki.
    setNote("Ef netfangið er skráð hjá VAKTO færðu póst með hlekk til að velja nýtt lykilorð.");
  }

  const logoStart = H / 2 - 70;             // miðja skjásins
  const logoEnd = insets.top + 54;          // efst í hausnum
  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand }}>
      <StatusBar style="light" />
      {/* mjúkir hringir í bakgrunni haussins */}
      <View pointerEvents="none" style={{ position: "absolute", top: -90, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(255,255,255,.10)" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: 110, left: -60, width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(0,0,0,.05)" }} />

      {/* merkið: byrjar á miðjum skjá, færist upp í hausinn */}
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: logoStart, alignItems: "center", transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, logoEnd - logoStart] }) }] }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7, height: 48 }}>
          {BARS.map((b, i) => (
            <Animated.View key={i} style={{ width: 13, height: b.h, borderRadius: 4, backgroundColor: "#fff", opacity: bars[i].interpolate({ inputRange: [0, 1], outputRange: [0, b.o] }), transformOrigin: "bottom", transform: [{ scaleY: bars[i].interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) }] }} />
          ))}
        </View>
        <Animated.View style={[{ alignItems: "center", marginTop: 14 }, rise(word)]}>
          <Txt weight="bold" size={30} color="#fff" style={{ letterSpacing: -0.6 }}>VAKTO</Txt>
          <Txt size={14} color="rgba(255,255,255,.88)" style={{ marginTop: 2 }}>Vaktir, tímar og laun á einum stað</Txt>
        </Animated.View>
      </Animated.View>

      {/* innskráningarblaðið rennur inn að neðan */}
      <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: HERO + insets.top, backgroundColor: colors.panel, borderTopLeftRadius: 30, borderTopRightRadius: 30, transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [H, 0] }) }] }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 28, paddingBottom: insets.bottom + 24, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View style={rise(rows[0])}>
              <Txt weight="bold" size={26} style={{ letterSpacing: -0.6 }}>Velkomin aftur</Txt>
              <Muted style={{ marginTop: 2 }}>Skráðu þig inn til að sjá vaktirnar þínar.</Muted>
            </Animated.View>

            <Animated.View style={[{ gap: 6 }, rise(rows[1])]}>
              <Txt weight="medium" size={13} color={colors.ink2}>Netfang</Txt>
              <TextInput style={inputStyle()} autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder={tr("netfang@fyrirtaeki.is")} placeholderTextColor={colors.ink3} returnKeyType="next" />
            </Animated.View>

            <Animated.View style={[{ gap: 6 }, rise(rows[2])]}>
              <Txt weight="medium" size={13} color={colors.ink2}>Lykilorð</Txt>
              <View>
                <TextInput style={[inputStyle(), { paddingRight: 48 }]} secureTextEntry={!show} autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.ink3} onSubmitEditing={signIn} returnKeyType="go" />
                <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityLabel={tr(show ? "Fela lykilorð" : "Sýna lykilorð")} style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 40, alignItems: "center", justifyContent: "center" }}>
                  {show ? <EyeOff color={colors.ink3} size={19} /> : <Eye color={colors.ink3} size={19} />}
                </Pressable>
              </View>
              <Pressable onPress={forgot} disabled={sending} hitSlop={8} style={({ pressed }) => ({ alignSelf: "flex-end", paddingVertical: 4, opacity: pressed || sending ? 0.5 : 1 })}>
                <Txt weight="semibold" size={13} color={colors.brandDeep}>{sending ? "Sendi…" : "Gleymdirðu lykilorðinu?"}</Txt>
              </Pressable>
            </Animated.View>

            <Animated.View style={[{ gap: 12 }, rise(rows[3])]}>
              {error ? <Txt color={colors.bad} size={13}>{error}</Txt> : null}
              {note ? <Txt color={colors.good} size={13}>{note}</Txt> : null}
              <Btn title="Skrá inn" size="lg" onPress={signIn} loading={busy} />
              <Muted size={12.5} style={{ textAlign: "center", lineHeight: 18, marginTop: 6 }}>
                Ertu ekki með aðgang? Vinnuveitandinn þinn býður þér í VAKTO og þú færð boð í tölvupósti.
              </Muted>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}
