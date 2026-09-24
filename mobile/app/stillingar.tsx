// Stillingar — tilkynningar, prófíll, lykilorð, um appið.
import React, { useEffect, useState } from "react";
import { tr, trf, useLang, setLang, LANGS } from "../src/lib/i18n";
import { View, Switch, Linking, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Bell, BellOff, UserRound, KeyRound, LifeBuoy, FileText } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { List, Row, IconBox, Muted, useToast, Txt, Seg } from "../src/components/ui";
import { colors, useTheme, setThemeMode } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { registerForPush, unregisterPush, pushEnabled } from "../src/lib/push";
import { getDnd, setDnd, dndLabel, onMuteChange } from "../src/lib/mute";
import { supabase } from "../src/lib/supabase";

export default function Stillingar() {
  const { mode, dark } = useTheme();
  const lang = useLang();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [push, setPush] = useState(false);
  const [dnd, setDndState] = useState<number | null>(null);
  useEffect(() => { pushEnabled().then(setPush); getDnd().then(setDndState); return onMuteChange(() => getDnd().then(setDndState)); }, []);
  async function mute(kind: "1h" | "morning" | "forever" | "off") {
    if (kind === "off") { await setDnd(null); toast("Kveikt á tilkynningum aftur"); return; }
    let until = Infinity;
    if (kind === "1h") until = Date.now() + 3600000;
    if (kind === "morning") { const d = new Date(); if (d.getHours() >= 8) d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); until = d.getTime(); }
    await setDnd(until);
    toast(trf("Tilkynningar þaggaðar {x}", dndLabel(until)));
  }

  async function togglePush(v: boolean) {
    if (!me) return;
    if (v) { const t = await registerForPush(me); setPush(!!t); if (!t) toast("Leyfðu tilkynningar í stillingum símans"); }
    else { await unregisterPush(); setPush(false); toast("Slökkt á push-tilkynningum"); }
  }
  async function resetPw() {
    if (!me?.email) { toast("Ekkert netfang skráð"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(me.email, { redirectTo: "https://www.vakto.is/nytt-lykilord" });
    toast(error ? error.message : trf("Póstur sendur á {x}", me.email));
  }

  return (
    <Screen title="Stillingar" back>
      <Muted style={{ paddingHorizontal: 2 }}>TILKYNNINGAR</Muted>
      <List>
        <Row icon={<IconBox tone="brand"><Bell color={colors.brandDeep} size={19} /></IconBox>} title="Push-tilkynningar" sub="Skilaboð, nýtt vaktaplan, svör við beiðnum" right={<Switch value={push} onValueChange={togglePush} trackColor={{ true: colors.good, false: colors.line }} thumbColor="#fff" />} last />
      </List>
      <Muted style={{ paddingHorizontal: 2 }}>EKKI TRUFLA</Muted>
      <List>
        {dnd ? (
          <Row icon={<IconBox tone="warn"><BellOff color={colors.warn} size={19} /></IconBox>} title={trf("Þaggað {x}", dndLabel(dnd))} sub="Engar push-tilkynningar á meðan" right={<Pressable onPress={() => mute("off")} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.brandSoft }}><Txt weight="bold" size={12.5} color={colors.brandDeep}>Kveikja</Txt></Pressable>} last />
        ) : (
          <>
            <Row icon={<IconBox><BellOff color={colors.ink2} size={19} /></IconBox>} title="Þagga í 1 klst" sub="Fyrir fund eða hvíld" chevron={false} onPress={() => mute("1h")} />
            <Row icon={<IconBox><BellOff color={colors.ink2} size={19} /></IconBox>} title="Þagga til morguns" sub="Kveikist aftur kl. 08:00" chevron={false} onPress={() => mute("morning")} />
            <Row icon={<IconBox><BellOff color={colors.ink2} size={19} /></IconBox>} title="Þagga þar til ég kveiki aftur" sub="Þú sérð samt ólesið í appinu" chevron={false} onPress={() => mute("forever")} last />
          </>
        )}
      </List>
      <Muted style={{ paddingHorizontal: 2 }}>TUNGUMÁL</Muted>
      <List>
        <View style={{ padding: 12 }}>
          <Seg value={lang} onChange={setLang} items={LANGS} />
        </View>
      </List>
      <Muted style={{ paddingHorizontal: 2 }}>ÚTLIT</Muted>
      <List>
        <View style={{ padding: 12, gap: 10 }}>
          <Seg value={mode} onChange={setThemeMode} items={[{ id: "system", label: "Fylgir símanum" }, { id: "light", label: "Ljóst" }, { id: "dark", label: "Dökkt" }]} />
          <Muted size={12}>{mode === "system" ? trf("Fylgir stillingu símans (núna {x}).", tr(dark ? "dökkt" : "ljóst")) : mode === "dark" ? "Dökkt þema alltaf." : "Ljóst þema alltaf."}</Muted>
        </View>
      </List>
      <Muted style={{ paddingHorizontal: 2 }}>AÐGANGUR</Muted>
      <List>
        <Row icon={<IconBox><UserRound color={colors.ink2} size={19} /></IconBox>} title="Prófíll" sub="Sími, netfang, bankareikningur, mynd" onPress={() => router.push("/profill")} />
        <Row icon={<IconBox><KeyRound color={colors.ink2} size={19} /></IconBox>} title="Breyta lykilorði" sub={me?.email ? trf("Sendir hlekk á {x}", me.email) : "Sendir hlekk í pósti"} onPress={resetPw} chevron={false} last />
      </List>
      <Muted style={{ paddingHorizontal: 2 }}>UM VAKTO</Muted>
      <List>
        <Row icon={<IconBox><LifeBuoy color={colors.ink2} size={19} /></IconBox>} title="Hjálp" sub="hjalp@vakto.is" onPress={() => Linking.openURL("mailto:hjalp@vakto.is")} chevron={false} />
        <Row icon={<IconBox><FileText color={colors.ink2} size={19} /></IconBox>} title="Persónuvernd og skilmálar" onPress={() => Linking.openURL("https://www.vakto.is/personuvernd")} chevron={false} last />
      </List>
      <View style={{ alignItems: "center", paddingTop: 8 }}><Txt size={11.5} color={colors.ink3}>VAKTO 1.0 · is.vakto.app</Txt></View>
    </Screen>
  );
}
