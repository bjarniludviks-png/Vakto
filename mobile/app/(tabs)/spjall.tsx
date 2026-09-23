// Spjall — samtalalisti í Messenger-stíl: ólesið, síðustu skilaboð, nýtt spjall.
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Plus, MessageCircle, Hash } from "lucide-react-native";
import { Header, IconBtn } from "../../src/components/screen";
import { Txt, Muted, Avatar, Sheet, Empty, Row } from "../../src/components/ui";
import { colors } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listConversations, listPeople, startDM, subscribeChat, type Conversation, type Person } from "../../src/lib/api/chat";

function when(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toTimeString().slice(0, 5);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Í gær";
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"][d.getDay()];
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export default function Spjall() {
  const { me } = useMe();
  const router = useRouter();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);

  const load = useCallback(async () => {
    if (!me) return;
    try { setConvs(await listConversations(me)); } catch (e) { console.warn("chat", e); }
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!me) return;
    const ch = subscribeChat(() => load(), () => load());
    return () => { ch.unsubscribe(); };
  }, [me, load]);

  async function openNew() {
    if (!me) return;
    setNewOpen(true);
    setPeople(await listPeople(me));
  }
  async function dm(p: Person) {
    if (!me) return;
    const r = await startDM(me, p.userId);
    setNewOpen(false);
    if (r.ok && r.id) router.push(`/spjall/${r.id}?name=${encodeURIComponent(p.name)}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Spjall" right={<IconBtn label="Nýtt spjall" onPress={openNew}><Plus color={colors.ink} size={24} /></IconBtn>} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}>
        {convs && convs.length === 0 ? <Empty icon={<MessageCircle color={colors.brandDeep} size={26} />} title="Engin samtöl enn" sub="Ýttu á + til að byrja spjall við samstarfsfólk." /> : null}
        {(convs ?? []).map((c, i, arr) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/spjall/${c.id}?name=${encodeURIComponent(c.name)}`)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? colors.panel2 : colors.panel, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.line2 })}
          >
            {c.kind === "dm" ? (
              <Avatar name={c.name} size={50} color={c.color} photo={c.photo} />
            ) : c.kind === "general" ? (
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Hash color="#fff" size={24} /></View>
            ) : (
              <Avatar name={c.name} size={50} color={colors.info} photo={c.photo} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <Txt weight="bold" size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{c.name}</Txt>
                <Txt size={11.5} color={colors.ink3} style={{ fontVariant: ["tabular-nums"] }}>{when(c.lastAt)}</Txt>
              </View>
              <Txt size={13} color={c.unread ? colors.ink : colors.ink2} weight={c.unread ? "semibold" : "regular"} numberOfLines={1} style={{ marginTop: 2 }}>
                {c.last ? `${c.lastFrom && c.kind !== "dm" ? c.lastFrom + ": " : c.lastFrom === "Þú" ? "Þú: " : ""}${c.last}` : "Engin skilaboð enn"}
              </Txt>
            </View>
            {c.unread ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                <Txt weight="bold" size={11.5} color="#fff">{c.unread}</Txt>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Nýtt spjall">
        {people.length === 0 ? <Muted>Sæki samstarfsfólk…</Muted> : null}
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          {people.map((p, i) => (
            <Row key={p.userId} icon={<Avatar name={p.name} size={38} color={p.color} photo={p.photo} />} title={p.name} sub={[p.role, p.dept].filter(Boolean).join(" · ") || "Starfsmaður"} onPress={() => dm(p)} chevron={false} last={i === people.length - 1} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}
