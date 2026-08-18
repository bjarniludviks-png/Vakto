// Vaktir — næstu vaktir, opnar vaktir (sækja um), beiðnirnar mínar.
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CalendarPlus, ChevronRight } from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Pill, SectionTitle, Btn } from "../../src/components/ui";
import { colors } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { getMyArea, type MyArea } from "../../src/lib/api/me";
import { applyForShift, listMyRequests, type MyRequest } from "../../src/lib/api/requests";

const STATUS_PILL: Record<MyRequest["status"], { label: string; tone: "warn" | "good" | "bad" }> = {
  pending: { label: "Í bið", tone: "warn" },
  approved: { label: "Samþykkt", tone: "good" },
  rejected: { label: "Hafnað", tone: "bad" },
};

export default function Vaktir() {
  const { me } = useMe();
  const router = useRouter();
  const [area, setArea] = useState<MyArea | null>(null);
  const [reqs, setReqs] = useState<MyRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!me) return;
    const [a, r] = await Promise.all([getMyArea(me), listMyRequests(me)]);
    setArea(a);
    setReqs(r);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  async function apply(id: string, label: string, time: string) {
    if (!me || applied.has(id)) return;
    setApplied((s) => new Set(s).add(id));
    await applyForShift(me, `${label} ${time}`);
    load();
  }

  return (
    <Screen
      title="Vaktir"
      subtitle={area ? `Vikan ${area.weekLabel}` : undefined}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Card>
        <SectionTitle>Næstu vaktir</SectionTitle>
        {area && area.upcoming.length === 0 ? <Muted>Engar vaktir framundan á planinu.</Muted> : null}
        <View style={{ gap: 10 }}>
          {(area?.upcoming ?? []).map((u) => (
            <View
              key={u.date + u.time}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <Txt weight="medium" size={14}>
                {u.label}
              </Txt>
              <Muted>{u.time}</Muted>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>Opnar vaktir</SectionTitle>
        {area && area.openShifts.length === 0 ? <Muted>Engar opnar vaktir í boði.</Muted> : null}
        <View style={{ gap: 12 }}>
          {(area?.openShifts ?? []).map((s) => (
            <View
              key={s.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <CalendarPlus color={colors.brand} size={18} />
              <View style={{ flex: 1 }}>
                <Txt weight="medium" size={14}>
                  {s.label}
                </Txt>
                <Muted>{s.time}</Muted>
              </View>
              <Btn
                title={applied.has(s.id) ? "Sótt um" : "Sækja um"}
                variant={applied.has(s.id) ? "ghost" : "primary"}
                disabled={applied.has(s.id)}
                style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                onPress={() => apply(s.id, s.label, s.time)}
              />
            </View>
          ))}
        </View>
      </Card>

      <Pressable onPress={() => router.push("/beidnir")}>
        <Card
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View>
            <Txt weight="semibold" size={15}>
              Ný beiðni
            </Txt>
            <Muted>Orlof, veikindi, vaktaskipti eða aðgengi</Muted>
          </View>
          <ChevronRight color={colors.ink3} size={20} />
        </Card>
      </Pressable>

      <Card>
        <SectionTitle>Beiðnirnar mínar</SectionTitle>
        {reqs.length === 0 ? <Muted>Engar beiðnir ennþá.</Muted> : null}
        <View style={{ gap: 10 }}>
          {reqs.slice(0, 10).map((r) => (
            <View
              key={r.kind + r.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View style={{ flex: 1 }}>
                <Txt size={13} weight="medium" numberOfLines={1}>
                  {r.label}
                </Txt>
              </View>
              <Pill label={STATUS_PILL[r.status].label} tone={STATUS_PILL[r.status].tone} />
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
