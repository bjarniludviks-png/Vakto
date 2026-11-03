// Spjallþráður — realtime, skilaboð flokkuð eftir sendanda, viðbrögð með
// löngu ýti, „séð af“, svar í þræði, skrifar-vísir.
import { emojify } from "../../src/lib/emoticons";
import { mentionQuery, filterMentions, insertMention, splitMentions, type MentionPerson } from "../../src/lib/mentions";
import { presenceLabel, type CoworkerStatus } from "../../src/lib/presence";
import { coworkerStatus } from "../../src/lib/api/presence";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tr, trf, getLang } from "../../src/lib/i18n";
import { setOpenChannel } from "../../src/lib/push";
import { ImageViewer } from "../../src/components/image-viewer";
import { View, Text, TextInput, FlatList, KeyboardAvoidingView, Keyboard, Platform, Pressable, Animated, PanResponder, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Send, X, Hash, CornerUpLeft, Trash2, Flag, Ban, Image as ImageIcon, Camera, CirclePlus, Info, BellOff, Bell, FileText, Images, LogOut, Pencil, Phone, Copy, Languages } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { Linking, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Txt, Muted, Avatar, Sheet, Row, useToast, colorFor } from "../../src/components/ui";
import { uploadImage } from "../../src/lib/api/feed";
import { colors, font, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listMessages, sendChatMessage, sendChatImage, sendChatFile, uploadChatFile, listAttachments, leaveChannel, deleteChannel, renameChannel, markChannelRead, type Attachment, setReaction, deleteMessage, editMessage, translateMessage, translateBatch, getChatTranslate, setChatTranslate, subscribeChat, typingChannel, peopleMap, authUser, type ChatMessage, type ChannelRead, type LiveMessage } from "../../src/lib/api/chat";
import { supabase } from "../../src/lib/supabase";
import { isMuted, toggleMute } from "../../src/lib/mute";
import { reportContent, blockUser, blockedUsers } from "../../src/lib/api/moderation";
import type { Person } from "../../src/lib/api/chat";

const EMOJI = ["❤️", "👍", "😂", "🙏", "🔥", "👀"];

type RowItem = { key: string; kind: "sep"; label: string; unread?: boolean } | { key: string; kind: "msg"; m: ChatMessage; first: boolean; last: boolean; showSender: boolean };

