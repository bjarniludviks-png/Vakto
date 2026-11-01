// Tímar — stimplanir valins mánaðar (flett með örvum), heildartölur og leiðréttingarbeiðni.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tr, trf } from "../src/lib/i18n";
import { View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Btn, Pill } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { listMyPunches, type PunchRow } from "../src/lib/api/punches";
import { dec1, kr } from "../src/lib/format";
import { monthPay } from "../src/lib/api/pay";
import { MonthStepper } from "../src/components/month-stepper";
import { getPayPeriod } from "../src/lib/api/home";
import { iso } from "../src/lib/api/me";
import { addDaysISO, isCalendarMonth, localMidnight, periodAt, periodLabel, stepLimit, type PayPeriodCfg } from "../src/lib/periods";
import { CorrectionSheet } from "../src/components/request-sheets";

const DAY_L = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];
const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: "45%", padding: 13 }}>
      <Muted size={12}>{label}</Muted>
      <Txt weight="bold" size={20} style={{ fontVariant: ["tabular-nums"] }}>{value}</Txt>
      {sub ? <Muted size={12}>{sub}</Muted> : null}
    </Card>
  );
}

export default function Timar() {
  useTheme();
  const { me } = useMe();
  const [fetched, setRows] = useState<PunchRow[]>([]);
  const [sheet, setSheet] = useState(false);
  // Stjórnandi bað um leiðréttingu (tilkynning → /timar?leidretta=YYYY-MM-DD): formið opnast með deginum.
  const { leidretta } = useLocalSearchParams<{ leidretta?: string }>();
  const askDate = typeof leidretta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(leidretta) ? leidretta : undefined;
  useEffect(() => { if (askDate) setSheet(true); }, [askDate]);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [cfg, setCfg] = useState<PayPeriodCfg | null>(null);
  useEffect(() => { if (me) getPayPeriod(me).then(setCfg); }, [me]);
  const range = cfg ? periodAt(cfg, offset, iso(new Date())) : null;
  const calendar = range ? isCalendarMonth(range) : true;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const load = useCallback(async () => {
    if (!me || !cfg) return;
    const o = offset;
    const r0 = periodAt(cfg, o, iso(new Date()));
    const from = localMidnight(r0.from), to = localMidnight(addDaysISO(r0.to, 1));
    // Þessi mánuður: sækja líka byrjun vikunnar ef hún er í síðasta mánuði (fyrir „Þessi vika“).
    const wk = new Date(); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7)); wk.setHours(0, 0, 0, 0);
    const start = o === 0 && wk < from ? wk : from;
    const r = await listMyPunches(me, start.toISOString(), to.toISOString());
    if (o !== offsetRef.current) return; // notandi fletti áfram á meðan
    setRows(r); setLoaded(true);
  }, [me, offset, cfg]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const changeMonth = (o: number) => { setRows([]); setLoaded(false); setOffset(o); };

  const now = new Date();
  const monthFrom = range ? localMidnight(range.from) : new Date(0);
  const rows = fetched.filter((p) => new Date(p.clockIn) >= monthFrom);
  const hours = (p: PunchRow) => (p.clockOut ? (new Date(p.clockOut).getTime() - new Date(p.clockIn).getTime()) / 3600000 : 0);
  const mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const weekH = fetched.filter((p) => new Date(p.clockIn) >= mon).reduce((a, p) => a + hours(p), 0);
  // Heildartölur tímabilsins: sami launaútreikningur og Laun-skjárinn (lokaðar stimplanir).
  const sum = useMemo(() => {
    if (!me || !range) return null;
    const closed = rows.filter((p) => p.clockOut).map((p) => ({ clockIn: p.clockIn, clockOut: p.clockOut as string }));
    const ref = offset === 0 ? new Date() : localMidnight(range.to);
    return monthPay(me, closed, [], ref, range);
  }, [me, fetched, offset, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = new Set(rows.filter((p) => p.clockOut).map((p) => p.clockIn.slice(0, 10))).size;

  return (
    <Screen title="Tímar" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <MonthStepper offset={offset} onChange={changeMonth} label={range ? periodLabel(range) : "…"} calendar={calendar} min={cfg ? -stepLimit(cfg) : 0} max={0} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Stat label={tr("Heildartímar")} value={`${dec1(sum?.earnedH ?? 0)} klst`} sub={trf("{n} vaktir · {n} dagar", sum?.shifts ?? 0, days)} />
        {offset === 0
          ? <Stat label={tr("Þessi vika")} value={`${dec1(weekH)} klst`} sub={tr("frá mánudegi")} />
          : <Stat label={tr("Meðaltal á vakt")} value={`${dec1(sum && sum.shifts ? sum.earnedH / sum.shifts : 0)} klst`} sub={tr("lokaðar stimplanir")} />}
        {sum && !me?.contractor ? <>
          <Stat label={tr("Dagvinna")} value={`${dec1(sum.dayH)} klst`} sub={me?.hourly ? kr(sum.dayKr) : ""} />
          <Stat label={tr("Kvöld- og helgarálag")} value={`${dec1(sum.premH)} klst`} sub={me?.hourly ? kr(sum.premKr) : ""} />
          <Stat label={tr("Yfirvinna")} value={`${dec1(sum.otH)} klst`} sub={me?.hourly ? kr(sum.otKr) : ""} />
        </> : null}
        {sum && me?.hourly ? <Stat label={me?.contractor ? tr("Áætluð þóknun") : tr("Áætluð laun")} value={kr(sum.earnedKr)} sub={tr("án orlofs, fyrir frádrátt")} /> : null}
      </View>
      <Card style={{ paddingVertical: 8 }}>
        <View style={{ paddingVertical: 6 }}><Eyebrow>Stimplanir</Eyebrow></View>
        {rows.length === 0 ? <Muted style={{ paddingVertical: 10 }}>{loaded ? tr(calendar ? "Engar stimplanir í þessum mánuði." : "Engar stimplanir á þessu tímabili.") : "…"}</Muted> : null}
        {rows.map((p, i) => {
          const d = new Date(p.clockIn);
          return (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line2 }}>
              <View style={{ width: 70 }}>
                <Txt weight="bold" size={14}>{tr(DAY_L[d.getDay()])} {d.getDate()}.{d.getMonth() + 1}</Txt>
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
      <CorrectionSheet open={sheet} onClose={() => setSheet(false)} onDone={load} date={askDate} />
    </Screen>
  );
}
