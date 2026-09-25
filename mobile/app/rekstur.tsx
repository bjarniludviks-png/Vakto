// Rekstur — flipi sem aðeins eigendur og vaktstjórar sjá. Hverjir eru á vakt
// núna, laun sem hlutfall af veltu, tímar og kostnaður vikunnar, beiðnir sem
// bíða afgreiðslu og vaktir sem enginn er á.
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Clock, Check, X, CalendarClock } from "lucide-react-native";
import { tr, trf } from "../src/lib/i18n";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Avatar, Btn, Empty, Divider, useToast } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { dec1, kr } from "../src/lib/format";
import { getOps, decideRequest, openShiftLabel, myCompanyId, type Ops, type PendingReq } from "../src/lib/api/ops";

export default function Rekstur() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [ops, setOps] = useState<Ops | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const companyId = await myCompanyId(me ?? null);
    if (!companyId) return;
    setOps(await getOps(companyId));
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function decide(r: PendingReq, approve: boolean) {
    setBusy(r.id);
    const res = await decideRequest(r, approve);
    setBusy(null);
    if (!res.ok) { toast(res.error ?? tr("Aðgerð tókst ekki")); return; }
    toast(approve ? tr("Samþykkt") : tr("Hafnað"));
    load();
  }

  const pctColor = (pct: number, target: number) =>
    pct <= target ? colors.good : pct <= target + 5 ? colors.warn : colors.bad;

  return (
    <Screen
      title={tr("Rekstur")}
      subtitle={tr("Staðan á vinnustaðnum núna")}
      back
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
    >
      {/* laun% vikunnar */}
      <Card>
        <Eyebrow>{tr("VIKAN Í TÖLUM")}</Eyebrow>
        {ops?.laborPct != null ? (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
            <Txt weight="bold" size={40} color={pctColor(ops.laborPct, ops.laborTarget)} style={{ letterSpacing: -1, fontVariant: ["tabular-nums"] }}>
              {dec1(ops.laborPct)}%
            </Txt>
            <Muted style={{ paddingBottom: 8 }}>{trf("laun af veltu · markmið {n}%", ops.laborTarget)}</Muted>
          </View>
        ) : (
          <>
            <Txt weight="bold" size={22} style={{ marginTop: 4 }}>{tr("Engin velta skráð")}</Txt>
            <Muted>{tr("Laun sem hlutfall af veltu birtist þegar velta vikunnar er komin inn.")}</Muted>
          </>
        )}
        <Divider />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Stat label={tr("Tímar")} value={ops ? `${dec1(ops.hoursWeek)}` : "—"} sub={tr("unnir í viku")} />
          <Stat label={tr("Yfirvinna")} value={ops ? `${dec1(ops.otHoursWeek)}` : "—"} sub={tr("klst yfir 40")} tone={ops && ops.otHoursWeek > 0 ? colors.warn : undefined} />
          <Stat label={tr("Kostnaður")} value={ops ? kr(ops.costWeek) : "—"} sub={tr("með gjöldum")} />
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
            {(ops?.onShift ?? []).map((p) => (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Avatar name={p.name} size={34} color={p.color} photo={p.photo} />
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold">{p.name}</Txt>
                  <Muted size={12}>{p.dept ? `${p.dept} · ` : ""}{trf("síðan {n}", p.since)}</Muted>
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

      {/* vaktir sem enginn er á */}
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

      {!ops ? <Empty title={tr("Sæki stöðuna…")} /> : null}
    </Screen>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Muted size={12}>{label}</Muted>
      <Txt weight="bold" size={18} color={tone} style={{ fontVariant: ["tabular-nums"] }}>{value}</Txt>
      <Muted size={11}>{sub}</Muted>
    </View>
  );
}
