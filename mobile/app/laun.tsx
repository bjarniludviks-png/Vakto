// Laun — unnið hingað til, áætlað í mánaðarlok, sundurliðun og vikur. Flett milli mánaða með örvum.
import React, { useCallback, useEffect, useState } from "react";
import { tr, trf } from "../src/lib/i18n";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FolderOpen, HeartPulse } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Bar, Btn, Pill } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { getMonthPay, getPayPeriod } from "../src/lib/api/home";
import { iso } from "../src/lib/api/me";
import { isCalendarMonth, periodAt, periodLabel, stepLimit, type PayPeriodCfg } from "../src/lib/periods";
import type { MonthPay } from "../src/lib/api/pay";
import { kr, dec1 } from "../src/lib/format";
import { MonthStepper } from "../src/components/month-stepper";

function Row({ label, value, minus, strong }: { label: string; value: number; minus?: boolean; strong?: boolean }) {
  if (!value && !strong) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: strong ? 9 : 6, borderTopWidth: strong ? 1 : 0, borderTopColor: colors.line2, marginTop: strong ? 4 : 0 }}>
      <Txt size={strong ? 14.5 : 13.5} weight={strong ? "bold" : "regular"} color={strong ? colors.ink : colors.ink2}>{label}</Txt>
      <Txt size={strong ? 14.5 : 13.5} weight={strong ? "bold" : "semibold"} style={{ fontVariant: ["tabular-nums"] }}>{minus && value ? `−${kr(value)}` : kr(value)}</Txt>
    </View>
  );
}

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
  const [offset, setOffset] = useState(0);
  const [cfg, setCfg] = useState<PayPeriodCfg | null>(null);
  useEffect(() => { if (me) getPayPeriod(me).then(setCfg); }, [me]);
  const range = cfg ? periodAt(cfg, offset, iso(new Date())) : null;
  const calendar = range ? isCalendarMonth(range) : true;
  const [refreshing, setRefreshing] = useState(false);
  // Hunsa svar sem berst eftir að notandi fletti áfram (hröð smellt á örvarnar).
  const offsetRef = React.useRef(offset);
  offsetRef.current = offset;
  const load = useCallback(async () => {
    if (!me || !cfg) return;
    const o = offset;
    const p = await getMonthPay(me, o, cfg);
    setPay((prev) => (o === offsetRef.current ? p : prev));
  }, [me, offset, cfg]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const past = offset < 0, ahead = offset > 0;
  const changeMonth = (o: number) => { setPay(null); setOffset(o); };
  const pct = pay && pay.projectedKr > 0 ? pay.earnedKr / pay.projectedKr : 0;

  return (
    <Screen title="Laun" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <MonthStepper offset={offset} onChange={changeMonth} label={range ? periodLabel(range) : "…"} calendar={calendar} min={cfg ? -stepLimit(cfg) : 0} max={1} />
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>{pay?.monthLabel ?? "…"}</Eyebrow>
          {pay ? <Pill tone={past ? "good" : "neutral"} label={trf(past ? "Greitt {x}" : "Útborgun {x}", pay.payday)} /> : null}
        </View>
        <View>
          <Txt weight="bold" size={34} style={{ letterSpacing: -0.8, lineHeight: 38, fontVariant: ["tabular-nums"] }}>{pay ? kr(ahead ? pay.projectedKr : pay.earnedKr) : "—"}</Txt>
          <Muted>{!pay ? "…" : ahead
            ? `áætlað m.v. vaktir á plani · ${dec1(pay.plannedH)} klst`
            : `${past ? (calendar ? "unnið í mánuðinum" : "unnið á tímabilinu") : "unnið hingað til"} · ${dec1(pay.earnedH)} klst · ${pay.shifts} ${pay.shifts === 1 ? "vakt" : "vaktir"}`}</Muted>
        </View>
        {offset === 0 ? <>
          <Bar value={pct} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Muted>{calendar ? "Áætlað í mánaðarlok m.v. staðfestar vaktir" : "Áætlað í lok tímabils m.v. staðfestar vaktir"}</Muted>
            <Txt weight="bold" size={14} style={{ fontVariant: ["tabular-nums"] }}>{pay ? kr(pay.projectedKr) : "—"}</Txt>
          </View>
          {pay && pay.plannedH > 0 ? <Muted size={12}>{dec1(pay.plannedH)} klst eftir á plani · {kr(pay.plannedKr)}</Muted> : null}
        </> : null}
      </Card>

      {pay && !ahead ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Tile label="Dagvinna" value={kr(pay.dayKr)} sub={`${dec1(pay.dayH)} klst`} />
          {!me?.contractor && <>
            <Tile label="Kvöld- og helgarálag" value={kr(pay.premKr)} sub={`${dec1(pay.premH)} klst`} />
            <Tile label="Yfirvinna" value={kr(pay.otKr)} sub={`${dec1(pay.otH)} klst`} />
            <Tile label={`${tr("Orlof")} (${String(pay.orlofPct).replace(".", ",")}%)`} value={kr(pay.orlofKr)} sub={pay.orlofMode === "pay_out" ? tr("greitt út með launum") : pay.orlofMode === "to_bank" ? tr("lagt inn á orlofsreikning") : tr("safnast upp")} />
          </>}
        </View>
      ) : null}

      {pay?.slip && pay.slip.gross > 0 ? (
        <Card style={{ paddingVertical: 12 }}>
          <Eyebrow>Áætlaður launaseðill</Eyebrow>
          <Muted size={12} style={{ marginTop: 2, marginBottom: 6 }}>{past ? tr("Út frá stimplunum tímabilsins") : ahead ? tr("Út frá vöktum á plani") : tr(calendar ? "Allur mánuðurinn: unnið + staðfestar vaktir" : "Allt tímabilið: unnið + staðfestar vaktir")}</Muted>
          <Row label={tr("Laun")} value={pay.slip.gross - pay.slip.orlof - pay.slip.benefits - pay.slip.uppbot} />
          <Row label={tr("Orlof")} value={pay.slip.orlof} />
          <Row label={tr("Hlunnindi og styrkir")} value={pay.slip.benefits} />
          <Row label={tr("Heildarlaun")} value={pay.slip.gross} strong />
          <Row label={tr("Lífeyrissjóður")} value={pay.slip.pension} minus />
          <Row label={tr("Viðbótarlífeyrissparnaður")} value={pay.slip.extraPension} minus />
          <Row label={tr("Félagsgjald")} value={pay.slip.union} minus />
          <Row label={tr("Staðgreiðsla")} value={pay.slip.withholding} minus />
          <Row label={tr("Á orlofsreikning")} value={pay.slip.orlofToBank} minus />
          <Row label={tr("Hlunnindi í fríðu")} value={pay.slip.benefitsInKind} minus />
          <Row label={tr("Undanþegið staðgreiðslu")} value={pay.slip.benefitsFree} />
          <Row label={tr("Útborgað (áætlað)")} value={pay.slip.net} strong />
          <Muted size={11.5} style={{ marginTop: 4, lineHeight: 16 }}>{tr("Staðgreiðsla er reiknuð í þrepum ársins að frádregnum persónuafslætti samkvæmt skattkortinu þínu.")}</Muted>
        </Card>
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
        {me?.contractor
          ? "Áætluð þóknun án VSK úr tímunum þínum. Þú sendir reikning og sérð sjálf(ur) um skatta og lífeyri."
          : me?.hourly
          ? trf("Reiknað eftir {x} á tímakaupi {n} kr. Endanlegur launaseðill kemur úr launakeyrslunni.", me.union ? trf("kjarasamningi {x}", me.union) : tr("reglum fyrirtækisins"), kr(me.rate).replace(" kr", ""))
          : "Mánaðarlaun. Endanlegur launaseðill kemur úr launakeyrslunni."}
      </Muted>
      {!me?.contractor ? <Btn title="Réttindin mín: orlof og veikindi" variant="ghost" icon={<HeartPulse color={colors.ink} size={17} />} onPress={() => router.push("/rettindi")} /> : null}
      <Btn title="Launaseðlar og skjöl" variant="ghost" icon={<FolderOpen color={colors.ink} size={17} />} onPress={() => router.push("/skjol")} />
    </Screen>
  );
}
