// Starfsmannaskírteini — einfalt kort (eins og frumgerðin) sem opnast með mynd
// og öllum upplýsingum; Wallet-hnappur eftir stýrikerfi.
import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { View, Pressable, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import Svg, { Rect, Path, Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { Wallet, ChevronRight } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { VaktoLogo } from "../src/components/vakto-logo";
import { Txt, Muted, Avatar, Sheet, KV, useToast } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { supabase } from "../src/lib/supabase";

/** Raunverulegur QR-kóði með stimpillykli starfsmannsins (clock_token) — sami kóði og í Wallet-skírteininu,
 *  kiosk-stimpilklukkan les hann. (Áður var þetta aðeins mynstur til skrauts og ekki hægt að skanna.) */
function Qr({ seed, size = 76 }: { seed: string; size?: number }) {
  const m = useMemo(() => {
    try { return QRCode.create(seed, { errorCorrectionLevel: "M" }).modules; } catch { return null; }
  }, [seed]);
  if (!m) return <View style={{ width: size, height: size, backgroundColor: "#fff" }} />;
  const n = m.size, q = 2, c = size / (n + q * 2); // 2 eininga hljóðlátt svæði
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m.get(y, x)) d += `M${(x + q) * c},${(y + q) * c}h${c}v${c}h${-c}z`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#fff" />
      <Path d={d} fill="#0b0b0e" />
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
    supabase.from("employees").select("clock_token, hire_date").eq("id", me.empId).maybeSingle().then(({ data }) => { setToken((data?.clock_token as string) ?? null); setHired((data?.hire_date as string) ?? null); });
    supabase.from("companies").select("name, kennitala").eq("id", me.companyId).maybeSingle().then(({ data }) => setCompany({ name: (data?.name as string) ?? "", kt: (data?.kennitala as string) ?? null }));
  }, [me]);

  const nr = (token ?? me?.empId ?? "").slice(0, 8).toUpperCase();
  const ios = Platform.OS === "ios";

  return (
    <Screen title="Skírteini" back>
      {me ? (
        <Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ backgroundColor: "#111116", borderRadius: 22, padding: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
          <Svg pointerEvents="none" style={{ position: "absolute", right: -110, bottom: -130 }} width={360} height={360}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#e9700f" stopOpacity="0.75" />
                <Stop offset="0.45" stopColor="#e9700f" stopOpacity="0.28" />
                <Stop offset="1" stopColor="#e9700f" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={180} cy={180} r={180} fill="url(#glow)" />
          </Svg>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <VaktoLogo size={22} variant="on-dark" />
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

      {[ios ? "apple" : "google"].map((w) => (
        <Pressable
          key={w}
          onPress={async () => {
            const nafn = w === "apple" ? "Apple Wallet" : "Google Wallet";
            try {
              const { data } = await supabase.auth.getSession();
              const res = await fetch(`https://www.vakto.is/api/wallet/${w}`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
              const j = (await res.json().catch(() => ({}))) as { url?: string };
              if (res.ok && j.url) await Linking.openURL(j.url);
              else toast(res.status === 501 ? `${nafn} er væntanlegt` : `Tókst ekki að opna ${nafn}`);
            } catch { toast(`Tókst ekki að opna ${nafn}`); }
          }}
          style={({ pressed }) => ({ backgroundColor: w === "apple" ? "#000" : colors.panel, borderRadius: 16, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, borderWidth: 1, borderColor: w === "apple" ? "#333" : colors.line, opacity: pressed ? 0.85 : 1 })}
        >
          <Wallet color={w === "apple" ? "#fff" : colors.ink} size={20} />
          <Txt weight="bold" size={16} color={w === "apple" ? "#fff" : colors.ink}>{w === "apple" ? "Bæta í Apple Wallet" : "Bæta í Google Wallet"}</Txt>
        </Pressable>
      ))}
      <Muted size={12.5} style={{ textAlign: "center", lineHeight: 18 }}>Ýttu á kortið til að sjá mynd, allar upplýsingar og QR-kóðann í fullri stærð — hann má skanna í kiosk-stimpilklukkunni. Skírteinið má líka geyma í veskinu í símanum.</Muted>

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
