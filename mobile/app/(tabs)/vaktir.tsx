// Vaktir — Sling-style: viku-strip, Mínar / Allir / Lausar, vaktar-detail með
// samstarfsfólki. Litir fylgja vaktategund/deild.
import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable, Modal, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ChevronLeft, ChevronRight, ChevronRight as Chev, CalendarDays, Clock, MapPin,
  Users, UserRound, Tag, X,
} from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Pill, Btn, Avatar } from "../../src/components/ui";
import { colors, radius, cardShadow } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import {
  getWeekShifts, weekHoursOf, coworkersOf, iso, mondayOf, type SchedShift,
} from "../../src/lib/api/schedule";
import { applyForShift, listMyRequests, type MyRequest } from "../../src/lib/api/requests";
import { dec1 } from "../../src/lib/format";

const DAY_L = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
const DAY_FULL = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const STATUS_PILL: Record<MyRequest["status"], { label: string; tone: "warn" | "good" | "bad" }> = {
  pending: { label: "Í bið", tone: "warn" },
  approved: { label: "Samþykkt", tone: "good" },
  rejected: { label: "Hafnað", tone: "bad" },
};
const soft = (hex: string) => hex + "1f"; // ~12% alpha tint of the shift color

type Tab = "mine" | "all" | "open";

