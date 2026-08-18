import React, { useState } from "react";
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { supabase, isSupabaseConfigured } from "../src/lib/supabase";
import { Txt, Btn, Card, Muted } from "../src/components/ui";
import { colors, radius, font } from "../src/theme";

function Logo({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Rect x="3" y="15" width="5.4" height="10" rx="1.6" fill={colors.brand2} />
      <Rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill={colors.brand} />
      <Rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill={colors.brandDeep} />
    </Svg>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.control,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  fontFamily: font.regular,
  color: colors.ink,
  backgroundColor: colors.panel,
} as const;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError("Supabase er ekki stillt — vantar EXPO_PUBLIC_SUPABASE_* í .env");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) setError("Innskráning tókst ekki — athugaðu netfang og lykilorð.");
    // Gate in _layout redirects on success.
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Logo />
          <Txt weight="bold" size={26} style={{ marginTop: 12, letterSpacing: 1 }}>
            VAKTO
          </Txt>
          <Muted>Vaktir, tímar og laun — á einum stað</Muted>
        </View>

        <Card style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Txt weight="medium" size={13} color={colors.ink2}>
              Netfang
            </Txt>
            <TextInput
              style={inputStyle}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="netfang@fyrirtaeki.is"
              placeholderTextColor={colors.ink3}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Txt weight="medium" size={13} color={colors.ink2}>
              Lykilorð
            </Txt>
            <TextInput
              style={inputStyle}
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.ink3}
              onSubmitEditing={signIn}
            />
          </View>
          {error ? (
            <Txt color={colors.bad} size={13}>
              {error}
            </Txt>
          ) : null}
          <Btn title="Skrá inn" onPress={signIn} loading={busy} />
        </Card>

        <Muted size={12}>
          {"\n"}Aðgangur er stofnaður af stjórnanda fyrirtækisins í VAKTO.
        </Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
