// Spjallþráður — realtime, skilaboð flokkuð eftir sendanda, viðbrögð með
// löngu ýti, „séð af“, svar í þræði, skrifar-vísir.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Send, X, Hash, CornerUpLeft, Trash2, ImagePlus, MoreHorizontal, BellOff, Bell, Paperclip, FileText, Images, LogOut } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { Linking, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Txt, Muted, Avatar, Sheet, Row, useToast } from "../../src/components/ui";
import { uploadImage } from "../../src/lib/api/feed";
import { colors, font, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listMessages, sendChatMessage, sendChatImage, sendChatFile, uploadChatFile, listAttachments, leaveChannel, markChannelRead, type Attachment, setReaction, deleteMessage, subscribeChat, typingChannel, peopleMap, type ChatMessage, type ChannelRead } from "../../src/lib/api/chat";
import { supabase } from "../../src/lib/supabase";
import { isMuted, toggleMute } from "../../src/lib/mute";
import type { Person } from "../../src/lib/api/chat";

const EMOJI = ["❤️", "👍", "😂", "🙏", "🔥", "👀"];

type RowItem = { key: string; kind: "sep"; label: string } | { key: string; kind: "msg"; m: ChatMessage; first: boolean; last: boolean; showSender: boolean };

function dayLabel(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Í dag";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Í gær";
  return `${["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"][d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
}

export default function Thread() {
  useTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { me } = useMe();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<ChannelRead[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sel, setSel] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [members, setMembers] = useState(0);
  const [isGroup, setIsGroup] = useState(true);
  const [info, setInfo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [memberList, setMemberList] = useState<Person[]>([]);
  const [kind, setKind] = useState<string>("group");
  const [media, setMedia] = useState<Attachment[] | null>(null);
  async function openMedia() {
    if (!me || !id) return;
    setInfo(false); setMedia([]);
    setMedia(await listAttachments(me, id));
  }
  async function pickFile() {
    if (!me || !id) return;
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets[0]) return;
    const f = r.assets[0];
    setUploading(true);
    const up = await uploadChatFile(me, f.uri, f.name, f.mimeType ?? "application/octet-stream");
    if (!up.ok || !up.url) { setUploading(false); toast(up.error ?? "Skráin hlóðst ekki upp"); return; }
    const res = (f.mimeType ?? "").startsWith("image/") ? await sendChatImage(me, id, up.url) : await sendChatFile(me, id, up.url, f.name);
    setUploading(false);
    if (!res.ok) toast(res.error ?? "Tókst ekki að senda"); else load();
  }
  function leave() {
    if (!id) return;
    Alert.alert("Yfirgefa spjall", "Þú hættir að fá skilaboð úr þessu spjalli.", [{ text: "Hætta við", style: "cancel" }, { text: "Yfirgefa", style: "destructive", onPress: async () => { const r = await leaveChannel(id); if (!r.ok) { toast(r.error ?? "Tókst ekki"); return; } setInfo(false); router.back(); } }]);
  }
  async function openInfo() {
    if (!me || !id) return;
    setInfo(true);
    const people = await peopleMap(me.companyId);
    const { data: ch } = await supabase.from("channels").select("kind").eq("id", id).maybeSingle();
    if (ch?.kind === "general") setMemberList([...people.values()].sort((a, b) => a.name.localeCompare(b.name)));
    else { const { data: mem } = await supabase.from("channel_members").select("user_id").eq("channel_id", id); setMemberList((mem ?? []).map((m) => people.get(m.user_id)).filter(Boolean).sort((a, b) => a!.name.localeCompare(b!.name)) as Person[]); }
  }
  const list = useRef<FlatList>(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  async function pickAndSend() {
    if (!me || !id) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    setUploading(true);
    const up = await uploadImage(me, r.assets[0].uri, r.assets[0].uri.toLowerCase().endsWith(".png") ? "png" : "jpg");
    if (!up.ok || !up.url) { setUploading(false); toast(up.error ?? "Mynd hlóðst ekki upp"); return; }
    const res = await sendChatImage(me, id, up.url);
    setUploading(false);
    if (!res.ok) toast(res.error ?? "Tókst ekki að senda mynd");
    else load();
  }
  const typingRef = useRef<ReturnType<typeof typingChannel> | null>(null);
  const lastTyped = useRef(0);

  const load = useCallback(async () => {
    if (!me || !id) return;
    const r = await listMessages(me, id);
    setMsgs(r.messages);
    setReads(r.reads);
    markChannelRead(id).catch(() => {});
  }, [me, id]);

  useFocusEffect(useCallback(() => {
    load();
    if (id) isMuted(id).then(setMuted);
    supabase.from("channels").select("kind").eq("id", id).maybeSingle().then(async ({ data }) => {
      setIsGroup(data?.kind !== "dm"); setKind((data?.kind as string) ?? "group");
      if (data?.kind === "general" && me) { const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("company_id", me.companyId).not("user_id", "is", null); setMembers(count ?? 0); }
      else { const { count } = await supabase.from("channel_members").select("user_id", { count: "exact", head: true }).eq("channel_id", id); setMembers(count ?? 0); }
    });
  }, [load, id, me]));

  // realtime: nýtt skilaboð → mála strax, endurhlaða svo til að fá nöfn/viðbrögð
  useEffect(() => {
    if (!me || !id) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ch = subscribeChat(async (row) => {
      if (row.channel_id !== id) return;
      const people = await peopleMap(me.companyId);
      const { data: auth } = await supabase.auth.getUser();
      const p = people.get(row.sender_id);
      const full = p?.name ?? "Notandi";
      setMsgs((cur) => cur.some((m) => m.id === row.id) ? cur : [...cur, {
        id: row.id, senderId: row.sender_id, sender: full.split(/\s+/)[0], senderFull: full, color: p?.color ?? null, photo: p?.photo ?? null,
        me: row.sender_id === auth.user?.id, body: row.body ?? "", at: new Date(row.created_at).toTimeString().slice(0, 5), createdAt: row.created_at,
        kind: (row.kind ?? "text") as ChatMessage["kind"], url: row.attachment_url, reactions: [], replyTo: null,
      }]);
      setTyping(null);
      if (t) clearTimeout(t);
      t = setTimeout(load, 500);
    }, () => { if (t) clearTimeout(t); t = setTimeout(load, 400); });
    typingRef.current = typingChannel(id, (p) => { if (p.stop) setTyping(null); else { setTyping(p.name); setTimeout(() => setTyping((cur) => (cur === p.name ? null : cur)), 4000); } });
    const poll = setInterval(load, 15000);
    return () => { ch.unsubscribe(); typingRef.current?.unsubscribe(); clearInterval(poll); if (t) clearTimeout(t); };
  }, [me, id, load]);

  function onType(v: string) {
    setText(v);
    const now = Date.now();
    if (now - lastTyped.current > 2500 && me) {
      lastTyped.current = now;
      typingRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: me.empId, name: me.fullName.split(/\s+/)[0] } });
    }
  }

  async function send() {
    const body = text.trim();
    if (!me || !id || !body || sending) return;
    setSending(true);
    setText("");
    const rt = replyTo; setReplyTo(null);
    // optimistic
    const tmp: ChatMessage = { id: "tmp-" + Date.now(), senderId: "me", sender: me.fullName.split(/\s+/)[0], senderFull: me.fullName, color: me.avatarColor, photo: me.photoUrl, me: true, body, at: new Date().toTimeString().slice(0, 5), createdAt: new Date().toISOString(), kind: "text", url: null, reactions: [], replyTo: rt ? { sender: rt.sender, body: rt.body } : null };
    setMsgs((cur) => [...cur, tmp]);
    const r = await sendChatMessage(me, id, body, rt?.id ?? null);
    setSending(false);
    if (!r.ok) { setMsgs((cur) => cur.filter((m) => m.id !== tmp.id)); setText(body); return; }
    setMsgs((cur) => cur.map((m) => (m.id === tmp.id ? { ...m, id: r.id ?? m.id } : m)));
    typingRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: me.empId, name: "", stop: true } });
  }

  const rows = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [];
    let prevDay = "";
    msgs.forEach((m, i) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== prevDay) { out.push({ key: "sep-" + day, kind: "sep", label: dayLabel(m.createdAt) }); prevDay = day; }
      const prev = msgs[i - 1], next = msgs[i + 1];
      const sameDayPrev = prev && new Date(prev.createdAt).toDateString() === day;
      const first = !prev || prev.senderId !== m.senderId || !sameDayPrev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 10 * 60000;
      const last = !next || next.senderId !== m.senderId || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > 10 * 60000;
      out.push({ key: m.id, kind: "msg", m, first, last, showSender: first && !m.me && isGroup });
    });
    return out;
  }, [msgs, isGroup]);

  // „séð af“: aðrir sem hafa lesið eftir mín síðustu skilaboð
  const lastMine = [...msgs].reverse().find((m) => m.me);
  const seenBy = lastMine ? reads.filter((r) => r.lastReadAt >= lastMine.createdAt) : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingTop: insets.top + 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line2, backgroundColor: colors.panel }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><ChevronLeft color={colors.ink} size={26} /></Pressable>
        {isGroup ? <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Hash color="#fff" size={18} /></View> : <Avatar name={name ?? "?"} size={36} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="bold" size={15} numberOfLines={1}>{name ?? "Spjall"}</Txt>
          <Muted size={12}>{typing ? `${typing} skrifar…` : isGroup ? `${members || "—"} meðlimir${muted ? " · þaggað" : ""}` : muted ? "Einkaspjall · þaggað" : "Einkaspjall"}</Muted>
        </View>
        <Pressable onPress={openInfo} hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><MoreHorizontal color={colors.ink} size={24} /></Pressable>
      </View>

      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={
          <View style={{ gap: 6 }}>
            {typing ? <View style={{ alignSelf: "flex-start", marginLeft: 34, backgroundColor: colors.bubbleThem, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }}><Muted size={13}>•••</Muted></View> : null}
            {seenBy.length ? <View style={{ flexDirection: "row", alignSelf: "flex-end", gap: 2, marginTop: 4 }}>{seenBy.slice(0, 5).map((r) => <Avatar key={r.userId} name={r.name} size={16} />)}</View> : null}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === "sep" ? (
            <Txt weight="bold" size={11} color={colors.ink3} style={{ alignSelf: "center", marginVertical: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>{item.label}</Txt>
          ) : (
            <Bubble item={item} onLong={() => setSel(item.m)} />
          )
        }
      />

      {replyTo ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <CornerUpLeft color={colors.ink3} size={16} />
          <View style={{ flex: 1 }}><Txt weight="bold" size={12} color={colors.brandDeep}>Svara {replyTo.sender}</Txt><Muted size={12}>{replyTo.body.slice(0, 80)}</Muted></View>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}><X color={colors.ink3} size={18} /></Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: Math.max(10, insets.bottom), backgroundColor: colors.panel, borderTopWidth: replyTo ? 0 : 1, borderTopColor: colors.line2 }}>
        <Pressable onPress={pickAndSend} disabled={uploading} hitSlop={6} style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.5 : 1 }}>
          <ImagePlus color={colors.ink2} size={22} />
        </Pressable>
        <Pressable onPress={pickFile} disabled={uploading} hitSlop={6} style={{ width: 32, height: 40, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.5 : 1 }}>
          <Paperclip color={colors.ink2} size={20} />
        </Pressable>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: font.regular, color: colors.ink, maxHeight: 110 }}
          multiline value={text} onChangeText={onType} placeholder="Skrifaðu skilaboð…" placeholderTextColor={colors.ink3} blurOnSubmit={false}
        />
        <Pressable onPress={send} disabled={!text.trim() || sending} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? colors.brand : colors.line2, alignItems: "center", justifyContent: "center" }}>
          <Send color={text.trim() ? "#fff" : colors.ink3} size={18} />
        </Pressable>
      </View>

      <Sheet open={!!sel} onClose={() => setSel(null)} scroll={false}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: 6 }}>
          {EMOJI.map((e) => {
            const mine = sel?.reactions.find((r) => r.emoji === e)?.mine;
            return (
              <Pressable key={e} onPress={async () => { if (!me || !sel) return; await setReaction(me, sel.id, mine ? null : e); setSel(null); load(); }} style={{ backgroundColor: mine ? colors.brandSoft : colors.panel2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }}>
                <Txt size={20}>{e}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          <Row icon={<CornerUpLeft color={colors.ink2} size={19} />} title="Svara" onPress={() => { setReplyTo(sel); setSel(null); }} chevron={false} last={!sel?.me} />
          {sel?.me ? <Row icon={<Trash2 color={colors.bad} size={19} />} title="Eyða skilaboðum" danger onPress={async () => { if (sel) await deleteMessage(sel.id); setSel(null); load(); }} chevron={false} last /> : null}
        </View>
      </Sheet>
      <Sheet open={info} onClose={() => setInfo(false)} title={name ?? "Spjall"}>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          <Row icon={muted ? <Bell color={colors.ink2} size={19} /> : <BellOff color={colors.ink2} size={19} />} title={muted ? "Kveikja á tilkynningum" : "Þagga spjallið"} sub={muted ? "Þú færð aftur merki og hljóð" : "Ekkert ólesið-merki eða hljóð fyrir þetta spjall"} chevron={false} last
            onPress={async () => { if (!id) return; const m = await toggleMute(id); setMuted(m); }} />
        </View>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          <Row icon={<Images color={colors.ink2} size={19} />} title="Myndir og skjöl" sub="Allt sem hefur verið sent í spjallinu" onPress={openMedia} last={kind === "general"} />
          {kind !== "general" ? <Row icon={<LogOut color={colors.bad} size={19} />} title="Yfirgefa spjall" danger chevron={false} onPress={leave} last /> : null}
        </View>
        <Txt weight="bold" size={12} color={colors.ink3} style={{ letterSpacing: 0.8, marginTop: 4 }}>{isGroup ? `MEÐLIMIR · ${memberList.length || members}` : "ÞÁTTTAKENDUR"}</Txt>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          {memberList.length === 0 ? <Muted style={{ padding: 14 }}>Sæki…</Muted> : null}
          {memberList.map((p, i) => (
            <Row key={p.userId} icon={<Avatar name={p.name} size={36} color={p.color} photo={p.photo} />} title={p.name} sub={[p.role, p.dept].filter(Boolean).join(" · ") || "Starfsmaður"} chevron={false} last={i === memberList.length - 1} />
          ))}
        </View>
      </Sheet>
      <Sheet open={media !== null} onClose={() => setMedia(null)} title="Myndir og skjöl">
        {media && media.length === 0 ? <Muted>Engar myndir eða skjöl enn.</Muted> : null}
        {media && media.filter((a) => a.kind === "image").length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {media.filter((a) => a.kind === "image").map((a) => (
              <Pressable key={a.id} onPress={() => Linking.openURL(a.url)} style={{ width: "31.5%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: colors.panel2 }}>
                <Image source={{ uri: a.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        ) : null}
        {media && media.filter((a) => a.kind !== "image").length ? (
          <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
            {media.filter((a) => a.kind !== "image").map((a, i, arr) => (
              <Row key={a.id} icon={<FileText color={colors.ink2} size={19} />} title={a.name} sub={`${a.sender} · ${new Date(a.at).getDate()}.${new Date(a.at).getMonth() + 1}.${new Date(a.at).getFullYear()}`} chevron={false} onPress={() => Linking.openURL(a.url)} last={i === arr.length - 1} />
            ))}
          </View>
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function Bubble({ item, onLong }: { item: Extract<RowItem, { kind: "msg" }>; onLong: () => void }) {
  const { m, first, last, showSender } = item;
  const r = 18, s = 6;
  const radius = m.me
    ? { borderTopLeftRadius: r, borderBottomLeftRadius: r, borderTopRightRadius: first ? r : s, borderBottomRightRadius: last ? r : s }
    : { borderTopRightRadius: r, borderBottomRightRadius: r, borderTopLeftRadius: first ? r : s, borderBottomLeftRadius: last ? r : s };
  return (
    <View style={{ marginBottom: m.reactions.length ? 14 : last ? 8 : 2 }}>
      {showSender ? <Txt size={11} weight="semibold" color={colors.ink3} style={{ marginLeft: 42, marginBottom: 2 }}>{m.senderFull}</Txt> : null}
      <View style={{ flexDirection: m.me ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, maxWidth: "86%", alignSelf: m.me ? "flex-end" : "flex-start" }}>
        {!m.me ? <View style={{ width: 26, opacity: last ? 1 : 0 }}><Avatar name={m.senderFull} size={26} color={m.color} photo={m.photo} /></View> : null}
        <Pressable onLongPress={onLong} delayLongPress={250} style={{ backgroundColor: m.me ? colors.brand : colors.bubbleThem, paddingHorizontal: 13, paddingVertical: 9, ...radius, position: "relative", flexShrink: 1 }}>
          {m.replyTo ? (
            <View style={{ borderLeftWidth: 2, borderLeftColor: m.me ? "rgba(255,255,255,.6)" : colors.brand, paddingLeft: 8, marginBottom: 6 }}>
              <Txt size={11.5} weight="bold" color={m.me ? "rgba(255,255,255,.9)" : colors.brandDeep}>{m.replyTo.sender}</Txt>
              <Txt size={12.5} color={m.me ? "rgba(255,255,255,.85)" : colors.ink2} numberOfLines={2}>{m.replyTo.body}</Txt>
            </View>
          ) : null}
          {m.kind === "image" && m.url ? <Pressable onPress={() => m.url && Linking.openURL(m.url)}><Image source={{ uri: m.url }} style={{ width: 210, height: 150, borderRadius: 12, marginBottom: m.body ? 6 : 0 }} contentFit="cover" /></Pressable> : null}
          {m.kind === "file" && m.url ? (
            <Pressable onPress={() => m.url && Linking.openURL(m.url)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: m.me ? "rgba(255,255,255,.2)" : colors.panel, alignItems: "center", justifyContent: "center" }}><FileText color={m.me ? "#fff" : colors.ink2} size={18} /></View>
              <View style={{ flexShrink: 1 }}><Txt weight="bold" size={14} color={m.me ? "#fff" : colors.ink} numberOfLines={2}>{m.body || "Skjal"}</Txt><Txt size={11.5} color={m.me ? "rgba(255,255,255,.8)" : colors.ink3}>Ýttu til að opna</Txt></View>
            </Pressable>
          ) : m.body ? <Txt size={15} color={m.me ? "#fff" : colors.ink} style={{ lineHeight: 20 }}>{m.body}</Txt> : null}
          {m.reactions.length ? (
            <View style={{ position: "absolute", bottom: -12, [m.me ? "left" : "right"]: 8, flexDirection: "row", backgroundColor: colors.panel, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 6, paddingVertical: 1, gap: 3 }}>
              {m.reactions.map((x) => <Txt key={x.emoji} size={12}>{x.emoji}{x.count > 1 ? ` ${x.count}` : ""}</Txt>)}
            </View>
          ) : null}
        </Pressable>
        {last ? <Txt size={10.5} color={colors.ink3} style={{ marginBottom: 2 }}>{m.at}</Txt> : null}
      </View>
    </View>
  );
}
