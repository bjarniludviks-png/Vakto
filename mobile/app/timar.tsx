// Tímar — stimplanir mánaðarins og leiðréttingarbeiðni.
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Btn, Pill } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { listMyPunches, type PunchRow } from "../src/lib/api/punches";
import { dec1 } from "../src/lib/format";
import { CorrectionSheet } from "../src/components/request-sheets";

const DAY_L = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];
const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export default function Timar() {
  useTheme();
  const { me } = useMe();
  const [rows, setRows] = useState<PunchRow[]>([]);
  const [sheet, setSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!me) return;
    const from = new Date(); from.setDate(from.getDate() - 45);
    setRows(await listMyPunches(me, from.toISOString()));
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const hours = (p: PunchRow) => (p.clockOut ? (new Date(p.clockOut).getTime() - new Date(p.clockIn).getTime()) / 3600000 : 0);
  const monthH = rows.filter((p) => p.clockIn.startsWith(monthKey)).reduce((a, p) => a + hours(p), 0);
  const mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const weekH = rows.filter((p) => new Date(p.clockIn) >= mon).reduce((a, p) => a + hours(p), 0);

  return (
    <Screen title="Tímar" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1, padding: 13 }}><Muted size={12}>Þessi mánuður</Muted><Txt weight="bold" size={20} style={{ fontVariant: ["tabular-nums"] }}>{dec1(monthH)} klst</Txt></Card>
        <Card style={{ flex: 1, padding: 13 }}><Muted size={12}>Þessi vika</Muted><Txt weight="bold" size={20} style={{ fontVariant: ["tabular-nums"] }}>{dec1(weekH)} klst</Txt></Card>
      </View>
      <Card style={{ paddingVertical: 8 }}>
        <View style={{ paddingVertical: 6 }}><Eyebrow>Stimplanir</Eyebrow></View>
        {rows.length === 0 ? <Muted style={{ paddingVertical: 10 }}>Engar stimplanir síðustu 45 daga.</Muted> : null}
        {rows.map((p, i) => {
          const d = new Date(p.clockIn);
          return (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line2 }}>
              <View style={{ width: 70 }}>
                <Txt weight="bold" size={14}>{DAY_L[d.getDay()]} {d.getDate()}.{d.getMonth() + 1}</Txt>
                <Muted size={11.5}>{p.source === "kiosk" ? "kiosk" : p.source === "app" ? "sími" : p.source}</Muted>
              </View>
              <Txt size={14} style={{ flex: 1, fontVariant: ["tabular-nums"] }}>{hm(p.clockIn)}–{p.clockOut ? hm(p.clockOut) : "…"}</Txt>
              {p.clockOut ? <Txt weight="bold" size={14} style={{ fontVariant: ["tabular-nums"] }}>{dec1(hours(p))}</Txt> : <Pill tone="good" label="Á vakt" />}
            </View>
          );
        })}
      </Card>
      <Btn title="Biðja um leiðréttingu" variant="ghost" onPress={() => setSheet(true)} />
      <Muted size={12}>Gleymdirðu að stimpla? Sendu leiðréttingu og vaktstjóri samþykkir. Aðeins samþykktir tímar fara í laun.</Muted>
      <CorrectionSheet open={sheet} onClose={() => setSheet(false)} onDone={load} />
    </Screen>
  );
}
