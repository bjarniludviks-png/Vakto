// Heim → „Verkefnin þín í dag“ (0111): staðan, næstu óklárðu atriðin og „Sjá öll“.
// Atriði sem krefjast myndar eru hökuð á Verkefna-skjánum (myndavél).
import React from "react";
import { View, Pressable } from "react-native";
import { Check, Camera, ChevronRight } from "lucide-react-native";
import { Card, Txt, Muted, Eyebrow, Bar } from "./ui";
import { colors } from "../theme";
import { tr, trf } from "../lib/i18n";
import { counts, isLate, type DayTasks } from "../lib/tasks";

export type HomeTask = { kind: "item" | "adhoc"; id: string; title: string; done: boolean; due: string | null; photo: boolean; legacy?: boolean; sub?: string };

export function flatTasks(d: DayTasks): HomeTask[] {
  const out: HomeTask[] = [];
  for (const l of d.lists) for (const i of l.items) out.push({ kind: "item", id: i.id, title: i.title, done: i.done, due: l.due_time, photo: i.needs_photo, sub: l.name });
  for (const a of d.adhoc) out.push({ kind: "adhoc", id: a.id, title: a.title, done: a.done, due: a.due_time, photo: a.needs_photo, legacy: a.legacy, sub: a.from_name ? trf("fyrir {x}", a.from_name.split(" ")[0]) : undefined });
  return out;
}

export function TodayTasksCard({ day, onToggle, onOpen }: { day: DayTasks; onToggle: (t: HomeTask) => void; onOpen: () => void }) {
  const c = counts(day);
  if (c.total === 0 && day.roles.length === 0) return null;
  const now = new Date().toTimeString().slice(0, 5);
  const open = flatTasks(day).filter((x) => !x.done).sort((a, b) => (a.due ?? "99") .localeCompare(b.due ?? "99")).slice(0, 4);
  const handed = day.roles.filter((r) => r.via === "faert" || r.via === "vara");
  return (
    <Card>
      <Pressable onPress={onOpen} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Eyebrow>{tr("Verkefnin þín í dag")}</Eyebrow>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Muted>{c.done}/{c.total}</Muted><ChevronRight size={16} color={colors.ink3} /></View>
      </Pressable>
      {c.total > 0 ? <Bar value={c.done / c.total} color={c.done === c.total ? colors.good : colors.brand} /> : null}
      {handed.map((r) => (
        <View key={r.id} style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: r.via === "faert" ? colors.brandSoft : colors.warnSoft }}>
          <Txt size={13.5}><Txt weight="bold" size={13.5}>{r.name}</Txt> · {r.from_name ? trf("þú tekur við fyrir {x} í dag", r.from_name.split(" ")[0]) : tr("í dag")}</Txt>
        </View>
      ))}
      {c.total > 0 && c.done === c.total ? (
        <Txt weight="semibold" color={colors.good} style={{ marginTop: 10 }}>{tr("Allt klárað. Vel gert!")}</Txt>
      ) : open.map((t) => (
        <Pressable key={t.kind + t.id} accessibilityRole="checkbox" accessibilityState={{ checked: t.done }}
          onPress={() => (t.photo ? onOpen() : onToggle(t))}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: t.done ? colors.good : colors.line, backgroundColor: t.done ? colors.good : "transparent", alignItems: "center", justifyContent: "center" }}>
            {t.done ? <Check color="#fff" size={15} strokeWidth={3} /> : t.photo ? <Camera color={colors.ink3} size={13} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={15}>{t.title}</Txt>
            <Txt size={12} color={isLate(t.due, t.done, now, true) ? colors.bad : colors.ink3}>{[t.due ? trf("fyrir kl. {x}", t.due) : null, t.sub].filter(Boolean).join(" · ")}</Txt>
          </View>
        </Pressable>
      ))}
      {c.total - c.done > open.length ? (
        <Pressable onPress={onOpen} style={{ paddingTop: 6 }}><Txt size={13.5} weight="semibold" color={colors.brandDeep}>{trf("Sjá öll {n} verkefnin", c.total)}</Txt></Pressable>
      ) : null}
    </Card>
  );
}
