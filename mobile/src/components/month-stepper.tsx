// Tímabilsval með örvum (‹ október 2026 › eða ‹ 21. okt. – 20. nóv. ›). offset 0 = núverandi tímabil.
import React from "react";
import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Txt, Muted } from "./ui";
import { colors } from "../theme";
import { tr } from "../lib/i18n";

export function MonthStepper({ offset, onChange, label, calendar = true, min = -24, max = 0 }: { offset: number; onChange: (o: number) => void; label: string; calendar?: boolean; min?: number; max?: number }) {
  const sub = calendar
    ? (offset === 0 ? tr("Þessi mánuður") : offset === -1 ? tr("Síðasti mánuður") : offset === 1 ? tr("Næsti mánuður") : null)
    : (offset === 0 ? tr("Núverandi launatímabil") : offset === -1 ? tr("Síðasta launatímabil") : offset === 1 ? tr("Næsta launatímabil") : tr("Launatímabil"));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, paddingHorizontal: 6, paddingVertical: 6 }}>
      {offset > min ? (
        <Pressable accessibilityLabel={tr("Fyrra tímabil")} onPress={() => onChange(offset - 1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronLeft color={colors.ink2} size={22} />
        </Pressable>
      ) : <View style={{ width: 34 }} />}
      <Pressable onPress={() => onChange(0)} style={{ alignItems: "center" }}>
        <Txt weight="semibold" size={15}>{label}</Txt>
        {sub ? <Muted size={11.5}>{sub}</Muted> : null}
      </Pressable>
      {offset < max ? (
        <Pressable accessibilityLabel={tr("Næsta tímabil")} onPress={() => onChange(offset + 1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronRight color={colors.ink2} size={22} />
        </Pressable>
      ) : <View style={{ width: 34 }} />}
    </View>
  );
}
