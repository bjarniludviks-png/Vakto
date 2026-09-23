// Vaktir — Mínar · Allar · Lausar, dagaræma, vaktir litaðar eftir deild,
// vaktasíða með samstarfsfólki og áætluðum launum. (Prototýpa 2026-09-23.)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, RefreshControl } from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight, CalendarPlus, LayoutGrid, X, ArrowLeftRight, MessageCircle } from "lucide-react-native";
import { Header, IconBtn } from "../../src/components/screen";
import { Card, Txt, Muted, Pill, Btn, Avatar, AvatarStack, Seg, Sheet, Eyebrow, KV, Empty, useToast } from "../../src/components/ui";
import { colors, deptColor, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { getWeekShifts, weekHoursOf, coworkersOf, iso, mondayOf, type SchedShift } from "../../src/lib/api/schedule";
import { applyForShift, listMyRequests } from "../../src/lib/api/requests";
import { estimateShift } from "../../src/lib/api/pay";
import { startDM, peopleMap } from "../../src/lib/api/chat";
import { dec1, kr } from "../../src/lib/format";
import { LeaveSheet, OfferSheet, CantSheet } from "../../src/components/request-sheets";

const DAY_L = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
const DAY_FULL = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
type Tab = "mine" | "all" | "open";

export default function Vaktir() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ seg?: string }>();
  const todayISO = iso(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selDate, setSelDate] = useState(todayISO);
  const [tab, setTab] = useState<Tab>("mine");
  const [shifts, setShifts] = useState<SchedShift[]>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<SchedShift | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | "leave" | "offer" | "cant">(null);

  useEffect(() => { if (params.seg === "open") setTab("open"); }, [params.seg]);

  const load = useCallback(async () => {
    if (!me) return;
    const [s, reqs] = await Promise.all([getWeekShifts(me, weekStart), listMyRequests(me)]);
    setShifts(s);
    // umsóknir sem eru í bið → merkja lausar vaktir
    const pend = new Set<string>();
    for (const r of reqs) if (r.kind === "swap" && r.status === "pending" && r.label.startsWith("Umsókn um opna vakt")) {
      for (const o of s) if (o.open && r.label.includes(`${o.start ?? ""}–${o.end ?? ""}`) && r.label.includes(`${new Date(o.date + "T12:00:00").getDate()}.`)) pend.add(o.id);
    }
    setApplied(pend);
  }, [me, weekStart]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return iso(d); }), [weekStart]);
  const mineByDay = useMemo(() => { const m = new Map<string, SchedShift[]>(); for (const s of shifts) if (s.mine) m.set(s.date, [...(m.get(s.date) ?? []), s]); return m; }, [shifts]);
  const allOnSel = useMemo(() => shifts.filter((s) => s.date === selDate && !s.open).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "")), [shifts, selDate]);
  const openShifts = useMemo(() => shifts.filter((s) => s.open && s.date >= todayISO), [shifts, todayISO]);
  const myHours = me ? weekHoursOf(shifts, me.empId) : 0;
  const myCount = shifts.filter((s) => s.mine).length;

  function moveWeek(delta: number) { const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(d); setSelDate(iso(d)); }
  const w0 = new Date(days[0] + "T12:00:00"), w6 = new Date(days[6] + "T12:00:00");
  const weekLabel = w0.getMonth() === w6.getMonth() ? `${w0.getDate()}.–${w6.getDate()}. ${MONTHS[w0.getMonth()]}` : `${w0.getDate()}. ${MONTHS[w0.getMonth()].slice(0, 3)} – ${w6.getDate()}. ${MONTHS[w6.getMonth()].slice(0, 3)}`;
  const isThisWeek = days.includes(todayISO);

  async function apply(s: SchedShift) {
    if (!me || applied.has(s.id)) return;
    setApplied((x) => new Set(x).add(s.id));
    const d = new Date(s.date + "T12:00:00");
    const r = await applyForShift(me, `${DAY_L[(d.getDay() + 6) % 7]} ${d.getDate()}.${d.getMonth() + 1} ${s.start ?? ""}–${s.end ?? ""}`);
    if (!r.ok) { toast(r.error ?? "Tókst ekki"); setApplied((x) => { const n = new Set(x); n.delete(s.id); return n; }); return; }
    toast("Umsókn send — vaktstjóri fær tilkynningu");
    setDetail(null);
  }

  const colorOf = (s: SchedShift) => deptColor(s.dept, s.color === "#e9700f" ? null : s.color);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Vaktir" right={<IconBtn label="Biðja um frí" onPress={() => setSheet("leave")}><CalendarPlus color={colors.ink} size={22} /></IconBtn>} />
      <View style={{ backgroundColor: colors.panel, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
        <Seg value={tab} onChange={setTab} items={[{ id: "mine", label: "Mínar" }, { id: "all", label: "Allar" }, { id: "open", label: `Lausar${openShifts.length - [...applied].filter((id) => openShifts.some((o) => o.id === id)).length > 0 ? ` · ${openShifts.length}` : ""}` }]} />
      </View>
      {/* vikuval + dagaræma */}
      <View style={{ backgroundColor: colors.panel, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
          <IconBtn onPress={() => moveWeek(-1)} label="Fyrri vika"><ChevronLeft color={colors.ink2} size={22} /></IconBtn>
          <Txt weight="bold" size={14} style={{ flex: 1, textAlign: "center" }}>{weekLabel}</Txt>
          {!isThisWeek ? (
            <Pressable onPress={() => { setWeekStart(mondayOf(new Date())); setSelDate(todayISO); }} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.brandSoft, marginRight: 4 }}>
              <Txt weight="bold" size={12} color={colors.brandDeep}>Í dag</Txt>
            </Pressable>
          ) : null}
          <IconBtn onPress={() => moveWeek(1)} label="Næsta vika"><ChevronRight color={colors.ink2} size={22} /></IconBtn>
        </View>
        {tab === "all" ? (
          <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: 4 }}>
            {days.map((d, i) => {
              const on = d === selDate, today = d === todayISO, has = mineByDay.has(d);
              return (
                <Pressable key={d} onPress={() => setSelDate(d)} style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 6 }}>
                  <Txt size={10.5} weight="bold" color={colors.ink3} style={{ letterSpacing: 0.4 }}>{DAY_L[i].toUpperCase()}</Txt>
                  <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.brand : "transparent", borderWidth: today && !on ? 2 : 0, borderColor: colors.brand }}>
                    <Txt weight="bold" size={16} color={on ? "#fff" : colors.ink}>{new Date(d + "T12:00:00").getDate()}</Txt>
                  </View>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: has ? colors.brand2 : "transparent" }} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}>
        {tab === "mine" && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Muted>Vikan mín</Muted>
              <Pill tone="brand" label={`${dec1(myHours)} klst · ${myCount} ${myCount === 1 ? "vakt" : "vaktir"}`} />
            </View>
            {days.map((d, i) => {
              const mine = mineByDay.get(d) ?? [];
              const today = d === todayISO;
              return (
                <View key={d} style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 44, alignItems: "center", paddingTop: 8 }}>
                    <Txt weight="bold" size={20} color={today ? colors.brand : colors.ink} style={{ lineHeight: 22 }}>{new Date(d + "T12:00:00").getDate()}</Txt>
                    <Txt size={10.5} weight="bold" color={today ? colors.brand : colors.ink3} style={{ letterSpacing: 0.4 }}>{DAY_L[i].toUpperCase()}</Txt>
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    {mine.length ? mine.map((s) => <ShiftCard key={s.id} s={s} color={colorOf(s)} tag={today ? "Í dag" : undefined} onPress={() => setDetail(s)} />) : (
                      <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2 }}>
                        <Txt size={13.5} weight={today ? "semibold" : "regular"} color={today ? colors.ink : colors.ink3}>{today ? "Engin vakt í dag" : "Frí"}</Txt>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {tab === "all" && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Txt weight="bold" size={15}>{DAY_FULL[(new Date(selDate + "T12:00:00").getDay() + 6) % 7]} {new Date(selDate + "T12:00:00").getDate()}. {MONTHS[new Date(selDate + "T12:00:00").getMonth()]}</Txt>
              <Muted>{allOnSel.length} á vakt</Muted>
            </View>
            {allOnSel.length === 0 ? <Empty title="Engar vaktir á plani" sub="Ekkert skráð þennan dag." /> : null}
            {allOnSel.map((s) => <ShiftCard key={s.id} s={s} color={colorOf(s)} showWho tag={s.mine ? "Þú" : undefined} onPress={() => setDetail(s)} />)}
          </>
        )}

        {tab === "open" && (
          <>
            {openShifts.length === 0 ? <Empty icon={<LayoutGrid color={colors.brandDeep} size={26} />} title="Engar lausar vaktir" sub="Þú færð tilkynningu þegar vakt losnar." /> : null}
            {openShifts.map((s) => {
              const d = new Date(s.date + "T12:00:00");
              const ap = applied.has(s.id);
              const est = me ? estimateShift(me, s.date, s.start, s.end) : null;
              return (
                <Card key={s.id} style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brand2, gap: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Eyebrow>{DAY_FULL[(d.getDay() + 6) % 7]} {d.getDate()}. {MONTHS[d.getMonth()]}</Eyebrow>
                      <Txt weight="bold" size={20} style={{ marginTop: 2, fontVariant: ["tabular-nums"] }}>{s.start ?? "?"}–{s.end ?? "?"}{s.dur ? ` · ${s.dur}` : ""}</Txt>
                      <Muted>{[s.typeName, s.dept].filter(Boolean).join(" · ") || "Opin vakt"}</Muted>
                    </View>
                    <Pill tone={ap ? "warn" : "brand"} label={ap ? "Umsókn send" : "Laus"} />
                  </View>
                  {est ? (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.panel2, borderRadius: 12, padding: 12 }}>
                      <Muted>Áætluð laun fyrir vaktina</Muted>
                      <Txt weight="bold" size={15} style={{ fontVariant: ["tabular-nums"] }}>{kr(est.total)}</Txt>
                    </View>
                  ) : null}
                  <Btn title={ap ? "Umsókn í bið hjá vaktstjóra" : "Sækja um vaktina"} variant={ap ? "ghost" : "primary"} disabled={ap} onPress={() => apply(s)} />
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      <ShiftDetail
        shift={detail}
        all={shifts}
        color={detail ? colorOf(detail) : colors.brand}
        onClose={() => setDetail(null)}
        onApply={apply}
        applied={detail ? applied.has(detail.id) : false}
        onOffer={() => setSheet("offer")}
        onCant={() => setSheet("cant")}
        onMessage={async (empId) => {
          if (!me) return;
          const people = await peopleMap(me.companyId);
          const other = [...people.values()].find((p) => p.name === empId);
          if (!other) { toast("Þessi starfsmaður er ekki með aðgang að appinu"); return; }
          const r = await startDM(me, other.userId);
          if (r.ok && r.id) { setDetail(null); router.push(`/spjall/${r.id}?name=${encodeURIComponent(other.name)}`); }
        }}
      />
      <LeaveSheet open={sheet === "leave"} onClose={() => setSheet(null)} onDone={load} />
      <OfferSheet open={sheet === "offer"} onClose={() => setSheet(null)} onDone={() => { setDetail(null); load(); }} shiftLabel={detail ? `${DAY_L[(new Date(detail.date + "T12:00:00").getDay() + 6) % 7]} ${new Date(detail.date + "T12:00:00").getDate()}.${new Date(detail.date + "T12:00:00").getMonth() + 1} ${detail.start}–${detail.end}` : undefined} />
      <CantSheet open={sheet === "cant"} onClose={() => setSheet(null)} onDone={() => { setDetail(null); load(); }} shiftLabel={detail ? `${DAY_L[(new Date(detail.date + "T12:00:00").getDay() + 6) % 7]} ${new Date(detail.date + "T12:00:00").getDate()}.${new Date(detail.date + "T12:00:00").getMonth() + 1} ${detail.start}–${detail.end}` : ""} />
    </View>
  );
}

function ShiftCard({ s, color, tag, showWho, onPress }: { s: SchedShift; color: string; tag?: string; showWho?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ borderRadius: 14, padding: 12, paddingHorizontal: 14, backgroundColor: color, opacity: pressed ? 0.88 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {showWho ? <Avatar name={s.empName ?? "?"} size={32} color="rgba(255,255,255,.25)" /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="bold" size={15} color="#fff" style={{ fontVariant: ["tabular-nums"] }}>{s.start}–{s.end}{s.dur ? ` · ${s.dur}` : ""}</Txt>
          <Txt size={12.5} color="rgba(255,255,255,.92)" numberOfLines={1}>{showWho ? `${s.empName} · ` : ""}{[s.typeName, s.dept].filter(Boolean).join(" · ") || "Vakt"}</Txt>
        </View>
        {tag ? <View style={{ backgroundColor: "rgba(255,255,255,.22)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Txt weight="bold" size={11} color="#fff">{tag}</Txt></View> : null}
      </View>
    </Pressable>
  );
}

function ShiftDetail({ shift, all, color, onClose, onApply, applied, onOffer, onCant, onMessage }: {
  shift: SchedShift | null; all: SchedShift[]; color: string; onClose: () => void; onApply: (s: SchedShift) => void; applied: boolean;
  onOffer: () => void; onCant: () => void; onMessage: (empName: string) => void;
}) {
  const { me } = useMe();
  if (!shift) return null;
  const d = new Date(shift.date + "T12:00:00");
  const co = coworkersOf(all, shift);
  const est = me && shift.mine ? estimateShift(me, shift.date, shift.start, shift.end) : null;
  return (
    <Sheet open onClose={onClose}>
      <View style={{ backgroundColor: color, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginTop: -6 }}>
        <View style={{ backgroundColor: "rgba(255,255,255,.18)", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, minWidth: 54, alignItems: "center" }}>
          <Txt weight="bold" size={24} color="#fff" style={{ lineHeight: 26 }}>{d.getDate()}</Txt>
          <Txt size={11} weight="bold" color="#fff">{DAY_L[(d.getDay() + 6) % 7].toUpperCase()}</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="bold" size={20} color="#fff" style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}>{shift.start && shift.end ? `${shift.start}–${shift.end} · ${shift.dur}` : "Opin vakt"}</Txt>
          <Txt size={13.5} color="rgba(255,255,255,.92)">{[shift.typeName, shift.dept].filter(Boolean).join(" · ") || "Vakt"}</Txt>
        </View>
        <Pressable onPress={onClose} hitSlop={10}><X color="#fff" size={22} /></Pressable>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        <KV k="Starfsmaður" v={shift.open ? <Pill tone="brand" label="Laus til umsóknar" /> : <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Avatar name={shift.empName ?? "?"} size={26} /><Txt weight="bold" size={14.5}>{shift.empName ?? "—"}</Txt></View>} />
        <KV k="Dagsetning" v={`${DAY_FULL[(d.getDay() + 6) % 7]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`} />
        {shift.dept ? <KV k="Deild" v={shift.dept} /> : null}
        <KV k="Samstarfsfólk" last v={co.length ? <AvatarStack people={co.map((c) => ({ name: c.empName ?? "?" }))} /> : <Muted>Enginn á sama tíma</Muted>} />
      </Card>
      {co.length ? (
        <Card style={{ paddingVertical: 4 }}>
          <View style={{ paddingVertical: 10 }}><Eyebrow>Á vakt á sama tíma</Eyebrow></View>
          {co.slice(0, 10).map((c, i) => (
            <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line2 }}>
              <Avatar name={c.empName ?? "?"} size={30} />
              <Txt weight="semibold" size={14} style={{ flex: 1 }} numberOfLines={1}>{c.empName}</Txt>
              <Muted size={12.5}>{c.start}–{c.end}</Muted>
            </View>
          ))}
        </Card>
      ) : null}
      {est ? (
        <View style={{ backgroundColor: colors.brandSoft, borderRadius: 18, padding: 16 }}>
          <Eyebrow color={colors.brandDeep}>Áætluð laun fyrir vaktina</Eyebrow>
          <Txt weight="bold" size={28} style={{ letterSpacing: -0.6, marginTop: 4, fontVariant: ["tabular-nums"] }}>{kr(est.total)}</Txt>
          <Txt size={12.5} color={colors.brandDeep}>Dagvinna {kr(est.base)}{est.extra ? ` · ${est.label} ${kr(est.extra)}` : ` · ${est.label}`}{me?.union ? ` · ${me.union}` : ""}</Txt>
        </View>
      ) : null}
      {shift.open ? (
        <Btn title={applied ? "Umsókn í bið hjá vaktstjóra" : "Sækja um þessa vakt"} size="lg" disabled={applied} onPress={() => onApply(shift)} />
      ) : shift.mine ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn title="Bjóða vakt" variant="ghost" icon={<ArrowLeftRight color={colors.ink} size={17} />} style={{ flex: 1 }} onPress={onOffer} />
          <Btn title="Get ekki mætt" variant="danger" style={{ flex: 1 }} onPress={onCant} />
        </View>
      ) : (
        <Btn title={`Senda ${(shift.empName ?? "").split(/\s+/)[0]} skilaboð`} variant="ghost" icon={<MessageCircle color={colors.ink} size={17} />} onPress={() => onMessage(shift.empName ?? "")} />
      )}
    </Sheet>
  );
}
