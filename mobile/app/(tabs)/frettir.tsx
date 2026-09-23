// Fréttir — fréttaveita fyrirtækisins: fest efst, myndir, viðbrögð, athugasemdir,
// ný færsla með mynd og „festa efst“ (stjórnendur).
import React, { useCallback, useEffect, useState } from "react";
import { View, TextInput, Pressable, ScrollView, RefreshControl, Switch } from "react-native";
import { useFocusEffect } from "expo-router";
import { Plus, Heart, MessageSquare, Pin, ImagePlus, Send, Trash2 } from "lucide-react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Header, IconBtn } from "../../src/components/screen";
import { Txt, Muted, Avatar, Sheet, Btn, Empty, useToast, Pill } from "../../src/components/ui";
import { colors, font } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listPosts, createPost, setPostReaction, addPostComment, setPinned, deletePost, canPin as canPinFn, uploadImage, REACTIONS, type FeedPost } from "../../src/lib/api/feed";
import { inputStyle, Field } from "../../src/components/request-sheets";

export default function Frettir() {
  const { me } = useMe();
  const toast = useToast();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [canPin, setCanPin] = useState(false);
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState("");
  const [pin, setPin] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [reactFor, setReactFor] = useState<FeedPost | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    try { setPosts(await listPosts(me)); } catch (e) { console.warn("feed", e); }
  }, [me]);
  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]));
  useEffect(() => { canPinFn().then(setCanPin); }, [me]);

  async function pickImage() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: false });
    if (!r.canceled && r.assets[0]) setImg(r.assets[0].uri);
  }
  async function publish() {
    const body = draft.trim();
    if (!me || !body) return;
    setBusy(true);
    let imageUrl: string | null = null;
    if (img) {
      const up = await uploadImage(me, img, img.toLowerCase().endsWith(".png") ? "png" : "jpg");
      if (!up.ok) { toast(up.error ?? "Mynd hlóðst ekki upp"); setBusy(false); return; }
      imageUrl = up.url ?? null;
    }
    const r = await createPost(me, body, { pinned: canPin && pin, imageUrl });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Tókst ekki að birta"); return; }
    setDraft(""); setImg(null); setPin(false); setCompose(false);
    toast("Birt í fréttaveitu");
    load();
  }
  async function react(p: FeedPost, emoji: string) {
    if (!me) return;
    setReactFor(null);
    await setPostReaction(me, p.id, p.myReaction === emoji ? null : emoji);
    load();
  }
  async function sendComment(p: FeedPost) {
    const body = comment.trim();
    if (!me || !body) return;
    setComment(""); setCommentFor(null);
    await addPostComment(me, p.id, body);
    load();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Fréttaveita" right={<IconBtn label="Ný færsla" onPress={() => setCompose(true)}><Plus color={colors.ink} size={24} /></IconBtn>} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}>
        {posts && posts.length === 0 ? <Empty icon={<MessageSquare color={colors.brandDeep} size={26} />} title="Engar færslur enn" sub="Ýttu á + til að deila því fyrsta með vinnustaðnum." /> : null}
        {(posts ?? []).map((p) => {
          const total = p.reactions.reduce((a, r) => a + r.count, 0);
          return (
            <View key={p.id} style={{ backgroundColor: p.pinned ? colors.brandSoft : colors.panel, borderRadius: 18, borderWidth: 1, borderColor: p.pinned ? colors.brand2 : colors.line2, overflow: "hidden" }}>
              {p.pinned ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingTop: 10 }}><Pin color={colors.brandDeep} size={13} /><Txt weight="bold" size={11} color={colors.brandDeep} style={{ letterSpacing: 0.6 }}>FEST EFST</Txt></View> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 8 }}>
                <Avatar name={p.sender} size={38} color={p.system ? colors.brand : p.color} photo={p.photo} />
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" size={14}>{p.sender}</Txt>
                  <Muted size={12}>{[p.senderRole, p.at].filter(Boolean).join(" · ")}</Muted>
                </View>
                {canPin ? (
                  <Pressable onPress={async () => { await setPinned(p.id, !p.pinned); load(); }} hitSlop={8} style={{ padding: 6 }}>
                    <Pin color={p.pinned ? colors.brandDeep : colors.ink3} size={18} fill={p.pinned ? colors.brandDeep : "transparent"} />
                  </Pressable>
                ) : null}
                {p.me || canPin ? (
                  <Pressable onPress={async () => { await deletePost(p.id); toast("Færslu eytt"); load(); }} hitSlop={8} style={{ padding: 6 }}><Trash2 color={colors.ink3} size={17} /></Pressable>
                ) : null}
              </View>
              <Txt size={14.5} style={{ lineHeight: 21, paddingHorizontal: 14, paddingBottom: 12 }}>{p.body}</Txt>
              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={{ width: "100%", height: 200 }} contentFit="cover" /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: p.pinned ? "rgba(207,95,12,.15)" : colors.line2 }}>
                <Pressable onPress={() => react(p, p.myReaction ?? "❤️")} onLongPress={() => setReactFor(p)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                  {p.myReaction && p.myReaction !== "❤️" ? <Txt size={16}>{p.myReaction}</Txt> : <Heart color={p.myReaction ? colors.brand : colors.ink2} size={18} fill={p.myReaction ? colors.brand : "transparent"} />}
                  <Txt weight="bold" size={13} color={p.myReaction ? colors.brand : colors.ink2}>{total || ""}</Txt>
                  {p.reactions.length > 1 || (p.reactions.length === 1 && p.reactions[0].emoji !== "❤️") ? <Txt size={12} color={colors.ink3}>{p.reactions.map((r) => r.emoji).join("")}</Txt> : null}
                </Pressable>
                <Pressable onPress={() => setCommentFor(commentFor === p.id ? null : p.id)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                  <MessageSquare color={colors.ink2} size={18} />
                  <Txt weight="bold" size={13} color={colors.ink2}>{p.comments.length || ""}</Txt>
                </Pressable>
              </View>
              {p.comments.length ? (
                <View style={{ gap: 8, paddingHorizontal: 14, paddingBottom: 12 }}>
                  {p.comments.map((c) => (
                    <View key={c.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <Avatar name={c.sender} size={24} color={c.color} photo={c.photo} />
                      <View style={{ flex: 1, backgroundColor: p.pinned ? "rgba(255,255,255,.6)" : colors.panel2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }}>
                        <Txt weight="bold" size={12}>{c.sender} <Txt size={11} color={colors.ink3}>· {c.at}</Txt></Txt>
                        <Txt size={13.5}>{c.body}</Txt>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {commentFor === p.id ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", paddingHorizontal: 14, paddingBottom: 12 }}>
                  <TextInput style={[inputStyle, { flex: 1, paddingVertical: 9, borderRadius: 20 }]} value={comment} onChangeText={setComment} placeholder="Skrifa athugasemd…" placeholderTextColor={colors.ink3} autoFocus onSubmitEditing={() => sendComment(p)} />
                  <Pressable onPress={() => sendComment(p)} disabled={!comment.trim()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: comment.trim() ? colors.brand : colors.line2, alignItems: "center", justifyContent: "center" }}>
                    <Send color={comment.trim() ? "#fff" : colors.ink3} size={16} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Sheet open={compose} onClose={() => setCompose(false)} title="Ný færsla">
        <Muted>Birtist í fréttaveitu fyrirtækisins. Allir á vinnustaðnum sjá hana.</Muted>
        <TextInput style={[inputStyle, { minHeight: 110, textAlignVertical: "top", fontSize: 16 }]} multiline value={draft} onChangeText={setDraft} placeholder="Hvað viltu segja starfsfólkinu?" placeholderTextColor={colors.ink3} autoFocus />
        {img ? (
          <View>
            <Image source={{ uri: img }} style={{ width: "100%", height: 160, borderRadius: 12 }} contentFit="cover" />
            <Pressable onPress={() => setImg(null)} style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,.55)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Txt weight="bold" size={12} color="#fff">Fjarlægja</Txt></Pressable>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Btn title={img ? "Skipta um mynd" : "Bæta við mynd"} variant="ghost" size="sm" icon={<ImagePlus color={colors.ink} size={16} />} onPress={pickImage} />
          {canPin ? (
            <Pressable onPress={() => setPin((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, backgroundColor: pin ? colors.brandSoft : colors.panel2, borderWidth: 1, borderColor: pin ? colors.brand2 : colors.line }}>
              <Pin color={pin ? colors.brandDeep : colors.ink} size={16} />
              <Txt weight="bold" size={13} color={pin ? colors.brandDeep : colors.ink}>{pin ? "Fest efst ✓" : "Festa efst"}</Txt>
            </Pressable>
          ) : null}
        </View>
        {canPin ? <Muted size={12}>Sem stjórnandi sendir þú push-tilkynningu til alls starfsfólks þegar þú birtir.</Muted> : null}
        <Btn title="Birta" size="lg" loading={busy} disabled={!draft.trim()} onPress={publish} />
      </Sheet>

      <Sheet open={!!reactFor} onClose={() => setReactFor(null)} scroll={false}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {REACTIONS.map((e) => (
            <Pressable key={e} onPress={() => reactFor && react(reactFor, e)} style={{ backgroundColor: reactFor?.myReaction === e ? colors.brandSoft : colors.panel2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }}>
              <Txt size={22}>{e}</Txt>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}
