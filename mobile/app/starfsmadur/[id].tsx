// Starfsmaður — prófíll samstarfsmanns: vaktir vikunnar, skilaboð, hringja.
import React, { useCallback, useState } from "react";
import { tr } from "../../src/lib/i18n";
import { View, Linking } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle, Phone } from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Avatar, Btn, Eyebrow, KV, useToast } from "../../src/components/ui";
import { colors, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { supabase } from "../../src/lib/supabase";
import { startDM } from "../../src/lib/api/chat";
import { iso, mondayOf } from "../../src/lib/api/me";

const DAY_L = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];

export default function Starfsmadur() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [e, setE] = useState<{ name: string; role: string | null; dept: string | null; color: string | null; photo: string | null; phone: string | null; userId: string | null } | null>(null);
  const [shifts, setShifts] = useState<{ date: string; start: string; end: string }[]>([]);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    supabase.from("employees").select("full_name, title, avatar_color, photo_url, phone, user_id, positions(name), departments(name)").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const pos = (Array.isArray(data.positions) ? data.positions[0] : data.positions) as { name?: string } | null;
      const dep = (Array.isArray(data.departments) ? data.departments[0] : data.departments) as { name?: string } | null;
      setE({ name: data.full_name, role: data.title ?? pos?.name ?? null, dept: dep?.name ?? null, color: data.avatar_color, photo: data.photo_url, phone: data.phone, userId: data.user_id });
    });
    const mon = mondayOf(new Date()); const sun = new Date(mon); sun.setDate(sun.getDate() + 13);
    supabase.from("shifts").select("date, start_time, end_time").eq("employee_id", id).gte("date", iso(mon)).lte("date", iso(sun)).order("date").then(({ data }) => setShifts((data ?? []).filter((s) => s.start_time).map((s) => ({ date: s.date, start: s.start_time.slice(0, 5), end: (s.end_time ?? "").slice(0, 5) }))));
  }, [id]));

  async function message() {
    if (!me || !e) return;
    if (!e.userId) { toast(`${e.name.split(/\s+/)[0]} er ekki með aðgang að appinu`); return; }
    const r = await startDM(me, e.userId);
    if (r.ok && r.id) router.push(`/spjall/${r.id}?name=${encodeURIComponent(e.name)}`);
  }

  return (
    <Screen title={e?.name.split(/\s+/)[0] ?? "Starfsmaður"} back>
      {e ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 2 }}>
            <Avatar name={e.name} size={56} color={e.color} photo={e.photo} />
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={20} style={{ letterSpacing: -0.4 }}>{e.name}</Txt>
              <Muted>{[e.role, e.dept].filter(Boolean).join(" · ") || "Starfsmaður"}</Muted>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn title="Skilaboð" icon={<MessageCircle color="#fff" size={17} />} style={{ flex: 1 }} onPress={message} />
            <Btn title="Hringja" variant="ghost" icon={<Phone color={colors.ink} size={17} />} style={{ flex: 1 }} disabled={!e.phone} onPress={() => e.phone && Linking.openURL(`tel:${e.phone}`)} />
          </View>
          <Card style={{ paddingVertical: 8 }}>
            <View style={{ paddingVertical: 6 }}><Eyebrow>Vaktir næstu tvær vikur</Eyebrow></View>
            {shifts.length === 0 ? <Muted style={{ paddingVertical: 8 }}>Engar vaktir á plani.</Muted> : null}
            {shifts.map((s, i) => { const d = new Date(s.date + "T12:00:00"); return <KV key={s.date + s.start} k={`${tr(DAY_L[d.getDay()])} ${d.getDate()}.${d.getMonth() + 1}`} v={`${s.start}–${s.end}`} last={i === shifts.length - 1} />; })}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
