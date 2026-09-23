// Stillingar — tilkynningar, prófíll, lykilorð, um appið.
import React, { useEffect, useState } from "react";
import { View, Switch, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Bell, UserRound, KeyRound, LifeBuoy, FileText } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { List, Row, IconBox, Muted, useToast, Txt } from "../src/components/ui";
import { colors } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { registerForPush, unregisterPush, pushEnabled } from "../src/lib/push";
import { supabase } from "../src/lib/supabase";

export default function Stillingar() {
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [push, setPush] = useState(false);
  useEffect(() => { pushEnabled().then(setPush); }, []);

  async function togglePush(v: boolean) {
    if (!me) return;
    if (v) { const t = await registerForPush(me); setPush(!!t); if (!t) toast("Leyfðu tilkynningar í stillingum símans"); }
    else { await unregisterPush(); setPush(false); toast("Slökkt á push-tilkynningum"); }
  }
  async function resetPw() {
    if (!me?.email) { toast("Ekkert netfang skráð"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(me.email, { redirectTo: "https://www.vakto.is/nytt-lykilord" });
    toast(error ? error.message : `Póstur sendur á ${me.email}`);
  }

  return (
    <Screen title="Stillingar" back>
      <Muted style={{ paddingHorizontal: 2 }}>TILKYNNINGAR</Muted>
      <List>
        <Row icon={<IconBox tone="brand"><Bell color={colors.brandDeep} size={19} /></IconBox>} title="Push-tilkynningar" sub="Skilaboð, nýtt vaktaplan, svör við beiðnum" right={<Switch value={push} onValueChange={togglePush} trackColor={{ true: colors.good, false: colors.line }} thumbColor="#fff" />} last />
      </List>
      <Muted style={{ paddingHorizontal: 2 }}>AÐGANGUR</Muted>
      <List>
        <Row icon={<IconBox><UserRound color={colors.ink2} size={19} /></IconBox>} title="Prófíll" sub="Sími, netfang, bankareikningur, mynd" onPress={() => router.push("/profill")} />
        <Row icon={<IconBox><KeyRound color={colors.ink2} size={19} /></IconBox>} title="Breyta lykilorði" sub={me?.email ? `Sendir hlekk á ${me.email}` : "Sendir hlekk í pósti"} onPress={resetPw} chevron={false} last />
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
