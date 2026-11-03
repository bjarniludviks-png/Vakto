// Beiðnir — mínar beiðnir og staða þeirra efst, svo ný beiðni: orlof/veikindi/ólaunað, vaktaskipti, aðgengi.
import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { tr } from "../src/lib/i18n";
import { View, TextInput, Pressable } from "react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Btn, SectionTitle, useToast } from "../src/components/ui";
import { colors, radius, font, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import {
  submitLeaveRequest,
  requestShiftSwap,
  setAvailability,
  listMyRequests,
  type MyRequest,
} from "../src/lib/api/requests";
import { iso } from "../src/lib/api/me";

const inputStyle = () => ({
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.control,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  fontFamily: font.regular,
  color: colors.ink,
  backgroundColor: colors.panel,
} as const);

type LeaveType = "orlof" | "veikindi" | "olaunad";
const LEAVE_TYPES: { key: LeaveType; label: string }[] = [
  { key: "orlof", label: "Orlof" },
  { key: "veikindi", label: "Veikindi" },
  { key: "olaunad", label: "Ólaunað" },
];
const WEEKDAYS = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];

function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T | T[];
  onChange: (k: T) => void;
}) {
  const active = (k: T) => (Array.isArray(value) ? value.includes(k) : value === k);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={String(o.key)}
          onPress={() => onChange(o.key)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: radius.pill,
            backgroundColor: active(o.key) ? colors.brand : colors.line2,
          }}
        >
          <Txt weight="medium" size={13} color={active(o.key) ? "#fff" : colors.ink2}>
            {o.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

export default function Beidnir() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [mine, setMine] = useState<MyRequest[] | null>(null);
  const loadMine = useCallback(() => { if (me) listMyRequests(me).then(setMine).catch(() => setMine([])); }, [me]);
  useFocusEffect(useCallback(() => { loadMine(); }, [loadMine]));

  // leave
  const today = iso(new Date());
  const [leaveType, setLeaveType] = useState<LeaveType>("orlof");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [leaveBusy, setLeaveBusy] = useState(false);

  // swap
  const [swapNote, setSwapNote] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);

  // availability
  const [days, setDays] = useState<number[]>([]);
  const [availBusy, setAvailBusy] = useState(false);

  // Svarið birtist alltaf (skilaboð neðst) — áður í korti efst sem gat verið utan skjás.
  function flash(t: string, ok = true) {
    toast(t);
    if (ok) loadMine();
  }

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) && /^\d{4}-\d{2}-\d{2}$/.test(toDate);

  return (
    <Screen title="Beiðnir" back>
      <Card style={{ gap: 10 }}>
        <SectionTitle>Mínar beiðnir</SectionTitle>
        {mine === null ? <Muted size={13}>Sæki…</Muted> : null}
        {mine && mine.length === 0 ? <Muted size={13}>Engar beiðnir enn.</Muted> : null}
        {(mine ?? []).slice(0, 12).map((r) => {
          const st = r.status === "approved" ? { t: "Samþykkt", c: colors.good, bg: colors.goodSoft } : r.status === "rejected" ? { t: "Hafnað", c: colors.bad, bg: colors.badSoft } : { t: "Í bið", c: colors.ink2, bg: colors.panel2 };
          return (
            <View key={`${r.kind}-${r.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Txt size={13.5} style={{ flex: 1 }} numberOfLines={2}>{r.label}</Txt>
              <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Txt size={12} weight="semibold" color={st.c}>{tr(st.t)}</Txt></View>
            </View>
          );
        })}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle>Leyfisbeiðni</SectionTitle>
        <Seg options={LEAVE_TYPES} value={leaveType} onChange={setLeaveType} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Muted size={12}>Frá (ÁÁÁÁ-MM-DD)</Muted>
            <TextInput style={inputStyle()} value={fromDate} onChangeText={setFromDate} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Muted size={12}>Til</Muted>
            <TextInput style={inputStyle()} value={toDate} onChangeText={setToDate} />
          </View>
        </View>
        <Btn
          title="Senda leyfisbeiðni"
          loading={leaveBusy}
          disabled={!dateOk}
          onPress={async () => {
            if (!me) return;
            setLeaveBusy(true);
            const r = await submitLeaveRequest(me, { fromDate, toDate, type: leaveType });
            setLeaveBusy(false);
            flash(r.ok ? "Leyfisbeiðni send — vaktstjóri fer yfir hana." : (r.error ?? "Villa"), r.ok);
          }}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle>Vaktaskipti</SectionTitle>
        <Muted size={13}>Lýstu hvaða vakt þú vilt skipta og hvenær.</Muted>
        <TextInput
          style={[inputStyle(), { minHeight: 70, textAlignVertical: "top" }]}
          multiline
          value={swapNote}
          onChangeText={setSwapNote}
          placeholder={tr("T.d. Get ekki tekið vaktina fös 22.8 — óska eftir skiptum")}
          placeholderTextColor={colors.ink3}
        />
        <Btn
          title="Óska eftir vaktaskiptum"
          loading={swapBusy}
          disabled={!swapNote.trim()}
          onPress={async () => {
            if (!me) return;
            setSwapBusy(true);
            const r = await requestShiftSwap(me, swapNote.trim());
            setSwapBusy(false);
            if (r.ok) setSwapNote("");
            flash(r.ok ? "Beiðni um vaktaskipti send." : (r.error ?? "Villa"), r.ok);
          }}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle>Aðgengi</SectionTitle>
        <Muted size={13}>Hvaða dagar henta þér best á vaktir?</Muted>
        <Seg
          options={WEEKDAYS.map((label, i) => ({ key: i, label }))}
          value={days}
          onChange={(d) =>
            setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
          }
        />
        <Btn
          title="Vista aðgengi"
          loading={availBusy}
          disabled={days.length === 0}
          onPress={async () => {
            if (!me) return;
            setAvailBusy(true);
            const r = await setAvailability(me, { weekdays: [...days].sort() });
            setAvailBusy(false);
            flash(r.ok ? "Aðgengi vistað." : (r.error ?? "Villa"), r.ok);
          }}
        />
      </Card>
    </Screen>
  );
}
