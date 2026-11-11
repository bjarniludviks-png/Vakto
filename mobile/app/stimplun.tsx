// Sjálfvirk stimplun (0112) — starfsmaður kveikir/slekkur sjálfur og fer yfir tillögur
// (staðfesta, hafna eða stytta tímann). Staðsetning er aðeins notuð við komu og brottför.
import React, { useCallback, useState } from "react";
import { View, Switch, Linking, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { MapPin, ShieldCheck, LogIn, LogOut, TriangleAlert, Clock } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Btn, List, Row, IconBox, Sheet, Empty, useToast } from "../src/components/ui";
import { colors, font, useTheme } from "../src/theme";
import { tr, trf } from "../src/lib/i18n";
import { backgroundAllowed, decideSuggestion, disableAutoPunch, enableAutoPunch, getAutoPunch, type AutoPunchState, type Suggestion } from "../src/lib/autopunch";

const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
const dm = (iso: string) => { const d = new Date(iso); return `${d.getDate()}.${d.getMonth() + 1}.`; };
const inputStyle = { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 22, fontFamily: font.semibold, color: colors.ink } as const;

export default function Stimplun() {
  useTheme();
  const toast = useToast();
  const [s, setS] = useState<AutoPunchState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bgOk, setBgOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState(false);
  const [edit, setEdit] = useState<Suggestion | null>(null);

  const load = useCallback(async () => {
    const st = await getAutoPunch();
    setS(st);
    setBgOk(await backgroundAllowed());
    setLoaded(true);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function turnOn() {
    setIntro(false);
    setBusy(true);
    const r = await enableAutoPunch();
    setBusy(false);
    if (r === "ok") toast("Kveikt á sjálfvirkri stimplun");
    else if (r === "denied_foreground" || r === "denied_background") toast("Leyfðu staðsetningu „Alltaf“ í stillingum símans");
    else if (r === "unsupported") toast("Virkar aðeins í símaappinu");
    else toast("Tókst ekki — reyndu aftur");
    await load();
  }
  async function turnOff() {
    setBusy(true);
    const ok = await disableAutoPunch();
    setBusy(false);
    toast(ok ? "Slökkt á sjálfvirkri stimplun" : "Tókst ekki — reyndu aftur");
    await load();
  }
  async function decide(sg: Suggestion, confirm: boolean, at?: string) {
    setBusy(true);
    const r = await decideSuggestion(sg.id, confirm, at);
    setBusy(false);
    if (!r.ok) { toast(tr(r.error ?? "Tókst ekki")); await load(); return; }
    toast(confirm ? (sg.kind === "in" ? "Innstimplun staðfest" : "Útstimplun staðfest") : "Tillögu hafnað");
    setEdit(null);
    await load();
  }

  const on = !!s?.consent;
  const modeText = s?.mode === "auto"
    ? "Þú stimplast inn þegar þú kemur á vinnustaðinn og út þegar þú ferð. Þú færð tilkynningu í hvert sinn."
    : "Þegar þú kemur eða ferð færðu tillögu að stimplun sem þú staðfestir hér.";

  return (
    <Screen title="Sjálfvirk stimplun" back refreshing={!loaded} onRefresh={load}>
      {loaded && (!s || s.mode === "off") ? (
        <Card>
          <Empty icon={<MapPin color={colors.brandDeep} size={24} />} title="Ekki í boði" sub={s ? "Vinnustaðurinn þinn notar ekki sjálfvirka stimplun." : "Ekkert samband — reyndu aftur."} />
        </Card>
      ) : null}

      {s && s.mode !== "off" ? <>
        <List>
          <Row
            icon={<IconBox tone="brand"><MapPin color={colors.brandDeep} size={19} /></IconBox>}
            title={s.mode === "auto" ? "Stimpla mig sjálfkrafa" : "Stinga upp á stimplun"}
            sub={modeText}
            right={<Switch value={on} disabled={busy} onValueChange={(v) => (v ? setIntro(true) : void turnOff())} trackColor={{ true: colors.good, false: colors.line }} thumbColor="#fff" />}
            last={!(on && !bgOk)}
          />
          {on && !bgOk ? (
            <Row icon={<IconBox tone="warn"><TriangleAlert color={colors.warn} size={19} /></IconBox>} title="Leyfa staðsetningu „Alltaf“" sub="Án þess getur síminn ekki látið vita við komu og brottför. Opnar stillingar símans." chevron={false} onPress={() => Linking.openSettings().catch(() => {})} last />
          ) : null}
        </List>

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ShieldCheck color={colors.good} size={18} />
            <Txt weight="bold" size={15}>Persónuvernd</Txt>
          </View>
          <Muted>Staðsetning er aðeins notuð á þeirri stundu sem þú kemur á eða ferð af vinnustaðnum. Síminn fylgist ekki með þér þess á milli og vinnustaðurinn sér ekki hvar þú ert.</Muted>
          <Muted>Þú ræður: þú getur slökkt hér hvenær sem er, og útskráning stöðvar þetta á símanum.</Muted>
          {s.unscheduled ? null : <Muted>Aðeins á vöktum: frá 2 klst. fyrir vakt og til loka hennar.</Muted>}
          {s.clockoutHours ? <Muted>{trf("Opin stimplun lokast sjálfkrafa eftir {n} klst. Þú færð áminningu áður.", s.clockoutHours)}</Muted> : null}
        </Card>

        <Eyebrow>Tillögur sem bíða</Eyebrow>
        {s.pending.length === 0 ? (
          <Card><Muted>{s.mode === "suggest" ? `${tr("Engar tillögur bíða.")} ${tr("Þær birtast hér þegar þú kemur eða ferð.")}` : tr("Engar tillögur bíða.")}</Muted></Card>
        ) : s.pending.map((sg) => (
          <Card key={sg.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <IconBox tone={sg.kind === "in" ? "good" : "brand"}>{sg.kind === "in" ? <LogIn color={colors.good} size={19} /> : <LogOut color={colors.brandDeep} size={19} />}</IconBox>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={15}>{`${tr(sg.kind === "in" ? "Innstimplun" : "Útstimplun")} · ${dm(sg.at)} · ${hm(sg.at)}`}</Txt>
                <Muted size={12.5}>{sg.location ? (sg.kind === "in" ? trf("Komst á {x}", sg.location) : trf("Fórst af {x}", sg.location)) : (sg.kind === "in" ? tr("Komst á vinnustaðinn") : tr("Fórst af vinnustaðnum"))}</Muted>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn title="Staðfesta" variant="good" size="sm" style={{ flex: 1 }} disabled={busy} onPress={() => decide(sg, true)} />
              <Btn title="Breyta tíma" variant="ghost" size="sm" disabled={busy} icon={<Clock color={colors.ink} size={15} />} onPress={() => setEdit(sg)} />
              <Btn title="Hafna" variant="danger" size="sm" disabled={busy} onPress={() => decide(sg, false)} />
            </View>
          </Card>
        ))}
      </> : null}

      <Sheet open={intro} onClose={() => setIntro(false)} title={tr("Sjálfvirk stimplun")} scroll={false}>
        <View style={{ gap: 12 }}>
          <Muted>Síminn lætur VAKTO vita þegar þú kemur á eða ferð af vinnustaðnum — líka þegar appið er lokað. Til þess þarf leyfi fyrir staðsetningu „Alltaf“.</Muted>
          <Muted>Staðsetning er aðeins notuð á þeirri stundu. Engin rakning þess á milli, og þú getur slökkt hvenær sem er.</Muted>
          <Btn title="Halda áfram" loading={busy} onPress={turnOn} />
          <Btn title="Hætta við" variant="ghost" onPress={() => setIntro(false)} />
        </View>
      </Sheet>
      <EditSheet sg={edit} busy={busy} onClose={() => setEdit(null)} onSave={(at) => edit && decide(edit, true, at)} />
    </Screen>
  );
}

/** Leiðrétta tíma: innstimplun má ekki vera fyrr en þú komst, útstimplun ekki síðar en þú fórst. */
function EditSheet({ sg, busy, onClose, onSave }: { sg: Suggestion | null; busy: boolean; onClose: () => void; onSave: (at: string) => void }) {
  const [time, setTime] = useState("");
  React.useEffect(() => { if (sg) setTime(hm(sg.at)); }, [sg]);
  const onTime = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); setTime(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d); };
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  let at: Date | null = null;
  if (sg && m) { at = new Date(sg.at); at.setHours(Number(m[1]), Number(m[2]), 0, 0); }
  const base = sg ? new Date(sg.at).getTime() : 0;
  const bad = !!(sg && at && (sg.kind === "in" ? at.getTime() < base - 60_000 || at.getTime() > Date.now() : at.getTime() > base + 60_000));
  return (
    <Sheet open={!!sg} onClose={onClose} title={tr("Breyta tíma")}>
      {sg ? (
        <View style={{ gap: 12 }}>
          <Muted>{sg.kind === "in" ? trf("Þú komst kl. {x}. Innstimplun getur verið síðar, en ekki fyrr.", hm(sg.at)) : trf("Þú fórst kl. {x}. Útstimplun getur verið fyrr, en ekki síðar.", hm(sg.at))}</Muted>
          <TextInput value={time} onChangeText={onTime} keyboardType="number-pad" placeholder="08:00" placeholderTextColor={colors.ink3} maxLength={5} style={[inputStyle, { fontVariant: ["tabular-nums"] }]} />
          {bad ? <Muted size={12}>{sg.kind === "in" ? tr("Tíminn getur ekki verið fyrr en þú komst.") : tr("Tíminn getur ekki verið síðar en þú fórst.")}</Muted> : null}
          <Btn title={sg.kind === "in" ? tr("Staðfesta innstimplun") : tr("Staðfesta útstimplun")} loading={busy} disabled={!at || bad} onPress={() => at && onSave(at.toISOString())} />
        </View>
      ) : null}
    </Sheet>
  );
}

