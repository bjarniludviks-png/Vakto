// Mánaðarval með örvum (‹ október 2026 ›). offset 0 = þessi mánuður.
import React from "react";
import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Txt, Muted } from "./ui";
import { colors } from "../theme";
import { tr } from "../lib/i18n";

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export function monthRange(offset: number, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1); // ekki með
  return { from, to, label: `${tr(MONTHS[from.getMonth()])} ${from.getFullYear()}` };
}

export function MonthStepper({ offset, onChange, min = -24, max = 0 }: { offset: number; onChange: (o: number) => void; min?: number; max?: number }) {
  const { label } = monthRange(offset);
  const sub = offset === 0 ? tr("Þessi mánuður") : offset === -1 ? tr("Síðasti mánuður") : offset === 1 ? tr("Næsti mánuður") : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, paddingHorizontal: 6, paddingVertical: 6 }}>
      {offset > min ? (
        <Pressable accessibilityLabel={tr("Fyrri mánuður")} onPress={() => onChange(offset - 1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronLeft color={colors.ink2} size={22} />
        </Pressable>
      ) : <View style={{ width: 34 }} />}
      <Pressable onPress={() => onChange(0)} style={{ alignItems: "center" }}>
        <Txt weight="semibold" size={15}>{label}</Txt>
        {sub ? <Muted size={11.5}>{sub}</Muted> : null}
      </Pressable>
      {offset < max ? (
        <Pressable accessibilityLabel={tr("Næsti mánuður")} onPress={() => onChange(offset + 1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronRight color={colors.ink2} size={22} />
        </Pressable>
      ) : <View style={{ width: 34 }} />}
    </View>
  );
}