function dayLabel(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Í dag";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Í gær";
  return `${["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"][d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
}

export default function Thread() {
  useTheme();
  const { id, name: nameParam } = useLocalSearchParams<{ id: string; name?: string }>();
  // Heiti hóps má breyta í upplýsingablaðinu — því staðbundið ástand en ekki bara slóðarbreyta.
  const [name, setName] = useState(nameParam);
  const [renaming, setRenaming] = useState<string | null>(null);
  const { me } = useMe();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<ChannelRead[]>([]);
  // „Ólesin skilaboð“ (eins og Messenger): fyrstu ólesnu skilaboðin þegar þráðurinn var opnaður
  const [unreadFrom, setUnreadFrom] = useState<string | null>(null);
  const unreadSet = useRef(false);
  useEffect(() => { unreadSet.current = false; setUnreadFrom(null); }, [id]);
  useFocusEffect(useCallback(() => { setOpenChannel(id ?? null); return () => setOpenChannel(null); }, [id]));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sel, setSel] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // Breyta eigin skilaboðum (0100): textinn fer í innsláttarreitinn og „Senda“ vistar breytinguna.
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  // Afrita: textinn í blaði þar sem má velja hann (appið hefur ekki klemmuspjaldseiningu enn).
  const [copyOf, setCopyOf] = useState<ChatMessage | null>(null);
  // „Viðbrögð“: hverjir settu hvaða emoji (ýtt á emoji-merkið undir skilaboðum)
  const [whoFor, setWhoFor] = useState<string | null>(null);
  // „Séð af“: ýtt á litlu myndirnar undir síðustu skilaboðunum mínum → listi með nöfnum
  const [seenOpen, setSeenOpen] = useState(false);
  const [whoTab, setWhoTab] = useState<string | null>(null);
  // Þýðingar á tungumál appsins: id → þýddur texti (null = í vinnslu); `orig` = sýna frumtexta aftur.
  const [trans, setTrans] = useState<Record<string, string | null>>({});
  const [orig, setOrig] = useState<Record<string, boolean>>({});
  // Sjálfvirk þýðing (0103): skilaboð frá öðrum á öðru máli birtast þýdd. null = kveikt ef appið er ekki á íslensku.
  const [autoPref, setAutoPref] = useState<"on" | "off" | null>(null);
  const autoOn = autoPref === "on" || (autoPref === null && getLang() !== "is");
  const autoAsked = useRef(new Set<string>());
  useEffect(() => { void getChatTranslate().then(setAutoPref); }, []);
  useEffect(() => {
    if (!autoOn) return;
    const ids = msgs.filter((m) => !m.me && m.kind === "text" && m.body && !m.id.startsWith("tmp-") && !(m.id in trans) && !autoAsked.current.has(m.id)).map((m) => m.id);
    if (!ids.length) return;
    ids.forEach((x) => autoAsked.current.add(x));
    void translateBatch(ids).then((got) => { if (Object.keys(got).length) setTrans((cur) => ({ ...cur, ...got })); });
  }, [msgs, autoOn, trans]);
  // hver skrifar: nafn + mynd, eins og Messenger sýnir prófílmyndina við „•••“
  const [typing, setTyping] = useState<{ userId: string; name: string; photo: string | null; color: string | null } | null>(null);
  const [members, setMembers] = useState(0);
  const [isGroup, setIsGroup] = useState(true);
  // Mynd/litur í hausnum — sama og í spjalllistanum (profílmynd viðmælanda eða grúppumynd).
  const [head, setHead] = useState<{ photo: string | null; color: string | null }>({ photo: null, color: null });
  // Bein skilaboð: „á vakt“ / virk(ur) viðmælandans (0099); smellur á hausinn opnar prófílinn hans.
  const [peer, setPeer] = useState<CoworkerStatus | null>(null);
  // símanúmer viðmælanda (coworkers sýnir það aðeins ef hann leyfir, show_phone) → símtalstákn í haus
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const peerLabel = presenceLabel(peer);
  useEffect(() => {
    if (isGroup || !id || !me) return;
    let live = true;
    const load = async () => {
      const { data: mem } = await supabase.from("channel_members").select("user_id").eq("channel_id", id);
      const { data: au } = await authUser();
      const other = (mem ?? []).map((m) => m.user_id as string).find((u) => u !== au.user?.id);
      if (!other) return;
      if (me) supabase.from("coworkers").select("phone").eq("company_id", me.companyId).eq("user_id", other).maybeSingle()
        .then(({ data }) => { if (live) setPeerPhone((data?.phone as string | null)?.trim() || null); }, () => {});
      const st = await coworkerStatus([other]);
      if (live) setPeer(st[other] ?? null);
    };
    void load();
    const iv = setInterval(load, 60_000);
    return () => { live = false; clearInterval(iv); };
  }, [isGroup, id, me]);
  const [info, setInfo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [memberList, setMemberList] = useState<Person[]>([]);
  const [kind, setKind] = useState<string>("group");
  const [mine, setMine] = useState(false); // ég stofnaði hópinn → má eyða honum fyrir alla
  // @-merkingar í hópspjalli: meðlimir þráðarins (ekki ég), leitin í gangi og staða bendils.
  const [tagPeople, setTagPeople] = useState<Person[]>([]);
  const [meUid, setMeUid] = useState<string | null>(null);
  const [mq, setMq] = useState<{ start: number; q: string } | null>(null);
  const caret = useRef(0);
  useEffect(() => {
    if (!me || !id || !isGroup) { setTagPeople([]); return; }
    let alive = true;
    (async () => {
      const [people, { data: au }] = await Promise.all([peopleMap(me.companyId), authUser()]);
      let list: Person[];
      if (kind === "general") list = [...people.values()];
      else { const { data: mem } = await supabase.from("channel_members").select("user_id").eq("channel_id", id); list = (mem ?? []).map((m) => people.get(m.user_id as string)).filter(Boolean) as Person[]; }
      if (alive) { setTagPeople(list.sort((a, b) => a.name.localeCompare(b.name))); setMeUid(au.user?.id ?? null); }
    })();
    return () => { alive = false; };
  }, [me, id, isGroup, kind]);
  const mqList = mq ? filterMentions(tagPeople.filter((p) => p.userId !== meUid), mq.q, 5) : [];
  function pickMention(p: Person) {
    if (!mq) return;
    const r = insertMention(text, mq.start, caret.current, p.name);
    caret.current = r.caret; setText(r.text); setMq(null);
  }
  const [media, setMedia] = useState<Attachment[] | null>(null);
  async function openMedia() {
    if (!me || !id) return;
    setMedia([]);
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
    const res = (f.mimeType ?? "").startsWith("image/") || IMG_RE.test(f.name) ? await sendChatImage(me, id, up.url, typingRef.current) : await sendChatFile(me, id, up.url, f.name);
    setUploading(false);
    if (!res.ok) toast(res.error ?? "Tókst ekki að senda"); else load();
  }
  async function saveName() {
    if (!id || renaming === null) return;
    const nm = renaming.trim();
    if (!nm || nm === name) { setRenaming(null); return; }
    const r = await renameChannel(id, nm);
    if (!r.ok) { toast(r.error ?? "Tókst ekki"); return; }
    setName(nm); setRenaming(null); toast("Heiti breytt");
  }

  // Staðfesting birtist INNI í upplýsingablaðinu (ekki Alert ofan á Modal — það getur týnst á iOS).
  const [confirm, setConfirm] = useState<null | "leave" | "delete">(null);
  const [busy, setBusy] = useState(false);
  async function doConfirm() {
    if (!id || !confirm) return;
    setBusy(true);
    const r = confirm === "delete" ? await deleteChannel(id) : await leaveChannel(id);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Tókst ekki"); return; }
    toast(confirm === "delete" ? "Hópnum var eytt" : kind === "dm" ? "Samtali eytt" : "Þú ert farin(n) úr hópnum");
    setConfirm(null); setInfo(false); router.back();
  }
  async function openInfo() {
    if (!me || !id) return;
    setConfirm(null);
    setInfo(true);
    const people = await peopleMap(me.companyId);
    const { data: ch } = await supabase.from("channels").select("kind").eq("id", id).maybeSingle();
    if (ch?.kind === "general") setMemberList([...people.values()].sort((a, b) => a.name.localeCompare(b.name)));
    else { const { data: mem } = await supabase.from("channel_members").select("user_id").eq("channel_id", id); setMemberList((mem ?? []).map((m) => people.get(m.user_id)).filter(Boolean).sort((a, b) => a!.name.localeCompare(b!.name)) as Person[]); }
  }
  const list = useRef<FlatList>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  /** Sækir myndina í skyndiminni og opnar deilingarblaðið („Vista mynd“ setur hana í Myndir). */
  // tímastimplar eru faldir hægra megin við skjáinn; strok til vinstri dregur þá inn (eins og í Messenger)
  const { width: W } = useWindowDimensions();
  const pull = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderMove: (_e, g) => pull.setValue(Math.max(-TIME_W, Math.min(0, g.dx * 0.7))),
    onPanResponderRelease: () => Animated.spring(pull, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start(),
    onPanResponderTerminate: () => Animated.spring(pull, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start(),
  })).current;
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  // Messenger-innsláttur: táknin falla saman í ör meðan skrifað er
  const [toolsOpen, setToolsOpen] = useState(false);
  const compact = !!text.trim() && !toolsOpen;
  async function takePhoto() {
    if (!me || !id) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast(tr("Leyfðu aðgang að myndavél í stillingum símans")); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    setUploading(true);
    const up = await uploadImage(me, r.assets[0].uri, r.assets[0].uri.toLowerCase().endsWith(".png") ? "png" : "jpg");
    if (!up.ok || !up.url) { setUploading(false); toast(up.error ?? "Mynd hlóðst ekki upp"); return; }
    const res = await sendChatImage(me, id, up.url, typingRef.current);
    setUploading(false);
    if (!res.ok) toast(res.error ?? "Tókst ekki að senda mynd");
    else load();
  }
  async function pickAndSend() {
    if (!me || !id) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    setUploading(true);
    const up = await uploadImage(me, r.assets[0].uri, r.assets[0].uri.toLowerCase().endsWith(".png") ? "png" : "jpg");
    if (!up.ok || !up.url) { setUploading(false); toast(up.error ?? "Mynd hlóðst ekki upp"); return; }
    const res = await sendChatImage(me, id, up.url, typingRef.current);
    setUploading(false);
    if (!res.ok) toast(res.error ?? "Tókst ekki að senda mynd");
    else load();
  }
  const typingRef = useRef<ReturnType<typeof typingChannel> | null>(null);
  const lastTyped = useRef(0);

  // lyklaborðið opnast → nýjustu skilaboðin haldast í sjónmáli. Meðan það er opið fer
  // heimastikubilið (insets.bottom) ekki undir innsláttinn, annars myndast autt bil ofan við lyklaborðið.
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const show = () => { setKbOpen(true); if (atBottom.current) setTimeout(toBottom, 60); };
    const hide = () => setKbOpen(false);
    const subs = [
      Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", show),
      Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", hide),
    ];
    return () => subs.forEach((x) => x.remove());
  }, []);

  // „Sýna eldri skilaboð“: eru eldri skilaboð en þau sem eru hlaðin?
  const [more, setMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Listinn er öfugur (inverted): offset 0 = nýjustu skilaboðin neðst, svo þráðurinn opnast alltaf
  // neðst og eldri síður bætast ofan við án þess að sjónarhornið hoppi.
  const atBottom = useRef(true);
  const toBottom = () => list.current?.scrollToOffset({ offset: 0, animated: true });

  const load = useCallback(async () => {
    if (!me || !id) return;
    const [r, blocked] = await Promise.all([listMessages(me, id), blockedUsers()]);
    const fresh = r.messages.filter((m) => m.me || !blocked.has(m.senderId));
    // endurhleðslan sækir NÝJUSTU síðuna; eldri síður sem búið er að sækja haldast
    const first = r.messages[0]?.createdAt;
    setMsgs((cur) => {
      const older = r.hasMore && first ? cur.filter((m) => !m.id.startsWith("tmp-") && m.createdAt < first) : [];
      if (!older.length) setMore(r.hasMore);
      return [...older, ...fresh];
    });
    setReads(r.reads);
    if (!unreadSet.current) {
      unreadSet.current = true;
      const firstUnread = r.myReadAt ? fresh.find((m) => !m.me && m.createdAt > r.myReadAt!) : null;
      setUnreadFrom(firstUnread?.id ?? null);
    }
    markChannelRead(id).catch(() => {});
  }, [me, id]);

  async function loadOlder() {
    const oldest = msgs.find((m) => !m.id.startsWith("tmp-"));
    if (!me || !id || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    let r: Awaited<ReturnType<typeof listMessages>>, blocked: Set<string>;
    try { [r, blocked] = await Promise.all([listMessages(me, id, { createdAt: oldest.createdAt, id: oldest.id }), blockedUsers()]); }
    catch { toast("Tókst ekki að sækja eldri skilaboð"); return; }
    finally { setLoadingOlder(false); }
    const older = r.messages.filter((m) => m.me || !blocked.has(m.senderId));
    setMsgs((cur) => { const seen = new Set(cur.map((m) => m.id)); return [...older.filter((m) => !seen.has(m.id)), ...cur]; });
    setMore(r.hasMore);
  }
  /** Breyta einu skilaboði staðbundið (eldri síður eru ekki endursóttar í endurhleðslu). */
  function patchMsg(mid: string, fn: (m: ChatMessage) => ChatMessage | null) {
    setMsgs((cur) => cur.flatMap((m) => (m.id === mid ? (fn(m) ?? []) : [m])));
  }
  function patchReaction(mid: string, emoji: string | null) {
    patchMsg(mid, (x) => {
      const meW = { userId: "me", name: me?.fullName ?? tr("Þú"), color: me?.avatarColor ?? null, photo: me?.photoUrl ?? null, me: true };
      let rs = x.reactions.map((y) => (y.mine ? { ...y, count: y.count - 1, mine: false, who: y.who.filter((w) => !w.me) } : y)).filter((y) => y.count > 0);
      if (emoji) rs = rs.some((y) => y.emoji === emoji)
        ? rs.map((y) => (y.emoji === emoji ? { ...y, count: y.count + 1, mine: true, who: [...y.who, meW] } : y))
        : [...rs, { emoji, count: 1, mine: true, who: [meW] }];
      return { ...x, reactions: rs };
    });
  }

  useFocusEffect(useCallback(() => {
    load();
    if (id) isMuted(id).then(setMuted);
    supabase.from("channels").select("kind, name, photo_url, created_by").eq("id", id).maybeSingle().then(async ({ data }) => {
      setIsGroup(data?.kind !== "dm"); setKind((data?.kind as string) ?? "group");
      authUser().then(({ data: au }) => setMine(!!au.user && data?.created_by === au.user.id));
      if (data?.kind === "group" && data.name) setName(data.name as string);
      if (data?.kind === "group") setHead({ photo: (data.photo_url as string | null) ?? null, color: colorFor(id) });
      if (data?.kind === "dm" && me) {
        const [{ data: mem }, { data: au }, people] = await Promise.all([supabase.from("channel_members").select("user_id").eq("channel_id", id), authUser(), peopleMap(me.companyId)]);
        const other = (mem ?? []).map((m) => m.user_id as string).find((u) => u !== au.user?.id);
        const p = other ? people.get(other) : undefined;
        if (p) { setHead({ photo: p.photo, color: p.color }); if (!nameParam) setName(p.name); }
      }
      if (data?.kind === "general" && me) { const { count } = await supabase.from("coworkers").select("id", { count: "exact", head: true }).eq("company_id", me.companyId).not("user_id", "is", null); setMembers(count ?? 0); }
      else { const { count } = await supabase.from("channel_members").select("user_id", { count: "exact", head: true }).eq("channel_id", id); setMembers(count ?? 0); }
    });
  }, [load, id, me, nameParam]));

  // realtime: nýtt skilaboð → mála strax, endurhlaða svo til að fá nöfn/viðbrögð
  useEffect(() => {
    if (!me || !id) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    // auðkenni og nafnaskrá sótt EINU sinni — nýtt skilaboð teiknast strax, án þess að bíða eftir neinu
    const myId = { current: null as string | null };
    let people: Awaited<ReturnType<typeof peopleMap>> | null = null;
    void authUser().then(({ data }) => { myId.current = data.user?.id ?? null; });
    void peopleMap(me.companyId).then((m) => { people = m; });
    const paint = (row: LiveMessage) => {
      if (row.channel_id !== id || !alive) return;
      const p = people?.get(row.sender_id);
      const full = p?.name ?? row.name ?? "";
      const mine = row.sender_id === myId.current;
      setMsgs((cur) => {
        if (cur.some((m) => m.id === row.id)) return cur;
        // eigin skilaboð geta borist áður en vistunin svarar → skipta út bráðabirgðaútgáfunni
        if (mine) { const i = cur.findIndex((m) => m.id.startsWith("tmp-") && m.body === (row.body ?? "")); if (i >= 0) { const c = cur.slice(); c[i] = { ...c[i], id: row.id }; return c; } }
        const rp = row.reply_to ? cur.find((m) => m.id === row.reply_to) : undefined;
        return [...cur, {
          id: row.id, senderId: row.sender_id, sender: full.split(/\s+/)[0] || "…", senderFull: full, color: p?.color ?? row.color ?? null, photo: p?.photo ?? row.photo ?? null,
          me: mine, body: row.body ?? "", at: new Date(row.created_at).toTimeString().slice(0, 5), createdAt: row.created_at,
          kind: (row.kind ?? "text") as ChatMessage["kind"], url: row.attachment_url, reactions: [], replyTo: rp ? { sender: rp.sender, body: rp.body } : null,
        }];
      });
      setTyping(null);
      // nafn vantaði (nýr starfsmaður / skráin ekki komin) → fylla inn þegar hún er til
      if (!full) void peopleMap(me.companyId).then((m) => { const q = m.get(row.sender_id); if (q) patchMsg(row.id, (x) => ({ ...x, sender: q.name.split(/\s+/)[0], senderFull: q.name, color: q.color, photo: q.photo })); });
      // þráðurinn er opinn: merkja lesið STRAX svo sendandinn sjái „séð“ án tafar
      if (!mine) markChannelRead(id).catch(() => {});
      // létt samræming (viðbrögð o.þ.h.) — ekki full endurhleðsla eftir hvert skilaboð
      if (t) clearTimeout(t);
      t = setTimeout(load, 10000);
    };
    const ch = subscribeChat(paint, async (r) => {
      // einhver las: uppfæra „séð“ beint úr atburðinum — engin endurhleðsla á öllum þræðinum
      if (!r || r.channel_id !== id) return;
      const { data: auth } = await authUser();
      if (r.user_id === auth.user?.id) return;
      const p = (await peopleMap(me.companyId)).get(r.user_id);
      setReads((cur) => [...cur.filter((x) => x.userId !== r.user_id), { userId: r.user_id, name: p?.name ?? "", lastReadAt: r.last_read_at, color: p?.color ?? null, photo: p?.photo ?? null }]);
    }, (e) => {
      // breytt skilaboð: nýr texti strax og eldri þýðing fellur út
      if (e.channel_id !== id) return;
      setMsgs((cur) => cur.map((m) => (m.id === e.id && m.body !== e.body ? { ...m, body: e.body, edited: true } : m)));
      autoAsked.current.delete(e.id);
      setTrans((cur) => { if (!(e.id in cur)) return cur; const n = { ...cur }; delete n[e.id]; return n; });
    }, { channelId: id });
    typingRef.current = typingChannel(id, async (p) => {
      if (p.stop) { setTyping(null); return; }
      // mynd úr skilaboðunum sjálfum, annars úr starfsmannaskránni (eldri útgáfur sendu hana ekki)
      const person = p.photo === undefined ? (await peopleMap(me.companyId)).get(p.userId) : undefined;
      const who = { userId: p.userId, name: p.name || person?.name || "", photo: p.photo ?? person?.photo ?? null, color: p.color ?? person?.color ?? null };
      setTyping(who);
      setTimeout(() => setTyping((cur) => (cur?.userId === who.userId && cur.name === who.name ? null : cur)), 4000);
    }, paint);
    const poll = setInterval(load, 15000);
    return () => { alive = false; ch.unsubscribe(); typingRef.current?.unsubscribe(); clearInterval(poll); if (t) clearTimeout(t); };
  }, [me, id, load]);

  function onType(v: string) {
    setText(v);
    const now = Date.now();
    if (now - lastTyped.current > 2500 && me) {
      lastTyped.current = now;
      void authUser().then(({ data }) => typingRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: data.user?.id ?? me.empId, name: me.fullName.split(/\s+/)[0], photo: me.photoUrl, color: me.avatarColor } }));
    }
  }

  async function send() {
    const body = emojify(text.trim());
    if (!me || !id || !body || sending) return;
    if (editing) {
      const m = editing;
      setEditing(null); setText("");
      if (body === m.body) return;
      patchMsg(m.id, (x) => ({ ...x, body, edited: true }));
      const r = await editMessage(m.id, body);
      if (!r.ok) { patchMsg(m.id, (x) => ({ ...x, body: m.body, edited: m.edited })); toast(r.error ?? "Tókst ekki"); }
      return;
    }
    setSending(true);
    setText("");
    const rt = replyTo; setReplyTo(null);
    atBottom.current = true; // að senda fer alltaf niður á nýjustu skilaboðin
    toBottom();
    // optimistic
    const tmp: ChatMessage = { id: "tmp-" + Date.now(), senderId: "me", sender: me.fullName.split(/\s+/)[0], senderFull: me.fullName, color: me.avatarColor, photo: me.photoUrl, me: true, body, at: new Date().toTimeString().slice(0, 5), createdAt: new Date().toISOString(), kind: "text", url: null, reactions: [], replyTo: rt ? { sender: rt.sender, body: rt.body } : null };
    setMsgs((cur) => [...cur, tmp]);
    const r = await sendChatMessage(me, id, body, rt?.id ?? null, typingRef.current);
    setSending(false);
    if (!r.ok) { setMsgs((cur) => cur.filter((m) => m.id !== tmp.id)); setText(body); toast(r.error && /[áðéíóúýþæö]/i.test(r.error) ? r.error : "Skilaboðin fóru ekki — athugaðu nettenginguna og reyndu aftur"); return; }
    setMsgs((cur) => cur.map((m) => (m.id === tmp.id ? { ...m, id: r.id ?? m.id } : m)));
    typingRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: "", name: "", stop: true } });
  }

  async function translate(m: ChatMessage) {
    setOrig((cur) => ({ ...cur, [m.id]: false }));
    if (trans[m.id]) return;
    setTrans((cur) => ({ ...cur, [m.id]: null }));
    const r = await translateMessage(m.id);
    if (r.ok && r.text) setTrans((cur) => ({ ...cur, [m.id]: r.text! }));
    else { setTrans((cur) => { const n = { ...cur }; delete n[m.id]; return n; }); toast(r.error ?? "Þýðing tókst ekki"); }
  }

  const rows = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [];
    let prevDay = "";
    msgs.forEach((m, i) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== prevDay) { out.push({ key: "sep-" + day, kind: "sep", label: dayLabel(m.createdAt) }); prevDay = day; }
      if (m.id === unreadFrom) out.push({ key: "unread", kind: "sep", label: tr("Ólesin skilaboð"), unread: true });
      const prev = msgs[i - 1], next = msgs[i + 1];
      const sameDayPrev = prev && new Date(prev.createdAt).toDateString() === day;
      const first = !prev || prev.senderId !== m.senderId || !sameDayPrev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 10 * 60000;
      const last = !next || next.senderId !== m.senderId || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > 10 * 60000;
      out.push({ key: m.id, kind: "msg", m, first, last, showSender: first && !m.me && isGroup });
    });
    return out.reverse(); // öfugur listi: nýjast fyrst
  }, [msgs, isGroup, unreadFrom]);

  // „séð af“: aðrir sem hafa lesið eftir mín síðustu skilaboð
  const lastMine = [...msgs].reverse().find((m) => m.me);
  const seenBy = lastMine ? reads.filter((r) => r.lastReadAt >= lastMine.createdAt) : [];
  const lastIsMine = !!lastMine && msgs[msgs.length - 1]?.id === lastMine.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.panel }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingTop: insets.top + 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line2, backgroundColor: colors.panel }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={tr("Til baka")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}><ChevronLeft color={colors.brand} size={28} /></Pressable>
        <Pressable onPress={() => { if (!isGroup && peer?.employeeId) router.push(`/starfsmadur/${peer.employeeId}`); else openInfo(); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {kind === "general" ? <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Hash color="#fff" size={18} /></View> : <Avatar name={name ?? "?"} size={36} color={head.color} photo={head.photo} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="bold" size={15} numberOfLines={1}>{name ?? "Spjall"}</Txt>
          <Muted size={12}>{typing ? trf("{x} skrifar…", typing.name) : isGroup ? (muted ? trf("{n} meðlimir · þaggað", members || "—") : trf("{n} meðlimir", members || "—")) : peerLabel.text ? tr(peerLabel.text) : muted ? "Einkaspjall · þaggað" : "Einkaspjall"}</Muted>
        </View>
        </Pressable>
        {!isGroup && peerPhone ? <Pressable onPress={() => Linking.openURL(`tel:${peerPhone.replace(/[^\d+]/g, "")}`).catch(() => toast("Ekki hægt að hringja úr þessu tæki"))} hitSlop={10} accessibilityLabel={tr("Hringja")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Phone color={colors.brand} size={22} /></Pressable> : null}
        <Pressable onPress={async () => { const next = autoOn ? "off" : "on"; const prev = autoOn ? "on" : "off"; setAutoPref(next); if (!(await setChatTranslate(next))) { setAutoPref(prev); toast("Tókst ekki að vista stillinguna"); return; } if (next === "off") { setTrans({}); setOrig({}); } toast(next === "on" ? tr("Sjálfvirk þýðing: kveikt") : tr("Sjálfvirk þýðing: slökkt")); }} hitSlop={10} accessibilityLabel={tr("Sjálfvirk þýðing")} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: autoOn ? colors.brandSoft : "transparent" }}><Languages color={autoOn ? colors.brand : colors.ink3} size={21} /></Pressable>
        <Pressable onPress={openInfo} hitSlop={10} accessibilityLabel={tr("Upplýsingar")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Info color={colors.brand} size={24} /></Pressable>
      </View>

      <Animated.View {...pan.panHandlers} style={{ flex: 1, width: W + TIME_W, transform: [{ translateX: pull }] }}>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.key}
        inverted
        contentContainerStyle={{ padding: 14, paddingTop: 8 }}
        onScroll={(e) => { atBottom.current = e.nativeEvent.contentOffset.y < 80; }}
        scrollEventThrottle={100}
        keyboardDismissMode="interactive"
        // öfugur listi: haus = neðst (skrifar…, séð af), fótur = efst (eldri skilaboð)
        ListHeaderComponent={
          <View style={{ gap: 6, width: W - 28 }}>
            {typing ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, alignSelf: "flex-start" }}>
                <Avatar name={typing.name || "?"} size={28} color={typing.color} photo={typing.photo} />
                <View style={{ backgroundColor: colors.bubbleThem, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 }}><TypingDots /></View>
              </View>
            ) : null}
            {/* eins og Messenger: aðeins þegar síðustu skilaboðin eru mín — ekki eftir að hinn svarar */}
            {lastIsMine && seenBy.length ? (
              <Pressable onPress={() => setSeenOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr("Séð af")} style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 2, marginTop: 4 }}>
                {seenBy.slice(0, 5).map((r) => <Avatar key={r.userId} name={r.name} size={16} color={r.color} photo={r.photo} />)}
                {seenBy.length > 5 ? <Txt size={11} color={colors.ink3} style={{ marginLeft: 2 }}>+{seenBy.length - 5}</Txt> : null}
              </Pressable>
            ) : null}
            {/* eins og Messenger: „Sendi…“ → „Sent“ undir síðustu skilaboðunum mínum þar til einhver hefur séð þau */}
            {lastIsMine && !seenBy.length ? <Txt size={11.5} color={colors.ink3} style={{ alignSelf: "flex-end", marginTop: 2, marginRight: 2 }}>{lastMine?.id.startsWith("tmp-") ? tr("Sendi…") : tr("Sent")}</Txt> : null}
          </View>
        }
        ListFooterComponent={more && msgs.length ? (
          <View style={{ width: W - 28, alignItems: "center", paddingVertical: 6 }}>
            <Pressable onPress={loadOlder} disabled={loadingOlder} hitSlop={8} style={{ backgroundColor: colors.panel2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, opacity: loadingOlder ? 0.6 : 1 }}>
              <Txt weight="semibold" size={13} color={colors.ink2}>{loadingOlder ? tr("Sæki…") : tr("Sýna eldri skilaboð")}</Txt>
            </Pressable>
          </View>
        ) : null}
        renderItem={({ item }) =>
          item.kind === "sep" && item.unread ? (
            <View style={{ width: W - 28, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 6 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.brand, opacity: 0.45 }} />
              <Txt weight="semibold" size={12} color={colors.brand}>{item.label}</Txt>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.brand, opacity: 0.45 }} />
            </View>
          ) : item.kind === "sep" ? (
            <View style={{ width: W - 28, alignItems: "center" }}>
              <Txt weight="semibold" size={12} color={colors.ink3} style={{ marginTop: 16, marginBottom: 8 }}>{item.label}</Txt>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: W - 28 }}><Bubble item={item} onLong={() => setSel(item.m)} onImage={setViewer} onReactions={() => { setWhoTab(null); setWhoFor(item.m.id); }}
                translated={item.m.id in trans && !orig[item.m.id] ? (trans[item.m.id] ?? "…") : undefined}
                onToggleOriginal={item.m.id in trans ? () => setOrig((cur) => ({ ...cur, [item.m.id]: !cur[item.m.id] })) : undefined}
                showingOriginal={!!orig[item.m.id]} tagPeople={tagPeople} meUid={meUid} /></View>
              <View style={{ width: TIME_W + 14, alignItems: "center", paddingBottom: item.last ? 8 : 2 }}>
                <Txt size={11} color={colors.ink3} style={{ fontVariant: ["tabular-nums"] }}>{item.m.at}</Txt>
              </View>
            </View>
          )
        }
      />
      </Animated.View>

      {editing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <Pencil color={colors.ink3} size={16} />
          <View style={{ flex: 1 }}><Txt weight="bold" size={12} color={colors.brandDeep}>{tr("Breyta skilaboðum")}</Txt><Muted size={12}>{editing.body.slice(0, 80)}</Muted></View>
          <Pressable onPress={() => { setEditing(null); setText(""); }} hitSlop={8}><X color={colors.ink3} size={18} /></Pressable>
        </View>
      ) : null}
      {replyTo ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <CornerUpLeft color={colors.ink3} size={16} />
          <View style={{ flex: 1 }}><Txt weight="bold" size={12} color={colors.brandDeep}>{trf("Svara {x}", replyTo.sender)}</Txt><Muted size={12}>{replyTo.body.slice(0, 80)}</Muted></View>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}><X color={colors.ink3} size={18} /></Pressable>
        </View>
      ) : null}
      {mqList.length > 0 ? (
        <View style={{ backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line2, paddingVertical: 4 }}>
          {mqList.map((p) => (
            <Pressable key={p.userId} onPress={() => pickMention(p)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pressed ? colors.panel2 : "transparent" })}>
              <Avatar name={p.name} size={30} color={p.color ?? undefined} photo={p.photo} />
              <Txt size={15}>{p.name}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, paddingHorizontal: 8, paddingTop: 6, paddingBottom: kbOpen ? 8 : Math.max(8, insets.bottom), backgroundColor: colors.panel }}>
        {compact ? (
          <Pressable onPress={() => setToolsOpen(true)} hitSlop={6} accessibilityLabel={tr("Fleiri valkostir")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ChevronRight color={colors.brand} size={24} />
          </Pressable>
        ) : (
          <>
            <Pressable onPress={pickFile} disabled={uploading} hitSlop={4} accessibilityLabel={tr("Senda skjal")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.5 : 1 }}>
              <CirclePlus color={colors.brand} size={24} />
            </Pressable>
            <Pressable onPress={takePhoto} disabled={uploading} hitSlop={4} accessibilityLabel={tr("Myndavél")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.5 : 1 }}>
              <Camera color={colors.brand} size={24} />
            </Pressable>
            <Pressable onPress={pickAndSend} disabled={uploading} hitSlop={4} accessibilityLabel={tr("Mynd")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.5 : 1 }}>
              <ImageIcon color={colors.brand} size={24} />
            </Pressable>
          </>
        )}
        <TextInput
          style={{ flex: 1, backgroundColor: colors.panel2, borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, minHeight: 40, marginHorizontal: 4, marginBottom: 2, fontSize: 16, fontFamily: font.regular, color: colors.ink, maxHeight: 120 }}
          multiline value={text} onChangeText={(v) => {
            onType(v); if (!v) setToolsOpen(false);
            // Bendillinn færist um jafnmarga stafi og bættust við (onSelectionChange kemur stundum á eftir).
            const c = Math.max(0, Math.min(v.length, caret.current + (v.length - text.length)));
            caret.current = c;
            setMq(tagPeople.length ? mentionQuery(v, c) : null);
          }}
          onSelectionChange={(e) => { caret.current = e.nativeEvent.selection.end; }} onFocus={() => setToolsOpen(false)} placeholder="Aa" placeholderTextColor={colors.ink3} blurOnSubmit={false}
        />
        <Pressable onPress={send} disabled={!text.trim() || sending} accessibilityLabel={tr("Senda")} style={{ width: 40, height: 40, marginBottom: 2, borderRadius: 20, backgroundColor: text.trim() ? colors.brand : colors.line2, alignItems: "center", justifyContent: "center" }}>
          <Send color={text.trim() ? "#fff" : colors.ink3} size={18} />
        </Pressable>
      </View>

      <Sheet open={!!sel} onClose={() => setSel(null)} scroll={false}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: 6 }}>
          {EMOJI.map((e) => {
            const mine = sel?.reactions.find((r) => r.emoji === e)?.mine;
            return (
              <Pressable key={e} onPress={async () => { if (!me || !sel) return; const mid = sel.id; setSel(null); if (!(await setReaction(me, mid, mine ? null : e))) { toast(mid.startsWith("tmp-") ? "Bíddu þar til skilaboðin eru farin" : "Tókst ekki að vista viðbrögðin"); return; } patchReaction(mid, mine ? null : e); load(); }} style={{ backgroundColor: mine ? colors.brandSoft : colors.panel2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }}>
                <Txt size={20}>{e}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          <Row icon={<CornerUpLeft color={colors.ink2} size={19} />} title="Svara" onPress={() => { setEditing(null); setReplyTo(sel); setSel(null); }} chevron={false} />
          {sel?.body && sel.kind === "text" ? <Row icon={<Copy color={colors.ink2} size={19} />} title="Afrita texta" onPress={() => { setCopyOf(sel); setSel(null); }} chevron={false} /> : null}
          {sel && !sel.me && sel.body && sel.kind === "text" ? <Row icon={<Languages color={colors.ink2} size={19} />} title="Þýða" sub="VAKTO AI þýðir á þitt tungumál" onPress={() => { const m = sel; setSel(null); void translate(m); }} chevron={false} /> : null}
          {sel?.me && sel.kind === "text" && !sel.id.startsWith("tmp-") ? <Row icon={<Pencil color={colors.ink2} size={19} />} title="Breyta texta" onPress={() => { const m = sel; setSel(null); setReplyTo(null); setEditing(m); setText(m.body); }} chevron={false} /> : null}
          {sel && !sel.me ? <Row icon={<Flag color={colors.ink2} size={19} />} title="Tilkynna skilaboð" sub="Stjórnendur fá tilkynningu" onPress={async () => { if (!me || !sel) return; const r = await reportContent(me, "message", sel.id, sel.senderId, sel.body || (sel.kind === "image" ? "Mynd" : "Skjal")); setSel(null); toast(r.ok ? "Tilkynning send til stjórnenda" : (r.error ?? "Tókst ekki")); }} chevron={false} /> : null}
          {sel && !sel.me ? <Row icon={<Ban color={colors.bad} size={19} />} title={trf("Fela skilaboð frá {x}", sel.sender)} danger onPress={() => { const m = sel; setSel(null); if (m) setTimeout(() => Alert.alert(trf("Fela skilaboð frá {x}", m.sender), tr("Þú sérð ekki lengur skilaboð eða færslur frá viðkomandi. Þú getur opnað aftur í Stillingum."), [{ text: tr("Hætta við"), style: "cancel" }, { text: tr("Fela"), style: "destructive", onPress: async () => { if (await blockUser(m.senderId)) load(); else toast("Tókst ekki"); } }]), 350); }} chevron={false} last /> : null}
          {sel?.me ? <Row icon={<Trash2 color={colors.bad} size={19} />} title="Eyða skilaboðum" danger onPress={async () => { const m = sel; setSel(null); if (!m) return; if (!(await deleteMessage(m.id))) { toast(m.id.startsWith("tmp-") ? "Bíddu þar til skilaboðin eru farin" : "Tókst ekki að eyða skilaboðunum"); return; } patchMsg(m.id, () => null); load(); }} chevron={false} last /> : null}
        </View>
      </Sheet>
      {(() => {
        const wm = whoFor ? msgs.find((x) => x.id === whoFor) : undefined;
        const rows = (wm?.reactions ?? []).filter((r) => !whoTab || r.emoji === whoTab).flatMap((r) => r.who.map((w) => ({ w, emoji: r.emoji })));
        rows.sort((a, b) => Number(b.w.me) - Number(a.w.me) || a.w.name.localeCompare(b.w.name, "is"));
        return (
          <Sheet open={!!wm && wm.reactions.length > 0} onClose={() => setWhoFor(null)} title={tr("Viðbrögð")}>
            {wm && wm.reactions.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {[null, ...wm.reactions.map((r) => r.emoji)].map((e) => (
                  <Pressable key={e ?? "all"} onPress={() => setWhoTab(e)} style={{ backgroundColor: whoTab === e ? colors.line2 : "transparent", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Txt size={14} weight="semibold">{e ?? tr("Öll")} {e ? wm.reactions.find((r) => r.emoji === e)?.count : wm.reactions.reduce((a, r) => a + r.count, 0)}</Txt>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {rows.map(({ w, emoji }) => (
              <Pressable key={`${w.userId}-${emoji}`} disabled={!w.me} onPress={async () => { if (!me || !wm) return; const mid = wm.id; setWhoFor(null); if (!(await setReaction(me, mid, null))) { toast("Tókst ekki að fjarlægja viðbrögðin"); return; } patchReaction(mid, null); load(); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
                <Avatar name={w.name} size={44} color={w.color} photo={w.photo} />
                <View style={{ flex: 1 }}>
                  <Txt size={16} weight="semibold">{w.name}</Txt>
                  {w.me ? <Muted size={13}>{tr("Ýttu til að fjarlægja")}</Muted> : null}
                </View>
                <Txt size={26}>{emoji}</Txt>
              </Pressable>
            ))}
          </Sheet>
        );
      })()}
      <Sheet open={seenOpen && seenBy.length > 0} onClose={() => setSeenOpen(false)} title={tr("Séð af")}>
        {[...seenBy].sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt)).map((r) => {
          const d = new Date(r.lastReadAt);
          const today = d.toDateString() === new Date().toDateString();
          return (
            <View key={r.userId} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
              <Avatar name={r.name} size={44} color={r.color} photo={r.photo} />
              <View style={{ flex: 1 }}>
                <Txt size={16} weight="semibold">{r.name}</Txt>
                <Muted size={13}>{tr("Séð")} {today ? "" : `${d.getDate()}.${d.getMonth() + 1}. `}{d.toTimeString().slice(0, 5)}</Muted>
              </View>
            </View>
          );
        })}
      </Sheet>
      <Sheet open={!!copyOf} onClose={() => setCopyOf(null)} title={tr("Afrita texta")}>
        <Muted size={13} style={{ marginBottom: 10 }}>{tr("Haltu fingri á textanum til að velja og afrita hann.")}</Muted>
        <View style={{ backgroundColor: colors.panel2, borderRadius: 14, padding: 14 }}>
          {/* kerfisletur: textinn getur verið á hvaða máli sem er (General Sans vantar t.d. víetnömsk tónmerki) */}
          <Text selectable style={{ fontSize: 16, lineHeight: 22, color: colors.ink }}>{copyOf?.body ?? ""}</Text>
        </View>
      </Sheet>

      <Sheet open={info} onClose={() => { setInfo(false); setMedia(null); }}>
        {media !== null ? (
          <Pressable onPress={() => setMedia(null)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: -4 }}>
            <ChevronLeft color={colors.brandDeep} size={18} /><Txt weight="bold" size={13} color={colors.brandDeep}>Til baka</Txt>
          </Pressable>
        ) : null}
        <Txt weight="bold" size={19} style={{ letterSpacing: -0.3 }}>{media !== null ? "Myndir og skjöl" : (name ?? "Spjall")}</Txt>
        {media !== null ? (
          <>
            {media.length === 0 ? <Muted>Engar myndir eða skjöl enn.</Muted> : null}
            {media.filter((a) => a.kind === "image").length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {media.filter((a) => a.kind === "image").map((a) => (
                  <Pressable key={a.id} onPress={() => Linking.openURL(a.url)} style={{ width: "31.5%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: colors.panel2 }}>
                    <Image source={{ uri: a.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {media.filter((a) => a.kind !== "image").length ? (
              <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
                {media.filter((a) => a.kind !== "image").map((a, i, arr) => (
                  <Row key={a.id} icon={<FileText color={colors.ink2} size={19} />} title={a.name} sub={`${a.sender} · ${new Date(a.at).getDate()}.${new Date(a.at).getMonth() + 1}.${new Date(a.at).getFullYear()}`} chevron={false} onPress={() => Linking.openURL(a.url)} last={i === arr.length - 1} />
                ))}
              </View>
            ) : null}
          </>
        ) : (
        <>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          <Row icon={muted ? <Bell color={colors.ink2} size={19} /> : <BellOff color={colors.ink2} size={19} />} title={muted ? "Kveikja á tilkynningum" : "Þagga spjallið"} sub={muted ? "Þú færð aftur merki og hljóð" : "Ekkert ólesið-merki eða hljóð fyrir þetta spjall"} chevron={false} last
            onPress={async () => { if (!id) return; const m = await toggleMute(id); setMuted(m); }} />
        </View>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          {kind === "group" ? (renaming === null
            ? <Row icon={<Pencil color={colors.ink2} size={19} />} title="Breyta heiti" sub={name ?? ""} chevron={false} onPress={() => setRenaming(name ?? "")} />
            : (
              <View style={{ padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
                <TextInput value={renaming} onChangeText={setRenaming} autoFocus maxLength={60} placeholder={tr("Heiti hóps")} placeholderTextColor={colors.ink3} returnKeyType="done" onSubmitEditing={saveName}
                  style={{ fontFamily: font.medium, fontSize: 16, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }} />
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                  <Pressable onPress={() => setRenaming(null)} style={{ paddingHorizontal: 14, paddingVertical: 9 }}><Txt weight="semibold" color={colors.ink2}>{tr("Hætta við")}</Txt></Pressable>
                  <Pressable onPress={saveName} style={{ backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }}><Txt weight="semibold" color="#fff">{tr("Vista")}</Txt></Pressable>
                </View>
              </View>
            )) : null}
          <Row icon={<Images color={colors.ink2} size={19} />} title="Myndir og skjöl" sub="Allt sem hefur verið sent í spjallinu" onPress={openMedia} last={kind === "general"} />
          {kind !== "general" ? <Row icon={<LogOut color={colors.bad} size={19} />} title={kind === "dm" ? "Eyða samtali" : "Yfirgefa hóp"} danger chevron={false} onPress={() => setConfirm("leave")} last={!(kind === "group" && mine)} /> : null}
          {kind === "group" && mine ? <Row icon={<Trash2 color={colors.bad} size={19} />} title="Eyða hópnum fyrir alla" danger chevron={false} onPress={() => setConfirm("delete")} last /> : null}
        </View>
        {confirm ? (
          <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, padding: 14, gap: 10 }}>
            <Txt weight="bold" size={15}>{tr(confirm === "delete" ? "Eyða hópnum fyrir alla?" : kind === "dm" ? "Eyða samtali?" : "Yfirgefa hóp?")}</Txt>
            <Muted>{tr(confirm === "delete" ? "Öll skilaboð og myndir eyðast hjá öllum. Ekki er hægt að afturkalla það." : kind === "dm" ? "Samtalið hverfur úr listanum þínum. Hinn aðilinn sér það áfram." : "Þú hættir að fá skilaboð úr hópnum og hann hverfur úr listanum þínum.")}</Muted>
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
              <Pressable onPress={() => setConfirm(null)} disabled={busy} style={{ paddingHorizontal: 14, paddingVertical: 9 }}><Txt weight="semibold" color={colors.ink2}>{tr("Hætta við")}</Txt></Pressable>
              <Pressable onPress={doConfirm} disabled={busy} style={{ backgroundColor: colors.bad, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, opacity: busy ? 0.6 : 1 }}>
                <Txt weight="semibold" color="#fff">{tr(busy ? "Augnablik…" : confirm === "delete" ? "Eyða" : kind === "dm" ? "Eyða" : "Yfirgefa")}</Txt>
              </Pressable>
            </View>
          </View>
        ) : null}
        <Txt weight="bold" size={12} color={colors.ink3} style={{ letterSpacing: 0.8, marginTop: 4 }}>{isGroup ? trf("MEÐLIMIR · {n}", memberList.length || members) : tr("ÞÁTTTAKENDUR")}</Txt>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          {memberList.length === 0 ? <Muted style={{ padding: 14 }}>Sæki…</Muted> : null}
          {memberList.map((p, i) => (
            <Row key={p.userId} icon={<Avatar name={p.name} size={36} color={p.color} photo={p.photo} />} title={p.name} sub={[p.role, p.dept].filter(Boolean).join(" · ") || "Starfsmaður"} chevron={false} last={i === memberList.length - 1} />
          ))}
        </View>
        </>
        )}
      </Sheet>
      {/* mynd í fullri stærð — opnast í appinu, ekki í vafra */}
      <ImageViewer url={viewer} onClose={() => setViewer(null)} />
    </KeyboardAvoidingView>
  );
}

const TIME_W = 58;

/** Mynd? Líka skjal með myndarendingu (eldri skilaboð og skrár úr „Skrár“ án MIME-tegundar). */
const IMG_RE = /\.(jpe?g|png|gif|webp|heic|heif)(\?|$)/i;
const isImage = (m: ChatMessage) => !!m.url && (m.kind === "image" || (m.kind === "file" && (IMG_RE.test(m.url) || IMG_RE.test(m.body))));

/** „•••“ sem dúar, eins og í Messenger. */
function TypingDots() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 3, duration: 1200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink3, opacity: t.interpolate({ inputRange: [i, i + 0.5, i + 1], outputRange: [0.35, 1, 0.35], extrapolate: "clamp" }), transform: [{ translateY: t.interpolate({ inputRange: [i, i + 0.5, i + 1], outputRange: [0, -2, 0], extrapolate: "clamp" }) }] }} />
      ))}
    </View>
  );
}

/** @-merkingar feitletraðar í kúlunni; ef ég var nefnd(ur) er bakgrunnur á nafninu. */
function withTags(text: string, people: MentionPerson[], meUid: string | null | undefined, mine: boolean): React.ReactNode {
  if (!people.length || !text.includes("@")) return text;
  return splitMentions(text, people).map((x, i) => (x.userId
    ? <Text key={i} style={{ fontFamily: font.bold, color: mine ? "#fff" : colors.brandDeep, backgroundColor: x.userId === meUid ? "rgba(245,147,49,.22)" : undefined, textDecorationLine: mine ? "underline" : "none" }}>{x.text}</Text>
    : x.text));
}

function Bubble({ item, onLong, onImage, onReactions, translated, onToggleOriginal, showingOriginal, tagPeople = [], meUid }: {
  item: Extract<RowItem, { kind: "msg" }>; onLong: () => void; onImage: (url: string) => void; onReactions: () => void;
  translated?: string; onToggleOriginal?: () => void; showingOriginal?: boolean;
  tagPeople?: MentionPerson[]; meUid?: string | null;
}) {
  const { m, first, last, showSender } = item;
  const img = isImage(m);
  const r = 18, s = 6;
  const radius = m.me
    ? { borderTopLeftRadius: r, borderBottomLeftRadius: r, borderTopRightRadius: first ? r : s, borderBottomRightRadius: last ? r : s }
    : { borderTopRightRadius: r, borderBottomRightRadius: r, borderTopLeftRadius: first ? r : s, borderBottomLeftRadius: last ? r : s };
  return (
    <View style={{ marginBottom: last ? 8 : 2 }}>
      {showSender ? <Txt size={12} color={colors.ink3} style={{ marginLeft: 48, marginBottom: 3 }}>{m.senderFull}</Txt> : null}
      {/* „Breytt“ fyrir ofan kúluna, eins og í Messenger */}
      {m.edited ? <Txt size={11.5} color={colors.ink3} style={{ alignSelf: m.me ? "flex-end" : "flex-start", marginLeft: m.me ? 0 : 48, marginRight: m.me ? 6 : 0, marginTop: showSender ? 0 : 4, marginBottom: 2 }}>{tr("Breytt")}</Txt> : null}
      <View style={{ flexDirection: m.me ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, maxWidth: "82%", alignSelf: m.me ? "flex-end" : "flex-start", paddingBottom: m.reactions.length ? 15 : 0 }}>
        {!m.me ? <View style={{ width: 28, opacity: last ? 1 : 0 }}><Avatar name={m.senderFull} size={28} color={m.color} photo={m.photo} /></View> : null}
        <Pressable onLongPress={onLong} delayLongPress={250} style={{ backgroundColor: m.me ? colors.brand : colors.bubbleThem, paddingHorizontal: img ? 4 : 13, paddingVertical: img ? 4 : 9, ...radius, position: "relative", flexShrink: 1 }}>
          {m.replyTo ? (
            <View style={{ borderLeftWidth: 2, borderLeftColor: m.me ? "rgba(255,255,255,.6)" : colors.brand, paddingLeft: 8, marginBottom: 6 }}>
              <Txt size={11.5} weight="bold" color={m.me ? "rgba(255,255,255,.9)" : colors.brandDeep}>{m.replyTo.sender}</Txt>
              <Txt size={12.5} color={m.me ? "rgba(255,255,255,.85)" : colors.ink2} numberOfLines={2}>{m.replyTo.body}</Txt>
            </View>
          ) : null}
          {img && m.url ? <Pressable onPress={() => m.url && onImage(m.url)} onLongPress={onLong} delayLongPress={250}><Image source={{ uri: m.url }} style={{ width: 230, height: 230, borderRadius: 12, marginBottom: m.kind === "image" && m.body ? 6 : 0 }} contentFit="cover" transition={120} /></Pressable> : null}
          {img ? (m.kind === "image" && m.body ? <Txt size={15} color={m.me ? "#fff" : colors.ink} style={{ lineHeight: 20 }}>{m.body}</Txt> : null) : m.kind === "file" && m.url ? (
            <Pressable onPress={() => m.url && Linking.openURL(m.url)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: m.me ? "rgba(255,255,255,.2)" : colors.panel, alignItems: "center", justifyContent: "center" }}><FileText color={m.me ? "#fff" : colors.ink2} size={18} /></View>
              <View style={{ flexShrink: 1 }}><Txt weight="bold" size={14} color={m.me ? "#fff" : colors.ink} numberOfLines={2}>{m.body || "Skjal"}</Txt><Txt size={11.5} color={m.me ? "rgba(255,255,255,.8)" : colors.ink3}>Ýttu til að opna</Txt></View>
            </Pressable>
          ) : m.body ? <Txt size={16} color={m.me ? "#fff" : colors.ink} style={{ lineHeight: 21 }}>{withTags(translated ?? m.body, tagPeople, meUid, m.me)}</Txt> : null}
          {onToggleOriginal ? (
            <Txt onPress={onToggleOriginal} suppressHighlighting weight="medium" size={11.5} color={m.me ? "rgba(255,255,255,.8)" : colors.ink3} style={{ marginTop: 3 }}>
              {showingOriginal ? tr("Sýna þýðingu") : tr("Þýtt · Sýna frumtexta")}
            </Txt>
          ) : null}
        </Pressable>
        {/* utan við kúluna svo hægt sé að ýta á það (snerting utan marka foreldris skráist ekki) */}
        {m.reactions.length ? (
          <Pressable onPress={onReactions} hitSlop={8} accessibilityLabel={tr("Viðbrögð")} style={{ position: "absolute", bottom: 0, [m.me ? "left" : "right"]: 10, height: 20, flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 5, gap: 2 }}>
            {m.reactions.map((x) => <Txt key={x.emoji} size={10.5} style={{ lineHeight: 14 }}>{x.emoji}{x.count > 1 ? ` ${x.count}` : ""}</Txt>)}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
