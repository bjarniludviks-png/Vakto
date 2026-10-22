// Stjórnandi stimplar út starfsmann sem gleymdi því — notað á Heim og í Mælaborði.
import React, { useState } from "react";
import { View, TextInput } from "react-native";
import { tr, trf } from "../lib/i18n";
import { Txt, Muted, Avatar, Btn, Sheet, useToast } from "./ui";
import { colors, font } from "../theme";
import { managerClockOut, rangeLabel, addDays, type OnShift } from "../lib/api/ops";
import { iso } from "../lib/api/me";

const inputStyle = { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 22, fontFamily: font.semibold, color: colors.ink } as const;

/** Stjórnandi stimplar út starfsmann sem gleymdi því. Tíminn er í dag, eða í gær ef hann er ekki liðinn í dag. */
export function ClockOutSheet({ who, onClose, onDone }: { who: OnShift | null; onClose: () => void; onDone: () => void }) {
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
