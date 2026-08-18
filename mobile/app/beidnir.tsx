// Ný beiðni — orlof/veikindi/ólaunað, vaktaskipti, aðgengi.
import React, { useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Btn, SectionTitle } from "../src/components/ui";
import { colors, radius, font } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import {
  submitLeaveRequest,
  requestShiftSwap,
  setAvailability,
} from "../src/lib/api/requests";
import { iso } from "../src/lib/api/me";

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.control,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  fontFamily: font.regular,
  color: colors.ink,
  backgroundColor: colors.panel,
} as const;

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
  const { me } = useMe();
  const [msg, setMsg] = useState<string | null>(null);

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

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(null), 3500);
  }

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) && /^\d{4}-\d{2}-\d{2}$/.test(toDate);

  return (
    <Screen title="Ný beiðni" back>
      {msg ? (
        <Card style={{ backgroundColor: colors.goodSoft, borderColor: colors.good }}>
          <Txt color={colors.good} weight="medium" size={13}>
            {msg}
          </Txt>
        </Card>
      ) : null}

      <Card style={{ gap: 12 }}>
        <SectionTitle>Leyfisbeiðni</SectionTitle>
        <Seg options={LEAVE_TYPES} value={leaveType} onChange={setLeaveType} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Muted size={12}>Frá (ÁÁÁÁ-MM-DD)</Muted>
            <TextInput style={inputStyle} value={fromDate} onChangeText={setFromDate} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Muted size={12}>Til</Muted>
            <TextInput style={inputStyle} value={toDate} onChangeText={setToDate} />
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
            flash(r.ok ? "Leyfisbeiðni send — vaktstjóri fer yfir hana." : (r.error ?? "Villa"));
          }}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle>Vaktaskipti</SectionTitle>
        <Muted size={13}>Lýstu hvaða vakt þú vilt skipta og hvenær.</Muted>
        <TextInput
          style={[inputStyle, { minHeight: 70, textAlignVertical: "top" }]}
          multiline
          value={swapNote}
          onChangeText={setSwapNote}
          placeholder="T.d. Get ekki tekið vaktina fös 22.8 — óska eftir skiptum"
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
            flash(r.ok ? "Beiðni um vaktaskipti send." : (r.error ?? "Villa"));
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
            flash(r.ok ? "Aðgengi vistað." : (r.error ?? "Villa"));
          }}
        />
      </Card>
    </Screen>
  );
}
