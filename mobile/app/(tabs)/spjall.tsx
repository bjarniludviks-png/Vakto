// Spjall — samtalalisti í Messenger-stíl: leit, ólesið-sía, nýtt einka- eða hópspjall.
import { presenceLabel, type CoworkerStatus } from "../../src/lib/presence";
import { coworkerStatus } from "../../src/lib/api/presence";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { tr, trf } from "../../src/lib/i18n";
import { View, Pressable, ScrollView, RefreshControl, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SquarePen, MessageCircle, Hash, BellOff, Search, X, Users, UserRound, Check, ChevronLeft, Plus } from "lucide-react-native";
import { Header, IconBtn } from "../../src/components/screen";
import { Txt, Muted, Avatar, Sheet, Empty, Row, Btn, Seg, useToast } from "../../src/components/ui";
import { colors, font, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listConversations, listPeople, startDM, createGroup, subscribeChat, teamPicks, defaultGroupName, listMessages, type Conversation, type Person, type ChatMessage } from "../../src/lib/api/chat";
import { getMuted, onMuteChange, getDnd, dndLabel, toggleMute } from "../../src/lib/mute";
import { isManager } from "../../src/lib/api/ops";
import { AiAvatar } from "../../src/components/ai-avatar";

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

/** Mynd samtals: einkaspjall = manneskjan, # Almennt = brand-hringur, hópur = hópmynd eða upphafsstafir. */
function ConvAvatar({ c, size, dot }: { c: Conversation; size: number; dot?: "shift" | "online" | null }) {
  if (dot) return (
    <View style={{ width: size, height: size }}>
      <ConvAvatar c={c} size={size} />
      <View style={{ position: "absolute", right: 0, bottom: 0, width: size * 0.26, height: size * 0.26, borderRadius: size, borderWidth: 2, borderColor: colors.bg, backgroundColor: dot === "shift" ? colors.brand : colors.good }} />
    </View>
  );
  if (c.kind === "general") {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Hash color="#fff" size={Math.round(size * 0.44)} /></View>;
  }
  if (c.faces.length === 2) {
    // tvær skarandi myndir: síðasti sendandi framar, neðst til vinstri
    const f = Math.round(size * 0.68);
    return (
      <View style={{ width: size, height: size }}>
        <View style={{ position: "absolute", right: 0, top: 0 }}><Avatar name={c.faces[1].name} size={f} color={c.faces[1].color} photo={c.faces[1].photo} /></View>
        <View style={{ position: "absolute", left: 0, bottom: 0, borderRadius: f, borderWidth: 2, borderColor: colors.panel }}><Avatar name={c.faces[0].name} size={f} color={c.faces[0].color} photo={c.faces[0].photo} /></View>
      </View>
    );
  }
  return <Avatar name={c.name} size={size} color={c.color} photo={c.photo} />;
}