export default function Vaktir() {
  const { me } = useMe();
  const router = useRouter();
  const todayISO = iso(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selDate, setSelDate] = useState(todayISO);
  const [tab, setTab] = useState<Tab>("mine");
  const [shifts, setShifts] = useState<SchedShift[]>([]);
  const [reqs, setReqs] = useState<MyRequest[]>([]);
  const [detail, setDetail] = useState<SchedShift | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!me) return;
    const [s, r] = await Promise.all([getWeekShifts(me, weekStart), listMyRequests(me)]);
    setShifts(s);
    setReqs(r);
  }, [me, weekStart]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return iso(d);
    });
  }, [weekStart]);

  const mineByDay = useMemo(() => {
    const m = new Map<string, SchedShift[]>();
    for (const s of shifts) if (s.mine) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [shifts]);

  const allOnSel = useMemo(
    () => shifts.filter((s) => s.date === selDate && !s.open),
    [shifts, selDate]
  );
  const openShifts = useMemo(() => shifts.filter((s) => s.open), [shifts]);
  const myHours = me ? weekHoursOf(shifts, me.empId) : 0;

  function moveWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
    setSelDate(iso(d));
  }
  function goToday() {
    setWeekStart(mondayOf(new Date()));
    setSelDate(todayISO);
  }

  async function apply(s: SchedShift) {
    if (!me || applied.has(s.id)) return;
    setApplied((x) => new Set(x).add(s.id));
    const d = new Date(s.date + "T12:00:00");
    await applyForShift(me, `${DAY_L[(d.getDay() + 6) % 7]} ${d.getDate()}.${d.getMonth() + 1} ${s.start ?? ""}–${s.end ?? ""}`);
    setDetail(null);
  }

  const midD = new Date(days[3] + "T12:00:00");
  const monthLabel = `${MONTHS[midD.getMonth()]} ${midD.getFullYear()}`;
  const isThisWeek = days.includes(todayISO);

  return (
    <Screen
      title="Vaktir"
      subtitle={monthLabel}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
    >
      {/* week navigation + day strip */}
      <Card style={{ padding: 10, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => moveWeek(-1)} hitSlop={8} style={{ padding: 4 }}>
            <ChevronLeft color={colors.ink2} size={20} />
          </Pressable>
          <Txt weight="semibold" size={13} style={{ flex: 1, textAlign: "center" }}>
            {new Date(days[0] + "T12:00:00").getDate()}.–{new Date(days[6] + "T12:00:00").getDate()}. {MONTHS[midD.getMonth()]}
          </Txt>
          {!isThisWeek ? (
            <Pressable onPress={goToday} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft }}>
              <Txt weight="medium" size={12} color={colors.brandDeep}>Í dag</Txt>
            </Pressable>
          ) : null}
          <Pressable onPress={() => moveWeek(1)} hitSlop={8} style={{ padding: 4 }}>
            <ChevronRight color={colors.ink2} size={20} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {days.map((d, i) => {
            const on = d === selDate;
            const today = d === todayISO;
            const hasMine = mineByDay.has(d);
            const num = new Date(d + "T12:00:00").getDate();
            return (
              <Pressable
                key={d}
                onPress={() => { setSelDate(d); if (tab === "mine") setTab("all"); }}
                style={{
                  alignItems: "center", paddingVertical: 6, width: 42, borderRadius: 12,
                  backgroundColor: on ? colors.brand : today ? colors.brandSoft : "transparent",
                }}
              >
                <Txt size={10} weight="medium" color={on ? "#ffffffcc" : colors.ink3}>{DAY_L[i]}</Txt>
                <Txt size={15} weight={on || today ? "semibold" : "regular"} color={on ? "#fff" : today ? colors.brandDeep : colors.ink}>
                  {num}
                </Txt>
                <View style={{
                  width: 5, height: 5, borderRadius: 3, marginTop: 2,
                  backgroundColor: hasMine ? (on ? "#fff" : colors.brand) : "transparent",
                }} />
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* sub-tabs */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {([["mine", "Mínar vaktir"], ["all", "Allir"], ["open", `Lausar${openShifts.length ? ` (${openShifts.length})` : ""}`]] as [Tab, string][]).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={{
              flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.control,
              backgroundColor: tab === k ? colors.ink : colors.panel,
              borderWidth: 1, borderColor: tab === k ? colors.ink : colors.line,
            }}
          >
            <Txt weight="semibold" size={13} color={tab === k ? "#fff" : colors.ink2}>{label}</Txt>
          </Pressable>
        ))}
      </View>

      {/* MÍNAR — week list */}
      {tab === "mine" && (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Txt weight="semibold" size={15}>Vikan mín</Txt>
            <Muted>{dec1(myHours)} klst</Muted>
          </View>
          {days.map((d, i) => {
            const mine = mineByDay.get(d) ?? [];
            const today = d === todayISO;
            const num = new Date(d + "T12:00:00").getDate();
            return (
              <View key={d} style={{ flexDirection: "row", gap: 10, paddingVertical: 5, alignItems: mine.length ? "flex-start" : "center" }}>
                <View style={{ width: 40, alignItems: "center" }}>
                  <Txt weight={today ? "bold" : "semibold"} size={16} color={today ? colors.brand : colors.ink}>{num}</Txt>
                  <Txt size={10} color={today ? colors.brand : colors.ink3}>{DAY_L[i].toUpperCase()}</Txt>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {mine.length ? mine.map((s) => (
                    <Pressable key={s.id} onPress={() => setDetail(s)}>
                      <View style={{
                        borderRadius: 12, padding: 11, backgroundColor: soft(s.color),
                        borderLeftWidth: 4, borderLeftColor: s.color,
                      }}>
                        <Txt weight="semibold" size={14}>{s.start}–{s.end} · {s.dur}</Txt>
                        <Muted size={12}>{[s.typeName, s.dept].filter(Boolean).join(" · ") || "Vakt"}</Muted>
                      </View>
                    </Pressable>
                  )) : (
                    <Muted size={13}>{today ? "Engin vakt í dag — slakaðu á." : "Engin vakt."}</Muted>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* ALLIR — everyone on the selected day */}
      {tab === "all" && (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
            <Txt weight="semibold" size={15}>
              {DAY_L[(new Date(selDate + "T12:00:00").getDay() + 6) % 7]} {new Date(selDate + "T12:00:00").getDate()}. — allar vaktir
            </Txt>
            <Muted>{allOnSel.length}</Muted>
          </View>
          {allOnSel.length === 0 ? <Muted>Engar vaktir á plani þennan dag.</Muted> : null}
          {allOnSel.map((s) => (
            <Pressable key={s.id} onPress={() => setDetail(s)}>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 12, padding: 11,
                backgroundColor: s.mine ? soft(s.color) : colors.panel,
                borderWidth: 1, borderColor: s.mine ? "transparent" : colors.line,
                borderLeftWidth: 4, borderLeftColor: s.color,
              }}>
                <Avatar name={s.empName ?? "?"} size={34} bg={soft(s.color)} fg={s.color} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="semibold" size={14} numberOfLines={1}>
                    {s.empName}{s.mine ? "  ·  þú" : ""}
                  </Txt>
                  <Muted size={12}>{[s.typeName, s.dept].filter(Boolean).join(" · ") || "Vakt"}</Muted>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt weight="medium" size={13}>{s.start}–{s.end}</Txt>
                  <Muted size={11}>{s.dur}</Muted>
                </View>
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      {/* LAUSAR — open shifts this week */}
      {tab === "open" && (
        <Card style={{ gap: 8 }}>
          <Txt weight="semibold" size={15} style={{ marginBottom: 2 }}>Lausar vaktir vikunnar</Txt>
          {openShifts.length === 0 ? <Muted>Engar lausar vaktir í boði þessa viku.</Muted> : null}
          {openShifts.map((s) => {
            const d = new Date(s.date + "T12:00:00");
            return (
              <Pressable key={s.id} onPress={() => setDetail(s)}>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 12, padding: 11,
                  backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line,
                  borderLeftWidth: 4, borderLeftColor: s.color,
                }}>
                  <View style={{ flex: 1 }}>
                    <Txt weight="semibold" size={14}>
                      {DAY_L[(d.getDay() + 6) % 7]} {d.getDate()}.{d.getMonth() + 1} · {s.start ?? "?"}–{s.end ?? "?"}
                    </Txt>
                    <Muted size={12}>{[s.typeName, s.dept, s.dur].filter(Boolean).join(" · ") || "Opin vakt"}</Muted>
                  </View>
                  <Btn
                    title={applied.has(s.id) ? "Sótt um" : "Sækja um"}
                    variant={applied.has(s.id) ? "ghost" : "primary"}
                    disabled={applied.has(s.id)}
                    style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                    onPress={() => apply(s)}
                  />
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}

      {/* requests entry + list (kept from v1) */}
      <Pressable onPress={() => router.push("/beidnir")}>
        <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Txt weight="semibold" size={15}>Ný beiðni</Txt>
            <Muted>Orlof, veikindi, vaktaskipti eða aðgengi</Muted>
          </View>
          <Chev color={colors.ink3} size={20} />
        </Card>
      </Pressable>
      {reqs.length > 0 && (
        <Card style={{ gap: 10 }}>
          <Txt weight="semibold" size={15}>Beiðnirnar mínar</Txt>
          {reqs.slice(0, 6).map((r) => (
            <View key={r.kind + r.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Txt size={13} weight="medium" numberOfLines={1} style={{ flex: 1 }}>{r.label}</Txt>
              <Pill label={STATUS_PILL[r.status].label} tone={STATUS_PILL[r.status].tone} />
            </View>
          ))}
        </Card>
      )}

      {/* shift detail */}
      <ShiftDetail
        shift={detail}
        all={shifts}
        onClose={() => setDetail(null)}
        onApply={apply}
        applied={detail ? applied.has(detail.id) : false}
      />
    </Screen>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Muted size={11}>{label}</Muted>
        <Txt weight="medium" size={14}>{value}</Txt>
      </View>
    </View>
  );
}

function ShiftDetail({ shift, all, onClose, onApply, applied }: {
  shift: SchedShift | null;
  all: SchedShift[];
  onClose: () => void;
  onApply: (s: SchedShift) => void;
  applied: boolean;
}) {
  if (!shift) return null;
  const d = new Date(shift.date + "T12:00:00");
  const dateLabel = `${DAY_FULL[(d.getDay() + 6) % 7]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  const co = coworkersOf(all, shift);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(15,16,20,.45)" }} onPress={onClose} />
      <View style={{
        backgroundColor: colors.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingBottom: 34, maxHeight: "82%", ...cardShadow,
      }}>
        {/* colored header — Sling-style */}
        <View style={{
          backgroundColor: shift.color, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 14,
        }}>
          <View style={{ alignItems: "center", minWidth: 44 }}>
            <Txt weight="bold" size={24} color="#fff">{d.getDate()}</Txt>
            <Txt size={11} color="#ffffffcc">{DAY_L[(d.getDay() + 6) % 7]}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="bold" size={17} color="#fff">
              {shift.start && shift.end ? `${shift.start}–${shift.end} · ${shift.dur}` : "Opin vakt"}
            </Txt>
            <Txt size={13} color="#ffffffd9">
              {[shift.typeName, shift.dept].filter(Boolean).join(" · ") || "Vakt"}
            </Txt>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <X color="#fff" size={22} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 8 }}>
          <DetailRow
            icon={<UserRound color={colors.ink3} size={19} />}
            label="Starfsmaður"
            value={shift.open ? "Opin vakt — laus til umsóknar" : (shift.empName ?? "—")}
          />
          <View style={{ height: 1, backgroundColor: colors.line2 }} />
          <DetailRow icon={<CalendarDays color={colors.ink3} size={19} />} label="Dagsetning" value={dateLabel} />
          <View style={{ height: 1, backgroundColor: colors.line2 }} />
          <DetailRow
            icon={<Clock color={colors.ink3} size={19} />}
            label="Tími"
            value={shift.start && shift.end ? `${shift.start}–${shift.end} · ${shift.dur}` : "Sveigjanlegur"}
          />
          {shift.typeName ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.line2 }} />
              <DetailRow icon={<Tag color={colors.ink3} size={19} />} label="Vaktategund" value={shift.typeName} />
            </>
          ) : null}
          {shift.dept ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.line2 }} />
              <DetailRow icon={<MapPin color={colors.ink3} size={19} />} label="Deild" value={shift.dept} />
            </>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.line2 }} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 9 }}>
            <Users color={colors.ink3} size={19} style={{ marginTop: 3 }} />
            <View style={{ flex: 1 }}>
              <Muted size={11}>Samstarfsfólk á vaktinni · {co.length}</Muted>
              {co.length === 0 ? (
                <Txt weight="medium" size={14}>Enginn annar á sama tíma</Txt>
              ) : (
                <View style={{ gap: 7, marginTop: 6 }}>
                  {co.slice(0, 8).map((c) => (
                    <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                      <Avatar name={c.empName ?? "?"} size={28} bg={soft(c.color)} fg={c.color} />
                      <Txt size={13} weight="medium" style={{ flex: 1 }} numberOfLines={1}>{c.empName}</Txt>
                      <Muted size={12}>{c.start}–{c.end}</Muted>
                    </View>
                  ))}
                  {co.length > 8 ? <Muted size={12}>+{co.length - 8} í viðbót</Muted> : null}
                </View>
              )}
            </View>
          </View>
          {shift.open ? (
            <Btn
              title={applied ? "Sótt um — vaktstjóri fer yfir" : "Sækja um þessa vakt"}
              disabled={applied}
              style={{ marginTop: 10 }}
              onPress={() => onApply(shift)}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
