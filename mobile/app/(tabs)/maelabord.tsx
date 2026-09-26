// Mælaborð — flipi sem aðeins eigendur og vaktstjórar sjá. Laun sem hlutfall
// af veltu fyrir valið tímabil með fráviki frá markmiði, velta og kostnaður
// með samanburði við sama tímabil á undan, tímar og yfirvinna, hverjir eru á
// vakt núna, beiðnir sem bíða og vaktir sem enginn er á.
import React, { useCallback, useState } from "react";
import { View, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Clock, Check, X, CalendarClock, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { tr, trf } from "../../src/lib/i18n";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Avatar, Btn, Divider, Seg, Sheet, useToast } from "../../src/components/ui";
import { colors, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { dec1, kr } from "../../src/lib/format";
import {
  getOps, decideRequest, openShiftLabel, myCompanyId, targetGapKr, rangeLabel, addDays,
  type Ops, type PendingReq, type PeriodId, type PeriodSel,
} from "../../src/lib/api/ops";
import { iso } from "../../src/lib/api/me";

export default function Maelabord() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [sel, setSel] = useState<PeriodSel>({ id: "week", offset: 0 });
  const [pick, setPick] = useState(false);
  const [ops, setOps] = useState<Ops | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const companyId = await myCompanyId(me ?? null);
    if (!companyId) return;
    setOps(await getOps(companyId, sel));
  }, [me, sel]);
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
        <View style={{ gap: 10 }}>
          <Seg
            value={sel.id}
            onChange={(id) => { if (id === "custom") { setPick(true); } else { setSel({ id: id as PeriodId, offset: 0 }); } }}
            items={[
              { id: "day", label: tr("Í dag") }, { id: "week", label: tr("Vika") },
              { id: "month", label: tr("Mánuður") }, { id: "custom", label: tr("Valið") },
            ]}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {sel.id === "custom" ? <View style={{ width: 34 }} /> : (
              <Pressable onPress={() => setSel({ id: sel.id, offset: sel.offset + 1 })} hitSlop={10} style={{ padding: 5 }}>
                <ChevronLeft color={colors.ink2} size={20} />
              </Pressable>
            )}
            <Pressable onPress={() => setPick(true)}>
              <Txt weight="semibold" size={14}>{ops?.label ?? ""}</Txt>
            </Pressable>
            {sel.id === "custom" || sel.offset === 0 ? <View style={{ width: 34 }} /> : (
              <Pressable onPress={() => setSel({ id: sel.id, offset: Math.max(0, sel.offset - 1) })} hitSlop={10} style={{ padding: 5 }}>
                <ChevronRight color={colors.ink2} size={20} />
              </Pressable>
            )}
          </View>
        </View>
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
          <Metric
            label={tr("Unnir")}
            value={p ? dec1(p.hours) : "—"}
            sub={p ? trf("á plani {n}", dec1(p.planned)) : undefined}
            tone={p && p.planned > 0 && p.hours > p.planned + 0.5 ? colors.warn : undefined}
          />
          <Metric
            label={tr("Yfirvinna")}
            value={p ? dec1(p.overtime) : "—"}
            sub={p && p.overtimePay > 0 ? kr(p.overtimePay) : tr("engin")}
            tone={p && p.overtime > 0 ? colors.warn : undefined}
          />
          <Metric label={tr("Álagstímar")} value={p ? dec1(p.premium) : "—"} sub={p && p.premiumPay > 0 ? kr(p.premiumPay) : tr("ekkert álag")} />
        </View>
        {p && (p.planned > 0 || p.plannedCost > 0) ? (
          <>
            <Divider />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Muted size={13}>{tr("Áætlun á móti raun")}</Muted>
              <Txt weight="semibold" size={14} color={p.cost > p.plannedCost ? colors.bad : colors.good} style={{ fontVariant: ["tabular-nums"] }}>
                {p.cost >= p.plannedCost ? "+" : "−"}{kr(Math.abs(p.cost - p.plannedCost))}
              </Txt>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Muted size={12}>{trf("áætlað {n}", kr(p.plannedCost))}</Muted>
              <Muted size={12}>{trf("{n} klst frávik", dec1(p.hours - p.planned))}</Muted>
            </View>
          </>
        ) : null}
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
      <DateSheet
        open={pick}
        onClose={() => setPick(false)}
        onPick={(from, to) => { setSel({ id: "custom", from, to }); setPick(false); }}
      />
    </Screen>
  );
}

/** Einfalt dagatal: fyrsti smellur velur upphaf, annar velur enda. */
function DateSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (from: string, to: string) => void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const todayISO = iso(new Date());

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1)))];

  function tap(d: string) {
    if (!from || (from && to)) { setFrom(d); setTo(null); return; }
    if (d < from) { setFrom(d); return; }
    setTo(d);
  }
  const inRange = (d: string) => (from && to ? d >= from && d <= to : d === from);

  return (
    <Sheet open={open} onClose={onClose} title={tr("Veldu tímabil")}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} hitSlop={10} style={{ padding: 6 }}>
          <ChevronLeft color={colors.ink2} size={20} />
        </Pressable>
        <Txt weight="semibold">{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</Txt>
        <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} hitSlop={10} style={{ padding: 6 }}>
          <ChevronRight color={colors.ink2} size={20} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {["M", "Þ", "M", "F", "F", "L", "S"].map((d, i) => (
          <Muted key={i} size={11} style={{ flex: 1, textAlign: "center" }}>{d}</Muted>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
        {cells.map((d, i) => (
          <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
            {d ? (
              <Pressable
                onPress={() => tap(d)}
                style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: inRange(d) ? colors.brand : "transparent" }}
              >
                <Txt size={14} color={inRange(d) ? "#fff" : d === todayISO ? colors.brand : colors.ink}>{Number(d.slice(8))}</Txt>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      <Muted size={12} style={{ marginTop: 6 }}>
        {from ? (to ? rangeLabel(from, to) : tr("Veldu lokadag")) : tr("Veldu upphafsdag")}
      </Muted>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Btn title={tr("Síðustu 7 dagar")} size="sm" variant="ghost" onPress={() => onPick(iso(addDays(new Date(), -6)), iso(new Date()))} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn title={tr("Velja")} size="sm" disabled={!from} onPress={() => onPick(from!, to ?? from!)} />
        </View>
      </View>
    </Sheet>
  );
}

const MONTH_NAMES = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

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