export default function Spjall() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  // „Á vakt“ (appelsínugult) / virk(ur) núna (grænt) á myndum í beinum skilaboðum (0099).
  const [pres, setPres] = useState<Record<string, CoworkerStatus>>({});
  const peerKey = (convs ?? []).map((c) => c.other?.userId).filter(Boolean).sort().join(",");
  useEffect(() => {
    if (!peerKey) return;
    let live = true;
    const get = () => coworkerStatus(peerKey.split(",")).then((m) => { if (live) setPres(m); }).catch(() => {});
    void get();
    const iv = setInterval(get, 60_000); // punktarnir fylgja stöðunni án þess að endurhlaða
    return () => { live = false; clearInterval(iv); };
  }, [peerKey]);
  const dotOf = (c: Conversation) => { const l = presenceLabel(c.other ? pres[c.other.userId] : null); return l.dot ? (l.tone === "shift" ? "shift" : "online") : null; };
  const [refreshing, setRefreshing] = useState(false);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [newMode, setNewMode] = useState<null | "pick" | "dm" | "group">(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [groupName, setGroupName] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // VAKTO AI fest efst hjá stjórnendum og vaktstjórum (eins og á vefnum)
  const [ai, setAi] = useState(false);
  useEffect(() => { isManager().then(setAi).catch(() => {}); }, [me]);

  const [dnd, setDnd] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => { getMuted().then((m) => setMuted(new Set(m))); getDnd().then(setDnd); };
    sync(); return onMuteChange(sync);
  }, []);
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
  // nýjustu samtölin — aðeins varaleið fyrir efstu röðina ef enginn er á vakt eða nýlega virk(ur)
  const pins = useMemo(() => (convs ?? []).slice(0, 8), [convs]);
  // Efsta röðin (eins og „Active“ í Messenger): á vakt núna → virk(ur) núna → í dag → í gær → síðustu dagar.
  // Fólk sem hefur falið virkni sína (show_presence) og er ekki á vakt kemur ekki fram.
  const [active, setActive] = useState<{ p: Person; s: CoworkerStatus }[]>([]);
  const loadActive = useCallback(async () => {
    if (!me) return;
    try {
      const all = await listPeople(me);
      const st = await coworkerStatus(all.slice(0, 300).map((p) => p.userId));
      const rank = (x: CoworkerStatus) => x.onShift ? 0 : x.active === "now" ? 1 : x.active === "today" ? 2 : x.active === "yesterday" ? 3 : x.active?.startsWith("days:") ? 3 + Number(x.active.slice(5)) : 99;
      setActive(all.map((p) => ({ p, s: st[p.userId] })).filter((x) => x.s && rank(x.s) <= 10)
        .sort((a, b) => rank(a.s) - rank(b.s) || a.p.name.localeCompare(b.p.name, "is")).slice(0, 15));
    } catch { /* efsta röðin fellur þá á nýjustu samtölin */ }
  }, [me]);
  useFocusEffect(useCallback(() => { loadActive(); const iv = setInterval(loadActive, 60_000); return () => clearInterval(iv); }, [loadActive]));
  // flýtival í hópavali: „+ Allir í <deild>“ / „+ Allir á <stað>“
  const teams = useMemo(() => teamPicks(people), [people]);
  const fallbackName = useMemo(() => defaultGroupName(people.filter((p) => sel.has(p.userId)).map((p) => p.name)), [people, sel]);

  // Forskoðun (haldið inni á samtali, eins og í Messenger): lesa nýjustu skilaboðin án þess að opna
  // þráðinn — listMessages merkir EKKI lesið, svo sendandinn sér ekki „séð“ og ólesið helst.
  const [peek, setPeek] = useState<Conversation | null>(null);
  const [peekMsgs, setPeekMsgs] = useState<ChatMessage[] | null>(null);
  async function openPeek(c: Conversation) {
    if (!me) return;
    setPeek(c); setPeekMsgs(null);
    try { const r = await listMessages(me, c.id); setPeekMsgs(r.messages.slice(-25)); } catch { setPeekMsgs([]); }
  }
  const peekBody = (m: ChatMessage) => m.kind === "image" ? tr("Mynd") : m.kind === "audio" ? tr("Talskilaboð") : m.kind === "file" ? (m.body || tr("Skjal")) : m.body;

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
    // heiti valfrjálst eins og í Messenger: autt → „Anna, Jón og 3 fleiri“
    const name = groupName.trim() || fallbackName;
    if (!me || !name || sel.size === 0) return;
    setBusy(true);
    const r = await createGroup(me, name, [...sel]);
    setBusy(false);
    if (!r.ok || !r.id) { toast(r.error ?? "Tókst ekki að stofna hóp"); return; }
    setNewMode(null);
    toast(trf("Hópurinn „{x}“ stofnaður", name));
    router.push(`/spjall/${r.id}?name=${encodeURIComponent(name)}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Spjall" right={
        <IconBtn label="Nýtt spjall" onPress={() => setNewMode("pick")}><SquarePen color={colors.ink} size={22} /></IconBtn>
      } />
      <View style={{ backgroundColor: colors.panel, paddingTop: 8, paddingBottom: 10, gap: 12 }}>
        {/* leit alltaf sýnileg (Messenger-pilla) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.panel2, borderRadius: 999, paddingHorizontal: 14, marginHorizontal: 16 }}>
          <Search color={colors.ink3} size={18} />
          <TextInput value={search ?? ""} onChangeText={(v) => setSearch(v)} placeholder={tr("Leita í spjalli…")} placeholderTextColor={colors.ink3} returnKeyType="search" style={{ flex: 1, paddingVertical: 11, fontSize: 16, fontFamily: font.regular, color: colors.ink }} />
          {search ? <Pressable onPress={() => setSearch(null)} hitSlop={8} accessibilityLabel={tr("Hreinsa")}><X color={colors.ink3} size={18} /></Pressable> : null}
        </View>
        {/* hringir: nýjustu samtölin (eins og efsta röðin í Messenger) */}
        {active.length && !search ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {ai ? (
              <Pressable onPress={() => router.push("/vakto-ai")} accessibilityLabel="VAKTO AI" style={({ pressed }) => ({ width: 66, alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}>
                <AiAvatar size={60} />
                <Txt size={12.5} color={colors.ink2} numberOfLines={1} style={{ maxWidth: 66, textAlign: "center" }}>VAKTO AI</Txt>
              </Pressable>
            ) : null}
            {active.map(({ p, s: st }) => {
              const l = presenceLabel(st);
              const conv = (convs ?? []).find((c) => c.kind === "dm" && c.other?.userId === p.userId);
              const un = !!conv && conv.unread > 0 && !muted.has(conv.id);
              return (
                <Pressable key={p.userId} onPress={() => conv ? router.push(`/spjall/${conv.id}?name=${encodeURIComponent(conv.name)}`) : dm(p)} accessibilityLabel={`${p.name}${l.text ? `, ${l.text}` : ""}`} style={({ pressed }) => ({ width: 66, alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}>
                  <View>
                    <Avatar name={p.name} size={60} color={p.color} photo={p.photo} />
                    {l.dot ? <View style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.panel, backgroundColor: l.tone === "shift" ? colors.brand : colors.good }} /> : null}
                  </View>
                  <Txt size={12.5} weight={un ? "semibold" : "regular"} color={un ? colors.ink : colors.ink2} numberOfLines={1} style={{ maxWidth: 66, textAlign: "center" }}>{p.name.split(/\s+/)[0]}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : pins.length && !search ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {ai ? (
              <Pressable onPress={() => router.push("/vakto-ai")} accessibilityLabel="VAKTO AI" style={({ pressed }) => ({ width: 66, alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}>
                <AiAvatar size={60} />
                <Txt size={12.5} color={colors.ink2} numberOfLines={1} style={{ maxWidth: 66, textAlign: "center" }}>VAKTO AI</Txt>
              </Pressable>
            ) : null}
            {pins.map((c) => {
              const un = c.unread > 0 && !muted.has(c.id);
              return (
                <Pressable key={c.id} onPress={() => router.push(`/spjall/${c.id}?name=${encodeURIComponent(c.name)}`)} accessibilityLabel={c.name} style={({ pressed }) => ({ width: 66, alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}>
                  <View>
                    <ConvAvatar c={c} size={60} dot={dotOf(c)} />
                    {un ? <View style={{ position: "absolute", right: 0, bottom: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.brand, borderWidth: 3, borderColor: colors.panel }} /> : null}
                  </View>
                  <Txt size={12.5} weight={un ? "semibold" : "regular"} color={un ? colors.ink : colors.ink2} numberOfLines={1} style={{ maxWidth: 66, textAlign: "center" }}>{c.kind === "dm" ? c.name.split(/\s+/)[0] : c.name}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <View style={{ paddingHorizontal: 16 }}>
          <Seg value={onlyUnread ? "unread" : "all"} onChange={(v) => setOnlyUnread(v === "unread")} items={[{ id: "all", label: "Allt" }, { id: "unread", label: `Ólesið${unreadTotal ? ` · ${unreadTotal}` : ""}` }]} />
        </View>
        {dnd ? (
          <Pressable onPress={() => router.push("/stillingar")} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.warnSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginHorizontal: 16 }}>
            <BellOff color={colors.warn} size={16} />
            <Txt weight="semibold" size={12.5} color={colors.warn} style={{ flex: 1 }}>{trf("Tilkynningar þaggaðar {x}", dndLabel(dnd))}</Txt>
            <Txt weight="bold" size={12.5} color={colors.warn}>Breyta</Txt>
          </Pressable>
        ) : null}
      </View>
      <ScrollView style={{ backgroundColor: colors.panel }} contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}>
        {convs && visible.length === 0 ? <Empty icon={<MessageCircle color={colors.brandDeep} size={26} />} title={onlyUnread ? "Allt lesið" : search ? "Ekkert fannst" : "Engin samtöl enn"} sub={onlyUnread ? "Engin ólesin skilaboð." : search ? "Prófaðu annað leitarorð." : "Búðu til hóp eða sendu einhverjum skilaboð."} /> : null}
        {convs && convs.length === 0 && !search && !onlyUnread ? (
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", paddingHorizontal: 16, marginTop: -16 }}>
            <Btn title="Nýr hópur" icon={<Users color="#fff" size={17} />} onPress={() => openNew("group")} />
            <Btn title="Ný skilaboð" variant="ghost" onPress={() => openNew("dm")} />
          </View>
        ) : null}
        {ai && !search && !onlyUnread ? (
          <Pressable onPress={() => router.push("/vakto-ai")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8, minHeight: 72, backgroundColor: pressed ? colors.panel2 : colors.panel })}>
            <AiAvatar size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="semibold" size={16}>VAKTO AI</Txt>
              <Txt size={14} color={colors.ink3} numberOfLines={1} style={{ marginTop: 3 }}>{tr("Spurðu um laun, tíma og vaktir")}</Txt>
            </View>
          </Pressable>
        ) : null}
        {visible.map((c) => {
          // Messenger-röð: 56px mynd, nafn + tími til hægri, síðustu skilaboð; ólesið = feitletrað + punktur
          const un = c.unread > 0 && !muted.has(c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/spjall/${c.id}?name=${encodeURIComponent(c.name)}`)}
              onLongPress={() => openPeek(c)} delayLongPress={350}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8, minHeight: 72, backgroundColor: pressed ? colors.panel2 : colors.panel })}
            >
              <ConvAvatar c={c} size={56} dot={dotOf(c)} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <Txt weight={un ? "bold" : "semibold"} size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{c.name}</Txt>
                  <Txt size={12.5} weight={un ? "bold" : "regular"} color={un ? colors.brandDeep : colors.ink3} style={{ fontVariant: ["tabular-nums"] }}>{when(c.lastAt)}</Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <Txt size={14} color={un ? colors.ink : colors.ink3} weight={un ? "semibold" : "regular"} numberOfLines={1} style={{ flex: 1 }}>
                    {c.last ? `${c.lastFrom && c.kind !== "dm" ? c.lastFrom + ": " : c.lastFrom === "Þú" ? "Þú: " : ""}${c.last}` : "Engin skilaboð enn"}
                  </Txt>
                  {muted.has(c.id) ? <BellOff color={colors.ink3} size={15} /> : un ? <View accessibilityLabel={trf("{n} ólesin", c.unread)} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Sheet open={newMode !== null} onClose={() => setNewMode(null)}>
        {newMode !== "pick" ? (
          <Pressable onPress={() => setNewMode("pick")} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: -4 }}>
            <ChevronLeft color={colors.brandDeep} size={18} /><Txt weight="bold" size={13} color={colors.brandDeep}>Til baka</Txt>
          </Pressable>
        ) : null}
        <Txt weight="bold" size={19} style={{ letterSpacing: -0.3 }}>{newMode === "group" ? "Nýr hópur" : newMode === "dm" ? "Einkaspjall" : "Nýtt spjall"}</Txt>

        {newMode === "pick" ? (
          <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
            <Row icon={<View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}><UserRound color={colors.brandDeep} size={19} /></View>} title="Einkaspjall" sub="Skilaboð til eins samstarfsmanns" onPress={() => openNew("dm")} />
            <Row icon={<View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.infoSoft, alignItems: "center", justifyContent: "center" }}><Users color={colors.info} size={19} /></View>} title="Nýr hópur" sub="Veldu nafn og meðlimi" onPress={() => openNew("group")} last />
          </View>
        ) : null}

        {newMode === "dm" ? (
          <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
            {people.length === 0 ? <Muted style={{ padding: 14 }}>Sæki samstarfsfólk…</Muted> : null}
            {people.map((p, i) => (
              <Row key={p.userId} icon={<Avatar name={p.name} size={38} color={p.color} photo={p.photo} />} title={p.name} sub={[p.role, p.dept].filter(Boolean).join(" · ") || "Starfsmaður"} onPress={() => dm(p)} chevron={false} last={i === people.length - 1} />
            ))}
          </View>
        ) : null}

        {newMode === "group" ? (
          <>
            <TextInput value={groupName} onChangeText={setGroupName} placeholder={fallbackName ? trf("{x} (valfrjálst)", fallbackName) : tr("Nafn hópsins, t.d. Helgarvaktin")} placeholderTextColor={colors.ink3} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, fontFamily: font.regular, color: colors.ink, backgroundColor: colors.panel2 }} />
            <Txt weight="bold" size={12} color={colors.ink3} style={{ letterSpacing: 0.8 }}>MEÐLIMIR · {sel.size} valdir</Txt>
            {teams.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {teams.map((tp) => {
                  const all = tp.userIds.every((u) => sel.has(u));
                  return (
                    <Pressable key={tp.key} disabled={all} accessibilityRole="button" onPress={() => setSel((s) => new Set([...s, ...tp.userIds]))}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: all ? "transparent" : colors.line, backgroundColor: all ? colors.brandSoft : pressed ? colors.panel2 : colors.panel })}>
                      {all ? <Check color={colors.brandDeep} size={14} /> : <Plus color={colors.ink2} size={14} />}
                      <Txt size={13} weight="semibold" color={all ? colors.brandDeep : colors.ink2}>{trf(tp.kind === "dept" ? "Allir í {x}" : "Allir á {x}", tp.name)}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
              {people.length === 0 ? <Muted style={{ padding: 14 }}>Sæki samstarfsfólk…</Muted> : null}
              {people.map((p, i) => {
                const on = sel.has(p.userId);
                return (
                  <Row key={p.userId} icon={<Avatar name={p.name} size={38} color={p.color} photo={p.photo} />} title={p.name} sub={[p.role, p.dept].filter(Boolean).join(" · ") || "Starfsmaður"} last={i === people.length - 1}
                    onPress={() => setSel((s) => { const n = new Set(s); if (n.has(p.userId)) n.delete(p.userId); else n.add(p.userId); return n; })}
                    right={<View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? colors.brand : colors.line, backgroundColor: on ? colors.brand : "transparent", alignItems: "center", justifyContent: "center" }}>{on ? <Check color="#fff" size={14} /> : null}</View>} />
                );
              })}
            </View>
            <Btn title="Stofna hóp" size="lg" loading={busy} disabled={sel.size === 0} onPress={makeGroup} />
          </>
        ) : null}
      </Sheet>

      <Sheet open={!!peek} onClose={() => setPeek(null)} title={peek?.name}>
        <Muted size={12} style={{ textAlign: "center", marginBottom: 10 }}>{tr("Ekki merkt sem lesið")}</Muted>
        <View style={{ gap: 6, paddingBottom: 6 }}>
          {peekMsgs === null ? <Muted style={{ padding: 14, textAlign: "center" }}>…</Muted> : null}
          {peekMsgs?.length === 0 ? <Muted style={{ padding: 14, textAlign: "center" }}>{tr("Engin skilaboð enn")}</Muted> : null}
          {(peekMsgs ?? []).map((m, i, arr) => {
            const showName = !m.me && peek?.kind !== "dm" && arr[i - 1]?.senderId !== m.senderId;
            return (
              <View key={m.id} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                {showName ? <Txt size={11.5} color={colors.ink3} style={{ marginLeft: 4, marginBottom: 2 }}>{m.sender}</Txt> : null}
                <View style={{ backgroundColor: m.me ? colors.brand : colors.bubbleThem, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Txt size={15} color={m.me ? "#fff" : colors.ink} style={{ lineHeight: 20 }}>{peekBody(m)}</Txt>
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Btn title={tr("Opna spjall")} style={{ flex: 1 }} onPress={() => { const c = peek; setPeek(null); if (c) router.push(`/spjall/${c.id}?name=${encodeURIComponent(c.name)}`); }} />
          <Btn title={peek && muted.has(peek.id) ? tr("Kveikja á tilkynningum") : tr("Þagga")} variant="ghost" style={{ flex: 1 }} onPress={async () => { if (peek) { await toggleMute(peek.id); setPeek(null); } }} />
        </View>
      </Sheet>
    </View>
  );
}
