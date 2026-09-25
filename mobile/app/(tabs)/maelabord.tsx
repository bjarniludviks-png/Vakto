// Mælaborð — flipi sem aðeins eigendur og vaktstjórar sjá. Laun sem hlutfall
// af veltu fyrir valið tímabil með fráviki frá markmiði, velta og kostnaður
// með samanburði við sama tímabil á undan, tímar og yfirvinna, hverjir eru á
// vakt núna, beiðnir sem bíða og vaktir sem enginn er á.
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Clock, Check, X, CalendarClock, TrendingUp, TrendingDown } from "lucide-react-native";
import { tr, trf } from "../../src/lib/i18n";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Avatar, Btn, Divider, Seg, useToast } from "../../src/components/ui";
import { colors, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { dec1, kr } from "../../src/lib/format";
import {
  getOps, decideRequest, openShiftLabel, myCompanyId, targetGapKr,
  type Ops, type PendingReq, type PeriodId,
} from "../../src/lib/api/ops";

export default function Maelabord() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [period, setPeriod] = useState<PeriodId>("week");
  const [ops, setOps] = useState<Ops | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const companyId = await myCompanyId(me ?? null);
    if (!companyId) return;
    setOps(await getOps(companyId, period));
  }, [me, period]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function decide(r: PendingReq, approve: boolean) {
    setBusy(r.id);
    const res = await decideRequest(r, approve);
    setBusy(null);
    if (!res.ok) { toast(res.error ?? tr("Aðgerð tókst ekki")); return; }
    toast(approve ? tr("Samþykkt") : tr("Hafnað"));
    load();
  }

  const p = ops?.now;
  const prev = ops?.prev;
  const target = ops?.laborTarget ?? 30;
  const pctColor = p?.pct == null ? colors.ink : p.pct <= target ? colors.good : p.pct <= target + 5 ? colors.warn : colors.bad;
  const gap = p ? targetGapKr(p, target) : null;
  const estimated = p ? p.coveredDays < p.days : false;

  return (
    <Screen
      title={tr("Mælaborð")}
      subtitle={tr("Staðan á vinnustaðnum")}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
      header={
        <Seg
          value={period}
          onChange={setPeriod}
          items={[{ id: "day", label: tr("Í dag") }, { id: "week", label: tr("Vika") }, { id: "month", label: tr("Mánuður") }]}
        />
      }
    >
      {/* laun% */}
      <Card>
        <Eyebrow>{tr("LAUN AF VELTU")}</Eyebrow>
        {p?.pct != null ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
              <Txt weight="bold" size={44} color={pctColor} style={{ letterSpacing: -1.2, fontVariant: ["tabular-nums"] }}>{dec1(p.pct)}%</Txt>
              <Muted style={{ paddingBottom: 9 }}>{trf("markmið {n}%", target)}</Muted>
            </View>
            {gap != null ? (
              <Txt size={14} color={gap > 0 ? colors.bad : colors.good} style={{ marginTop: 2 }}>
                {gap > 0 ? trf("{n} umfram markmið", kr(gap)) : trf("{n} undir markmiði", kr(Math.abs(gap)))}
              </Txt>
            ) : null}
            {estimated ? <Muted size={12} style={{ marginTop: 6 }}>{trf("Velta áætluð fyrir {n} daga af {x}", p.days - p.coveredDays, p.days)}</Muted> : null}
          </>
        ) : (
          <>
            <Txt weight="bold" size={22} style={{ marginTop: 4 }}>{tr("Engin velta skráð")}</Txt>
            <Muted>{tr("Hlutfallið birtist þegar velta tímabilsins er komin inn.")}</Muted>
          </>
        )}
        <Divider />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Metric label={tr("Velta")} value={p ? kr(p.revenue) : "—"} delta={p && prev ? p.revenue - prev.revenue : null} goodUp />
          <Metric label={tr("Launakostnaður")} value={p ? kr(p.cost) : "—"} delta={p && prev ? p.cost - prev.cost : null} />
        </View>
      </Card>

      {/* tímar */}
      <Card>
        <Txt weight="bold" size={16}>{tr("Tímar")}</Txt>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
          <Metric label={tr("Unnir")} value={p ? dec1(p.hours) : "—"} sub={p ? trf("á plani {n}", dec1(p.planned)) : undefined} />
          <Metric
            label={tr("Yfirvinna")}
            value={p ? dec1(p.overtime) : "—"}
            sub={p && p.overtimePay > 0 ? kr(p.overtimePay) : tr("engin")}
            tone={p && p.overtime > 0 ? colors.warn : undefined}
          />
          <Metric label={tr("Álagstímar")} value={p ? dec1(p.premium) : "—"} sub={p && p.premiumPay > 0 ? kr(p.premiumPay) : tr("ekkert álag")} />
        </View>
      </Card>

      {/* á vakt núna */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Clock color={colors.ink3} size={16} />
          <Txt weight="bold" size={16}>{tr("Á vakt núna")}</Txt>
          {ops && ops.onShift.length > 0 ? <Muted>{trf("{n} manns", ops.onShift.length)}</Muted> : null}
        </View>
        {ops && ops.onShift.length === 0 ? (
          <Muted style={{ marginTop: 8 }}>{tr("Enginn er stimplaður inn eins og er.")}</Muted>
        ) : (
          <View style={{ marginTop: 10, gap: 10 }}>
            {(ops?.onShift ?? []).map((x) => (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Avatar name={x.name} size={34} color={x.color} photo={x.photo} />
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold">{x.name}</Txt>
                  <Muted size={12}>{x.dept ? `${x.dept} · ` : ""}{trf("síðan {n}", x.since)}</Muted>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* beiðnir */}
      <Card>
        <Txt weight="bold" size={16}>{tr("Beiðnir sem bíða")}</Txt>
        {ops && ops.pending.length === 0 ? (
          <Muted style={{ marginTop: 8 }}>{tr("Engin beiðni bíður afgreiðslu.")}</Muted>
        ) : (
          <View style={{ marginTop: 10, gap: 12 }}>
            {(ops?.pending ?? []).map((r) => (
              <View key={`${r.kind}-${r.id}`} style={{ gap: 8 }}>
                <View>
                  <Txt weight="semibold">{r.name}</Txt>
                  <Muted size={12}>{r.title}{r.sub ? ` · ${r.sub}` : ""}</Muted>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Btn title={tr("Samþykkja")} size="sm" loading={busy === r.id} onPress={() => decide(r, true)} icon={<Check color="#fff" size={16} />} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Btn title={tr("Hafna")} size="sm" variant="ghost" disabled={busy === r.id} onPress={() => decide(r, false)} icon={<X color={colors.ink} size={16} />} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* ómannaðar vaktir */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <CalendarClock color={colors.ink3} size={16} />
          <Txt weight="bold" size={16}>{tr("Vaktir án starfsmanns")}</Txt>
        </View>
        {ops && ops.openShifts.length === 0 ? (
          <Muted style={{ marginTop: 8 }}>{tr("Allar vaktir næstu tvær vikurnar eru mannaðar.")}</Muted>
        ) : (
          <View style={{ marginTop: 10, gap: 8 }}>
            {(ops?.openShifts ?? []).map((s) => (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warn }} />
                <Txt size={14} style={{ flex: 1 }}>{openShiftLabel(s)}</Txt>
                {s.dept ? <Muted size={12}>{s.dept}</Muted> : null}
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

/** Tala með valfrjálsri breytingu frá fyrra tímabili. */
function Metric({ label, value, sub, delta, goodUp, tone }: {
  label: string; value: string; sub?: string; delta?: number | null; goodUp?: boolean; tone?: string;
}) {
  const up = (delta ?? 0) > 0;
  const good = goodUp ? up : !up;
  const show = delta != null && Math.abs(delta) > 0;
  return (
    <View style={{ flex: 1 }}>
      <Muted size={12}>{label}</Muted>
      <Txt weight="bold" size={18} color={tone} style={{ fontVariant: ["tabular-nums"] }}>{value}</Txt>
      {show ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 }}>
          {up ? <TrendingUp color={good ? colors.good : colors.bad} size={12} /> : <TrendingDown color={good ? colors.good : colors.bad} size={12} />}
          <Muted size={11}>{kr(Math.abs(delta!))}</Muted>
        </View>
      ) : sub ? (
        <Muted size={11}>{sub}</Muted>
      ) : null}
    </View>
  );
}
