// Laun — unnið hingað til, áætlað í mánaðarlok, sundurliðun og vikur.
import React, { useCallback, useState } from "react";
import { tr, trf } from "../src/lib/i18n";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FolderOpen } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Bar, Btn, Pill } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { getMonthPay } from "../src/lib/api/home";
import type { MonthPay } from "../src/lib/api/pay";
import { kr, dec1 } from "../src/lib/format";

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={{ flex: 1, minWidth: "45%", backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, padding: 13 }}>
      <Muted size={12}>{label}</Muted>
      <Txt weight="bold" size={17} style={{ marginTop: 2, fontVariant: ["tabular-nums"] }}>{value}</Txt>
      <Muted size={12}>{sub}</Muted>
    </View>
  );
}

export default function Laun() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const [pay, setPay] = useState<MonthPay | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { if (me) setPay(await getMonthPay(me)); }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const pct = pay && pay.projectedKr > 0 ? pay.earnedKr / pay.projectedKr : 0;

  return (
    <Screen title="Laun" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>{pay?.monthLabel ?? "…"}</Eyebrow>
          {pay ? <Pill tone="good" label={trf("Greitt {x}", pay.payday)} /> : null}
        </View>
        <View>
          <Txt weight="bold" size={34} style={{ letterSpacing: -0.8, lineHeight: 38, fontVariant: ["tabular-nums"] }}>{pay ? kr(pay.earnedKr) : "—"}</Txt>
          <Muted>{pay ? `unnið hingað til · ${dec1(pay.earnedH)} klst · ${pay.shifts} ${pay.shifts === 1 ? "vakt" : "vaktir"}` : "unnið hingað til"}</Muted>
        </View>
        <Bar value={pct} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Muted>Áætlað í mánaðarlok m.v. staðfestar vaktir</Muted>
          <Txt weight="bold" size={14} style={{ fontVariant: ["tabular-nums"] }}>{pay ? kr(pay.projectedKr) : "—"}</Txt>
        </View>
        {pay && pay.plannedH > 0 ? <Muted size={12}>{dec1(pay.plannedH)} klst eftir á plani · {kr(pay.plannedKr)}</Muted> : null}
      </Card>

      {pay ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Tile label="Dagvinna" value={kr(pay.dayKr)} sub={`${dec1(pay.dayH)} klst`} />
          <Tile label="Kvöld- og helgarálag" value={kr(pay.premKr)} sub={`${dec1(pay.premH)} klst`} />
          <Tile label="Yfirvinna" value={kr(pay.otKr)} sub={`${dec1(pay.otH)} klst`} />
          <Tile label="Orlof (10,17%)" value={kr(pay.orlofKr)} sub="lagt til hliðar" />
        </View>
      ) : null}

      {pay && pay.weeks.length ? (
        <Card style={{ paddingVertical: 12 }}>
          <Eyebrow>Eftir viku</Eyebrow>
          <View style={{ flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line2, marginTop: 6 }}>
            <Txt weight="bold" size={11} color={colors.ink3} style={{ flex: 1, letterSpacing: 0.6 }}>VIKA</Txt>
            <Txt weight="bold" size={11} color={colors.ink3} style={{ width: 60, textAlign: "right", letterSpacing: 0.6 }}>KLST</Txt>
            <Txt weight="bold" size={11} color={colors.ink3} style={{ width: 100, textAlign: "right", letterSpacing: 0.6 }}>LAUN</Txt>
          </View>
          {pay.weeks.map((w, i) => (
            <View key={w.label} style={{ flexDirection: "row", paddingVertical: 10, borderBottomWidth: i === pay.weeks.length - 1 ? 0 : 1, borderBottomColor: colors.line2 }}>
              <Txt size={13.5} color={w.planned ? colors.ink3 : colors.ink} style={{ flex: 1 }}>{w.label}{w.planned ? tr("· áætlað") : ""}</Txt>
              <Txt size={13.5} color={w.planned ? colors.ink3 : colors.ink} style={{ width: 60, textAlign: "right", fontVariant: ["tabular-nums"] }}>{dec1(w.hours)}</Txt>
              <Txt size={13.5} weight="semibold" color={w.planned ? colors.ink3 : colors.ink} style={{ width: 100, textAlign: "right", fontVariant: ["tabular-nums"] }}>{kr(w.kr)}</Txt>
            </View>
          ))}
        </Card>
      ) : null}

      <Muted size={12} style={{ lineHeight: 18 }}>
        {me?.hourly
          ? trf("Brúttólaun fyrir staðgreiðslu og lífeyri, reiknuð eftir {x} á tímakaupi {n} kr. Endanlegur launaseðill kemur úr launakerfinu.", me.union ? trf("kjarasamningi {x}", me.union) : tr("reglum fyrirtækisins"), kr(me.rate).replace(" kr", ""))
          : "Mánaðarlaun. Endanlegur launaseðill kemur úr launakerfinu."}
      </Muted>
      <Btn title="Launaseðlar og skjöl" variant="ghost" icon={<FolderOpen color={colors.ink} size={17} />} onPress={() => router.push("/skjol")} />
    </Screen>
  );
}
