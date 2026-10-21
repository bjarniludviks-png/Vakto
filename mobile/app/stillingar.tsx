// Stillingar — tilkynningar, prófíll, lykilorð, um appið.
import React, { useEffect, useState } from "react";
import { tr, trf, useLang, setLang, LANGS } from "../src/lib/i18n";
import { View, Switch, Linking, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Bell, BellOff, UserRound, KeyRound, LifeBuoy, FileText, CalendarPlus, Ban, Trash2, Mail } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { List, Row, IconBox, Muted, useToast, Txt, Seg, Sheet, Btn } from "../src/components/ui";
import { colors, useTheme, setThemeMode } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { registerForPush, unregisterPush, pushEnabled } from "../src/lib/push";
import { getDnd, setDnd, dndLabel, onMuteChange } from "../src/lib/mute";
import { supabase } from "../src/lib/supabase";
import { blockedUsers, unblockAll } from "../src/lib/api/moderation";
import { myRole, requestAccountDeletion, markAccountDeleted, OWNER_DELETE_MSG, HELP_EMAIL } from "../src/lib/api/account";

export default function Stillingar() {
  const { mode, dark } = useTheme();
  const lang = useLang();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [push, setPush] = useState(false);
  const [dnd, setDndState] = useState<number | null>(null);
  useEffect(() => { pushEnabled().then(setPush); getDnd().then(setDndState); return onMuteChange(() => getDnd().then(setDndState)); }, []);
  // Áskrift að vöktum (ICS) — iOS/Android dagatalið sækir /api/cal/<leynitengill> reglulega.
  async function addCalendar() {
    const { data } = await supabase.from("employees").select("calendar_token").eq("id", me!.empId).maybeSingle();
    const token = data?.calendar_token as string | undefined;
    if (!token) { toast("Dagatalstengill er ekki tilbúinn — reyndu aftur síðar"); return; }
    const host = (process.env.EXPO_PUBLIC_API_URL ?? "https://www.vakto.is").replace(/^https?:\/\//, "").replace(/\/$/, "");
    Linking.openURL(`webcal://${host}/api/cal/${token}.ics`).catch(() => toast("Gat ekki opnað dagatalið"));
  }
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
  const [blockedN, setBlockedN] = useState(0);
  useEffect(() => { blockedUsers(true).then((b) => setBlockedN(b.size)).catch(() => {}); }, []);
  async function resetPw() {
    if (!me?.email) { toast("Ekkert netfang skráð"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(me.email, { redirectTo: "https://www.vakto.is/nytt-lykilord" });
    toast(error ? error.message : trf("Póstur sendur á {x}", me.email));
  }

  // Eyða aðgangi (Apple 5.1.1(v)): staðfestingarblað → vefþjónninn lokar aðganginum → útskráning.
  // Eigandi fyrirtækis fær í staðinn leiðbeiningar um að skrifa hjalp@ (fyrirtækið þarf að loka líka).
  const [delOpen, setDelOpen] = useState(false);
  const [delOwner, setDelOwner] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  async function openDelete() {
    setDelOwner((await myRole().catch(() => null)) === "owner");
    setDelOpen(true);
  }
  async function confirmDelete() {
    setDelBusy(true);
    const r = await requestAccountDeletion();
    if (!r.ok) {
      setDelBusy(false);
      if (r.owner) { setDelOwner(true); return; }
      toast(r.error ?? "Tókst ekki");
      return;
    }
    await unregisterPush().catch(() => {});
    markAccountDeleted();
    setDelOpen(false);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setDelBusy(false);
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
        <Row icon={<IconBox><KeyRound color={colors.ink2} size={19} /></IconBox>} title="Breyta lykilorði" sub={me?.email ? trf("Sendir hlekk á {x}", me.email) : "Sendir hlekk í pósti"} onPress={resetPw} chevron={false} last={blockedN === 0} />
        {blockedN > 0 ? <Row icon={<IconBox><Ban color={colors.ink2} size={19} /></IconBox>} title="Faldir notendur" sub={trf("{n} faldir — ýttu til að sýna alla aftur", blockedN)} chevron={false} last onPress={() => Alert.alert(tr("Sýna alla aftur?"), tr("Skilaboð og færslur frá þeim sem þú faldir birtast aftur."), [{ text: tr("Hætta við"), style: "cancel" }, { text: tr("Sýna aftur"), onPress: async () => { if (await unblockAll()) { setBlockedN(0); toast("Allir sýnilegir aftur"); } } }])} /> : null}
      </List>
      {me?.empId ? <>
        <Muted style={{ paddingHorizontal: 2 }}>DAGATAL</Muted>
        <List>
          <Row icon={<IconBox><CalendarPlus color={colors.ink2} size={19} /></IconBox>} title="Vaktir í dagatal símans" sub="Uppfærist sjálft þegar planið breytist" onPress={addCalendar} chevron={false} last />
        </List>
      </> : null}
      <Muted style={{ paddingHorizontal: 2 }}>UM VAKTO</Muted>
      <List>
        <Row icon={<IconBox><LifeBuoy color={colors.ink2} size={19} /></IconBox>} title="Hjálp" sub="hjalp@vakto.is" onPress={() => Linking.openURL("mailto:hjalp@vakto.is")} chevron={false} />
        <Row icon={<IconBox><FileText color={colors.ink2} size={19} /></IconBox>} title="Persónuvernd og skilmálar" onPress={() => Linking.openURL("https://www.vakto.is/personuvernd")} chevron={false} />
        <Row icon={<IconBox tone="bad"><Trash2 color={colors.bad} size={19} /></IconBox>} title="Eyða aðgangi" danger onPress={openDelete} chevron={false} last />
      </List>
      <Sheet open={delOpen} onClose={() => { if (!delBusy) setDelOpen(false); }} title="Eyða aðgangi" scroll={false}>
        {delOwner ? (
          <>
            <Txt size={14.5} color={colors.ink2} style={{ lineHeight: 21 }}>{OWNER_DELETE_MSG}</Txt>
            <Btn title={`Skrifa á ${HELP_EMAIL}`} icon={<Mail color="#fff" size={18} />} onPress={() => Linking.openURL(`mailto:${HELP_EMAIL}?subject=${encodeURIComponent("Eyða fyrirtæki og aðgangi")}`).catch(() => toast(HELP_EMAIL))} />
            <Btn title="Hætta við" variant="ghost" onPress={() => setDelOpen(false)} />
          </>
        ) : (
          <>
            <Txt size={14.5} color={colors.ink2} style={{ lineHeight: 21 }}>Aðganginum þínum verður lokað strax og þú skráð(ur) út.</Txt>
            <Txt size={14.5} color={colors.ink2} style={{ lineHeight: 21 }}>Persónuupplýsingum þínum er eytt innan 30 daga.</Txt>
            <Txt size={14.5} color={colors.ink2} style={{ lineHeight: 21 }}>Gögn sem vinnuveitandinn þarf lögum samkvæmt að geyma (t.d. launa- og tímaskráningar) eru geymd eins lengi og lög krefjast.</Txt>
            <Btn title="Eyða aðganginum mínum" variant="danger" icon={<Trash2 color={colors.bad} size={18} />} loading={delBusy} onPress={confirmDelete} />
            <Btn title="Hætta við" variant="ghost" disabled={delBusy} onPress={() => setDelOpen(false)} />
          </>
        )}
      </Sheet>
      <View style={{ alignItems: "center", paddingTop: 8 }}><Txt size={11.5} color={colors.ink3}>VAKTO 1.0 · is.vakto.app</Txt></View>
    </Screen>
  );
}
