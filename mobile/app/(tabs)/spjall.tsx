// Spjall — samtalalisti í Messenger-stíl: leit, ólesið-sía, nýtt einka- eða hópspjall.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, RefreshControl, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Plus, MessageCircle, Hash, BellOff, Search, X, Users, UserRound, Check } from "lucide-react-native";
import { Header, IconBtn } from "../../src/components/screen";
import { Txt, Muted, Avatar, Sheet, Empty, Row, Btn, useToast } from "../../src/components/ui";
import { colors, font, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listConversations, listPeople, startDM, createGroup, subscribeChat, type Conversation, type Person } from "../../src/lib/api/chat";
import { getMuted, onMuteChange } from "../../src/lib/mute";

function when(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toTimeString().slice(0, 5);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Í gær";
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"][d.getDay()];
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export default function Spjall() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [newMode, setNewMode] = useState<null | "pick" | "dm" | "group">(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [groupName, setGroupName] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { getMuted().then((m) => setMuted(new Set(m))); return onMuteChange(() => getMuted().then((m) => setMuted(new Set(m)))); }, []);
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

  const visible = useMemo(() => {
    let list = convs ?? [];
    if (onlyUnread) list = list.filter((c) => c.unread > 0 && !muted.has(c.id));
    const q = (search ?? "").trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.last ?? "").toLowerCase().includes(q) || (c.other?.role ?? "").toLowerCase().includes(q));
    return list;
  }, [convs, onlyUnread, search, muted]);
  const unreadTotal = (convs ?? []).filter((c) => c.unread > 0 && !muted.has(c.id)).length;

  async function openNew(mode: "dm" | "group") {
    if (!me) return;
    setNewMode(mode); setSel(new Set()); setGroupName("");
    setPeople(await listPeople(me));
  }
  async function dm(p: Person) {
    if (!me) return;
    const r = await startDM(me, p.userId);
    setNewMode(null);
    if (r.ok && r.id) router.push(`/spjall/${r.id}?name=${encodeURIComponent(p.name)}`);
  }
  async function makeGroup() {
    if (!me || !groupName.trim() || sel.size === 0) return;
    setBusy(true);
    const r = await createGroup(me, groupName, [...sel]);
    setBusy(false);
    if (!r.ok || !r.id) { toast(r.error ?? "Tókst ekki að stofna hóp"); return; }
    setNewMode(null);
    toast(`Hópurinn „${groupName.trim()}“ stofnaður`);
    router.push(`/spjall/${r.id}?name=${encodeURIComponent(groupName.trim())}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Spjall" right={
        <View style={{ flexDirection: "row" }}>
          <IconBtn label="Leita" onPress={() => setSearch((s) => (s === null ? "" : null))}><Search color={search !== null ? colors.brand : colors.ink} size={22} /></IconBtn>
          <IconBtn label="Nýtt spjall" onPress={() => setNewMode("pick")}><Plus color={colors.ink} size={24} /></IconBtn>
        </View>
      } />
      <View style={{ backgroundColor: colors.panel, paddingHorizontal: 16, paddingBottom: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
        {search !== null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.panel2, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 }}>
            <Search color={colors.ink3} size={18} />
            <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Leita í spjalli…" placeholderTextColor={colors.ink3} style={{ flex: 1, paddingVertical: 10, fontSize: 15, fontFamily: font.regular, color: colors.ink }} />
            {search ? <Pressable onPress={() => setSearch("")} hitSlop={8}><X color={colors.ink3} size={18} /></Pressable> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([["all", "Allt"], ["unread", `Ólesið${unreadTotal ? ` · ${unreadTotal}` : ""}`]] as const).map(([k, l]) => {
            const on = (k === "unread") === onlyUnread;
            return (
              <Pressable key={k} onPress={() => setOnlyUnread(k === "unread")} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? colors.ink : colors.panel2, borderWidth: 1, borderColor: on ? colors.ink : colors.line }}>
                <Txt weight="bold" size={12.5} color={on ? colors.panel : colors.ink2}>{l}</Txt>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}>
        {convs && visible.length === 0 ? <Empty icon={<MessageCircle color={colors.brandDeep} size={26} />} title={onlyUnread ? "Allt lesið" : search ? "Ekkert fannst" : "Engin samtöl enn"} sub={onlyUnread ? "Engin ólesin skilaboð." : search ? "Prófaðu annað leitarorð." : "Ýttu á + til að byrja spjall."} /> : null}
        {visible.map((c, i, arr) => (
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
              <Txt size={13} color={c.unread && !muted.has(c.id) ? colors.ink : colors.ink2} weight={c.unread && !muted.has(c.id) ? "semibold" : "regular"} numberOfLines={1} style={{ marginTop: 2 }}>
                {c.last ? `${c.lastFrom && c.kind !== "dm" ? c.lastFrom + ": " : c.lastFrom === "Þú" ? "Þú: " : ""}${c.last}` : "Engin skilaboð enn"}
              </Txt>
            </View>
            {muted.has(c.id) ? <BellOff color={colors.ink3} size={16} /> : c.unread ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                <Txt weight="bold" size={11.5} color="#fff">{c.unread}</Txt>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Sheet open={newMode === "pick"} onClose={() => setNewMode(null)} title="Nýtt spjall" scroll={false}>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          <Row icon={<View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}><UserRound color={colors.brandDeep} size={19} /></View>} title="Einkaspjall" sub="Skilaboð til eins samstarfsmanns" onPress={() => openNew("dm")} />
          <Row icon={<View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.infoSoft, alignItems: "center", justifyContent: "center" }}><Users color={colors.info} size={19} /></View>} title="Nýr hópur" sub="Veldu nafn og meðlimi" onPress={() => openNew("group")} last />
        </View>
      </Sheet>

      <Sheet open={newMode === "dm"} onClose={() => setNewMode(null)} title="Einkaspjall">
        {people.length === 0 ? <Muted>Sæki samstarfsfólk…</Muted> : null}
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          {people.map((p, i) => (
            <Row key={p.userId} icon={<Avatar name={p.name} size={38} color={p.color} photo={p.photo} />} title={p.name} sub={[p.role, p.dept].filter(Boolean).join(" · ") || "Starfsmaður"} onPress={() => dm(p)} chevron={false} last={i === people.length - 1} />
          ))}
        </View>
      </Sheet>

      <Sheet open={newMode === "group"} onClose={() => setNewMode(null)} title="Nýr hópur">
        <TextInput value={groupName} onChangeText={setGroupName} placeholder="Nafn hópsins, t.d. Helgarvaktin" placeholderTextColor={colors.ink3} autoFocus style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, fontFamily: font.regular, color: colors.ink, backgroundColor: colors.panel2 }} />
        <Txt weight="bold" size={12} color={colors.ink3} style={{ letterSpacing: 0.8 }}>MEÐLIMIR · {sel.size} valdir</Txt>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          {people.map((p, i) => {
            const on = sel.has(p.userId);
            return (
              <Row key={p.userId} icon={<Avatar name={p.name} size={38} color={p.color} photo={p.photo} />} title={p.name} sub={[p.role, p.dept].filter(Boolean).join(" · ") || "Starfsmaður"} last={i === people.length - 1}
                onPress={() => setSel((s) => { const n = new Set(s); if (n.has(p.userId)) n.delete(p.userId); else n.add(p.userId); return n; })}
                right={<View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? colors.brand : colors.line, backgroundColor: on ? colors.brand : "transparent", alignItems: "center", justifyContent: "center" }}>{on ? <Check color="#fff" size={14} /> : null}</View>} />
            );
          })}
        </View>
        <Btn title="Stofna hóp" size="lg" loading={busy} disabled={!groupName.trim() || sel.size === 0} onPress={makeGroup} />
      </Sheet>
    </View>
  );
}
