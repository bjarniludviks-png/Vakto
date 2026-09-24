// Starfsmannaskírteini — einfalt kort (eins og frumgerðin) sem opnast með mynd
// og öllum upplýsingum; Wallet-hnappur eftir stýrikerfi.
import React, { useEffect, useState } from "react";
import { View, Pressable, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import Svg, { Rect } from "react-native-svg";
import { Wallet, ChevronRight } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Txt, Muted, Avatar, Sheet, KV, useToast } from "../src/components/ui";
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

const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "—");

export default function Skirteini() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [hired, setHired] = useState<string | null>(null);
  const [company, setCompany] = useState<{ name: string; kt: string | null }>({ name: "", kt: null });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!me) return;
    supabase.from("employees").select("clock_token, hire_date").eq("id", me.empId).maybeSingle().then(({ data }) => { setToken((data?.clock_token as string) ?? me.empId); setHired((data?.hire_date as string) ?? null); });
    supabase.from("companies").select("name, kennitala").eq("id", me.companyId).maybeSingle().then(({ data }) => setCompany({ name: (data?.name as string) ?? "", kt: (data?.kennitala as string) ?? null }));
  }, [me]);

  const nr = (token ?? me?.empId ?? "").slice(0, 8).toUpperCase();
  const ios = Platform.OS === "ios";
  const walletUrl = `https://www.vakto.is/api/wallet/${ios ? "apple" : "google"}`;

  return (
    <Screen title="Skírteini" back>
      {me ? (
        <Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ backgroundColor: "#111116", borderRadius: 22, padding: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
          <View style={{ position: "absolute", right: -60, bottom: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(233,112,15,.35)" }} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <Svg width={22} height={22} viewBox="0 0 28 28" fill="none">
              <Rect x="3" y="15" width="5.4" height="10" rx="1.6" fill={colors.brand2} />
              <Rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill={colors.brand} />
              <Rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill={colors.brandDeep} />
            </Svg>
            <Txt weight="bold" size={13} color="#fff" style={{ letterSpacing: 2, marginTop: 3 }}>VAKTO</Txt>
            <View style={{ flex: 1 }} />
            <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 5 }}><Qr seed={token ?? me.empId} size={64} /></View>
          </View>
          <Txt weight="bold" size={22} color="#fff" style={{ letterSpacing: -0.4, marginTop: 18 }}>{me.fullName}</Txt>
          <Txt size={13} color="rgba(255,255,255,.75)">{[me.title, me.department, company.name].filter(Boolean).join(" · ")}</Txt>
          <View style={{ flexDirection: "row", gap: 22, marginTop: 18, alignItems: "flex-end" }}>
            <View><Txt size={11} color="rgba(255,255,255,.6)">Kennitala</Txt><Txt weight="bold" size={13} color="#fff" style={{ fontVariant: ["tabular-nums"] }}>{me.kennitala ?? "—"}</Txt></View>
            <View><Txt size={11} color="rgba(255,255,255,.6)">Byrjaði</Txt><Txt weight="bold" size={13} color="#fff">{fmtDate(hired)}</Txt></View>
            <View><Txt size={11} color="rgba(255,255,255,.6)">Nr.</Txt><Txt weight="bold" size={13} color="#fff" style={{ fontVariant: ["tabular-nums"] }}>{nr}</Txt></View>
            <View style={{ flex: 1 }} />
            <ChevronRight color="rgba(255,255,255,.5)" size={18} />
          </View>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => Linking.openURL(walletUrl).catch(() => toast("Wallet-passinn er á leiðinni"))}
        style={({ pressed }) => ({ backgroundColor: "#000", borderRadius: 16, paddingVertical: 17, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#333", opacity: pressed ? 0.85 : 1 })}
      >
        <Wallet color="#fff" size={20} />
        <Txt weight="bold" size={16} color="#fff">{ios ? "Bæta í Apple Wallet" : "Bæta í Google Wallet"}</Txt>
      </Pressable>
      <Muted size={12.5} style={{ textAlign: "center", lineHeight: 18 }}>Ýttu á kortið til að sjá mynd og allar upplýsingar. QR-kóðann má skanna í kiosk-stimpilklukkunni. Wallet-passar opnast þegar vottorðin frá Apple og Google eru komin.</Muted>

      <Sheet open={open} onClose={() => setOpen(false)}>
        {me ? (
          <>
            <View style={{ alignItems: "center", gap: 10, paddingTop: 4 }}>
              {me.photoUrl ? <Image source={{ uri: me.photoUrl }} style={{ width: 132, height: 132, borderRadius: 66 }} contentFit="cover" /> : <Avatar name={me.fullName} size={132} color={me.avatarColor} />}
              <Txt weight="bold" size={24} style={{ letterSpacing: -0.5 }}>{me.fullName}</Txt>
              <Muted>{[me.title, me.department].filter(Boolean).join(" · ") || "Starfsmaður"}</Muted>
            </View>
            <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, paddingHorizontal: 16 }}>
              <KV k="Kennitala" v={me.kennitala ?? "—"} />
              <KV k="Vinnustaður" v={company.name || "—"} />
              {company.kt ? <KV k="Kennitala félags" v={company.kt} /> : null}
              <KV k="Staða" v={me.title ?? "—"} />
              <KV k="Deild" v={me.department ?? "—"} />
              <KV k="Byrjaði" v={fmtDate(hired)} />
              <KV k="Starfsmannanúmer" v={nr} />
              {me.phone ? <KV k="Sími" v={me.phone} /> : null}
              <KV k="Netfang" v={me.email ?? "—"} last />
            </View>
            <View style={{ alignItems: "center", paddingVertical: 6 }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 10 }}><Qr seed={token ?? me.empId} size={150} /></View>
              <Muted size={12} style={{ marginTop: 8 }}>Skanna í kiosk-stimpilklukku</Muted>
            </View>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
