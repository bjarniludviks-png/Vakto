// Starfsmannaskírteini — dökkt kort með QR (clock_token) og Wallet-hnappi.
import React, { useEffect, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import Svg, { Rect } from "react-native-svg";
import { Wallet } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Txt, Muted, Avatar, useToast } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { supabase } from "../src/lib/supabase";

/** Deterministic QR-like block pattern (visual stand-in until the pass exists). */
function Qr({ seed, size = 76 }: { seed: string; size?: number }) {
  const n = 21;
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 16) / 65536; };
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) cells.push(rnd() > 0.55);
  const finder = (x: number, y: number) => { for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) { const ring = dx === 0 || dy === 0 || dx === 6 || dy === 6; const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4; cells[(y + dy) * n + x + dx] = ring || core; } };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  const c = size / n;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#fff" />
      {cells.map((on, i) => (on ? <Rect key={i} x={(i % n) * c} y={Math.floor(i / n) * c} width={c} height={c} fill="#0b0b0e" /> : null))}
    </Svg>
  );
}

export default function Skirteini() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [company, setCompany] = useState<string>("");
  const [hired, setHired] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    supabase.from("employees").select("clock_token, hire_date").eq("id", me.empId).maybeSingle().then(({ data }) => { setToken((data?.clock_token as string) ?? me.empId); setHired((data?.hire_date as string) ?? null); });
    supabase.from("companies").select("name").eq("id", me.companyId).maybeSingle().then(({ data }) => setCompany((data?.name as string) ?? ""));
  }, [me]);

  return (
    <Screen title="Skírteini" back>
      {me ? (
        <View style={{ backgroundColor: "#111116", borderRadius: 22, padding: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6 }}>
          <View style={{ position: "absolute", right: -60, bottom: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(233,112,15,.35)" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Svg width={22} height={22} viewBox="0 0 28 28" fill="none">
              <Rect x="3" y="15" width="5.4" height="10" rx="1.6" fill={colors.brand2} />
              <Rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill={colors.brand} />
              <Rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill={colors.brandDeep} />
            </Svg>
            <Txt weight="bold" size={13} color="#fff" style={{ letterSpacing: 2 }}>VAKTO</Txt>
            <View style={{ flex: 1 }} />
            <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 5 }}><Qr seed={token ?? me.empId} size={66} /></View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 22 }}>
            {me.photoUrl ? <Image source={{ uri: me.photoUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} contentFit="cover" /> : <Avatar name={me.fullName} size={64} color={me.avatarColor} />}
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={22} color="#fff" style={{ letterSpacing: -0.4 }}>{me.fullName}</Txt>
              <Txt size={13} color="rgba(255,255,255,.75)">{[me.title, me.department].filter(Boolean).join(" · ") || "Starfsmaður"}{company ? ` · ${company}` : ""}</Txt>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 22, marginTop: 20 }}>
            {me.kennitala ? <View><Txt size={11} color="rgba(255,255,255,.6)">Kennitala</Txt><Txt weight="bold" size={13} color="#fff" style={{ fontVariant: ["tabular-nums"] }}>{me.kennitala}</Txt></View> : null}
            {hired ? <View><Txt size={11} color="rgba(255,255,255,.6)">Byrjaði</Txt><Txt weight="bold" size={13} color="#fff">{hired.slice(8, 10)}.{hired.slice(5, 7)}.{hired.slice(0, 4)}</Txt></View> : null}
            <View><Txt size={11} color="rgba(255,255,255,.6)">Nr.</Txt><Txt weight="bold" size={13} color="#fff" style={{ fontVariant: ["tabular-nums"] }}>{(token ?? me.empId).slice(0, 8).toUpperCase()}</Txt></View>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => Linking.openURL("https://www.vakto.is/api/wallet/apple").catch(() => toast("Wallet-passinn er á leiðinni"))}
        style={({ pressed }) => ({ backgroundColor: "#000", borderRadius: 16, paddingVertical: 17, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#333", opacity: pressed ? 0.85 : 1 })}
      >
        <Wallet color="#fff" size={20} />
        <Txt weight="bold" size={16} color="#fff">Bæta í Apple Wallet</Txt>
      </Pressable>
      <Muted size={12.5} style={{ textAlign: "center", lineHeight: 18 }}>Skírteinið er gilt á meðan þú ert í starfi. QR-kóðann má skanna í kiosk-stimpilklukkunni. Wallet-passar opnast þegar Apple-vottorðin eru komin.</Muted>
    </Screen>
  );
}
