// Mælaborð — flipi sem aðeins eigendur og vaktstjórar sjá. Laun sem hlutfall
// af veltu fyrir valið tímabil með fráviki frá markmiði, velta og kostnaður
// með samanburði við sama tímabil á undan, tímar og yfirvinna, hverjir eru á
// vakt núna, beiðnir sem bíða og vaktir sem enginn er á.
import React, { useCallback, useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { Clock, Check, X, CalendarClock, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Plus, LogOut, ListChecks } from "lucide-react-native";
import { tr, trf } from "../../src/lib/i18n";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Avatar, Btn, Divider, Seg, Sheet, useToast } from "../../src/components/ui";
import { colors, font, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { dec1, kr, nf } from "../../src/lib/format";
import {
  getOps, decideRequest, openShiftLabel, myCompanyId, targetGapKr, rangeLabel, addDays,
  managerClockOut, listLocations, getManualRevenue, saveManualRevenue,
  type Ops, type PendingReq, type PeriodId, type PeriodSel, type OnShift, type LocationRow,
} from "../../src/lib/api/ops";
import { iso } from "../../src/lib/api/me";
import { getCompanyTasks, type StaffTasks } from "../../src/lib/api/tasks";
import { TaskChecklist } from "../../src/components/tasks";

export default function Maelabord() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [sel, setSel] = useState<PeriodSel>({ id: "week", offset: 0 });
  const [pick, setPick] = useState(false);
  const [ops, setOps] = useState<Ops | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [outFor, setOutFor] = useState<OnShift | null>(null);
  const [staffTasks, setStaffTasks] = useState<StaffTasks[]>([]);
  const [openTasks, setOpenTasks] = useState<string | null>(null);
  const [revOpen, setRevOpen] = useState(false);

  const load = useCallback(async () => {
    const companyId = await myCompanyId(me ?? null);
    if (!companyId) return;
    getCompanyTasks(companyId).then(setStaffTasks).catch(() => {});
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
        <View style={{ marginTop: 14 }}>
          <Btn title={tr("Skrá veltu")} size="sm" variant="ghost" onPress={() => setRevOpen(true)} icon={<Plus color={colors.ink} size={16} />} />
        </View>
      </Card>

      {/* tímar */}
      <Card>
        <Txt weight="bold" size={16}>{tr("Tímar")}</Txt>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
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
                <Pressable onPress={() => setOutFor(x)} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, opacity: pressed ? 0.6 : 1 })}>
                  <LogOut color={colors.ink2} size={14} />
                  <Txt size={12.5} weight="semibold" color={colors.ink2}>{tr("Stimpla út")}</Txt>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* verkefni dagsins — hver er búinn með hvað */}
      {staffTasks.length > 0 ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ListChecks color={colors.ink3} size={16} />
            <Txt weight="bold" size={16}>{tr("Verkefni dagsins")}</Txt>
            <Muted>{staffTasks.reduce((a, x) => a + x.tasks.filter((k) => k.done).length, 0)}/{staffTasks.reduce((a, x) => a + x.tasks.length, 0)}</Muted>
          </View>
          <View style={{ marginTop: 10, gap: 4 }}>
            {staffTasks.map((x) => {
              const done = x.tasks.filter((k) => k.done).length, all = done === x.tasks.length;
              return (
                <View key={x.empId}>
                  <Pressable onPress={() => setOpenTasks(openTasks === x.empId ? null : x.empId)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, opacity: pressed ? 0.7 : 1 })}>
                    <Avatar name={x.name} size={34} color={x.color} photo={x.photo} />
                    <Txt weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{x.name}</Txt>
                    <Txt weight="semibold" size={13} color={all ? colors.good : colors.ink2} style={{ fontVariant: ["tabular-nums"] }}>{done}/{x.tasks.length}</Txt>
                    <ChevronRight color={colors.ink3} size={16} style={{ transform: [{ rotate: openTasks === x.empId ? "90deg" : "0deg" }] }} />
                  </Pressable>
                  {openTasks === x.empId ? <View style={{ paddingLeft: 44, paddingBottom: 6 }}><TaskChecklist tasks={x.tasks} /></View> : null}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

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
      <ClockOutSheet who={outFor} onClose={() => setOutFor(null)} onDone={() => { setOutFor(null); toast(tr("Stimplað út")); load(); }} />
      <RevenueSheet open={revOpen} me={me ?? null} onClose={() => setRevOpen(false)} onDone={() => { setRevOpen(false); toast(tr("Velta skráð")); load(); }} />
      <DateSheet
        open={pick}
        onClose={() => setPick(false)}
        onPick={(from, to) => { setSel({ id: "custom", from, to }); setPick(false); }}
      />
    </Screen>
  );
}

const inputStyle = { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 22, fontFamily: font.semibold, color: colors.ink } as const;

/** Stjórnandi stimplar út starfsmann sem gleymdi því. Tíminn er í dag, eða í gær ef hann er ekki liðinn í dag. */
function ClockOutSheet({ who, onClose, onDone }: { who: OnShift | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (who) { const n = new Date(); setTime(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`); }
  }, [who]);
  const onTime = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); setTime(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d); };
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  let at: Date | null = null;
  if (m) { at = new Date(); at.setHours(Number(m[1]), Number(m[2]), 0, 0); if (at.getTime() > Date.now() + 60000) at = addDays(at, -1); }
  async function save() {
    if (!who || !at) return;
    setBusy(true);
    const r = await managerClockOut(who.id, at);
    setBusy(false);
    if (!r.ok) { toast(tr(r.error ?? "Tókst ekki")); return; }
    onDone();
  }
  return (
    <Sheet open={!!who} onClose={onClose} title={tr("Stimpla út")}>
      {who ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={who.name} size={42} color={who.color} photo={who.photo} />
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={16}>{who.name}</Txt>
              <Muted size={13}>{trf("Stimplaði inn {n}", `${rangeLabel(iso(new Date(who.clockIn)), iso(new Date(who.clockIn)))} · ${who.since}`)}</Muted>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Muted size={12}>{tr("Útstimplun kl.")}</Muted>
            <TextInput value={time} onChangeText={onTime} keyboardType="number-pad" placeholder="16:00" placeholderTextColor={colors.ink3} maxLength={5} style={[inputStyle, { fontVariant: ["tabular-nums"] }]} />
            {at && iso(at) !== iso(new Date()) ? <Muted size={12}>{tr("Tíminn er ekki liðinn í dag — skráð á gærdaginn.")}</Muted> : null}
          </View>
          <Btn title={tr("Stimpla út")} loading={busy} disabled={!at} onPress={save} />
        </View>
      ) : null}
    </Sheet>
  );
}

/** Handskráð velta dagsins — fyrir þá sem eru ekki með sölukerfi tengt. */
function RevenueSheet({ open, me, onClose, onDone }: { open: boolean; me: Parameters<typeof myCompanyId>[0]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [locs, setLocs] = useState<LocationRow[]>([]);
  const [loc, setLoc] = useState<string | null>(null);
  const [back, setBack] = useState(0);
  const [amount, setAmount] = useState("");
  const [had, setHad] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const date = iso(addDays(new Date(), -back));
  React.useEffect(() => {
    if (!open) return;
    setBack(0);
    myCompanyId(me).then(async (c) => { if (!c) return; const l = await listLocations(c); setLocs(l); setLoc((cur) => cur ?? l[0]?.id ?? null); });
  }, [open, me]);
  React.useEffect(() => {
    if (!open || !loc) return;
    let live = true;
    getManualRevenue(loc, date).then((v) => { if (!live) return; setHad(v); setAmount(v ? nf(v) : ""); });
    return () => { live = false; };
  }, [open, loc, date]);
  const value = Number(amount.replace(/\D/g, ""));
  async function save() {
    if (!loc) return;
    setBusy(true);
    const r = await saveManualRevenue(loc, date, value);
    setBusy(false);
    if (!r.ok) { toast(tr(r.error ?? "Tókst ekki")); return; }
    onDone();
  }
  return (
    <Sheet open={open} onClose={onClose} title={tr("Skrá veltu")}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => setBack(back + 1)} hitSlop={10} style={{ padding: 6 }}><ChevronLeft color={colors.ink2} size={22} /></Pressable>
          <Txt weight="semibold" size={15}>{back === 0 ? tr("Í dag") : back === 1 ? tr("Í gær") : rangeLabel(date, date)}</Txt>
          {back === 0 ? <View style={{ width: 34 }} /> : <Pressable onPress={() => setBack(back - 1)} hitSlop={10} style={{ padding: 6 }}><ChevronRight color={colors.ink2} size={22} /></Pressable>}
        </View>
        {locs.length > 1 && loc ? <Seg value={loc} onChange={setLoc} items={locs.map((l) => ({ id: l.id, label: l.name }))} /> : null}
        <View style={{ gap: 6 }}>
          <Muted size={12}>{tr("Velta dagsins án VSK (kr)")}</Muted>
          <TextInput value={amount} onChangeText={(v) => { const d = v.replace(/\D/g, "").slice(0, 10); setAmount(d ? nf(Number(d)) : ""); }} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.ink3} style={[inputStyle, { fontVariant: ["tabular-nums"] }]} />
          {had != null ? <Muted size={12}>{trf("Áður skráð: {n}. Ný tala kemur í staðinn.", kr(had))}</Muted> : null}
        </View>
        <Btn title={tr("Vista")} loading={busy} disabled={!(value > 0) || !loc} onPress={save} />
      </View>
    </Sheet>
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
          <View key={i} style={{ width: "14.28%", aspectRatio: 1, padding: 2 }}>
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
