// Fréttir — fréttaveita fyrirtækisins: póstar, viðbrögð, athugasemdir.
import React, { useCallback, useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Pin, MessageSquare, Send } from "lucide-react-native";
import { Image } from "expo-image";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Avatar } from "../../src/components/ui";
import { colors, radius, font } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import {
  listPosts,
  createPost,
  setPostReaction,
  addPostComment,
  REACTIONS,
  type FeedPost,
} from "../../src/lib/api/feed";

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.control,
  paddingHorizontal: 12,
  paddingVertical: 9,
  fontSize: 14,
  fontFamily: font.regular,
  color: colors.ink,
  backgroundColor: colors.panel,
} as const;

export default function Frettir() {
  const { me } = useMe();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (!me) return;
    setPosts(await listPosts(me));
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 10000);
      return () => clearInterval(t);
    }, [load])
  );

  async function post() {
    const body = draft.trim();
    if (!me || !body) return;
    setBusy(true);
    const r = await createPost(me, body);
    setBusy(false);
    if (r.ok) {
      setDraft("");
      load();
    }
  }

  async function react(p: FeedPost, emoji: string) {
    if (!me) return;
    await setPostReaction(me, p.id, p.myReaction === emoji ? null : emoji);
    load();
  }

  async function sendComment(p: FeedPost) {
    const body = comment.trim();
    if (!me || !body) return;
    setComment("");
    setCommentFor(null);
    await addPostComment(me, p.id, body);
    load();
  }

  return (
    <Screen
      title="Fréttir"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Card style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
        <TextInput
          style={[inputStyle, { flex: 1, maxHeight: 90 }]}
          multiline
          value={draft}
          onChangeText={setDraft}
          placeholder="Deildu frétt með vinnustaðnum…"
          placeholderTextColor={colors.ink3}
        />
        <Pressable
          onPress={post}
          disabled={!draft.trim() || busy}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: draft.trim() ? colors.brand : colors.line2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send color={draft.trim() ? "#fff" : colors.ink3} size={16} />
        </Pressable>
      </Card>

      {posts.map((p) => (
        <Card key={p.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Avatar name={p.sender} size={34} />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={14}>
                {p.sender}
              </Txt>
              <Muted size={11}>{p.at}</Muted>
            </View>
            {p.pinned ? <Pin color={colors.brand} size={16} /> : null}
          </View>

          <Txt size={14} style={{ lineHeight: 20 }}>
            {p.body}
          </Txt>
          {p.imageUrl ? (
            <Image
              source={{ uri: p.imageUrl }}
              style={{ width: "100%", height: 200, borderRadius: 10 }}
              contentFit="cover"
            />
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {REACTIONS.map((e) => {
              const count = p.reactions.find((r) => r.emoji === e)?.count ?? 0;
              const mine = p.myReaction === e;
              if (!count && !mine && e !== "👍" && e !== "❤️") return null;
              return (
                <Pressable
                  key={e}
                  onPress={() => react(p, e)}
                  style={{
                    flexDirection: "row",
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: radius.pill,
                    backgroundColor: mine ? colors.brandSoft : colors.line2,
                    borderWidth: mine ? 1 : 0,
                    borderColor: colors.brand,
                  }}
                >
                  <Txt size={13}>{e}</Txt>
                  {count ? (
                    <Txt size={12} weight="medium" color={colors.ink2}>
                      {count}
                    </Txt>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setCommentFor(commentFor === p.id ? null : p.id)}
              style={{ flexDirection: "row", gap: 4, alignItems: "center", marginLeft: "auto" }}
            >
              <MessageSquare color={colors.ink3} size={16} />
              <Muted size={12}>{p.comments.length}</Muted>
            </Pressable>
          </View>

          {p.comments.length ? (
            <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 8 }}>
              {p.comments.map((c) => (
                <View key={c.id} style={{ flexDirection: "row", gap: 6 }}>
                  <Txt weight="semibold" size={12} color={colors.brandDeep}>
                    {c.sender}
                  </Txt>
                  <Txt size={12} style={{ flex: 1 }}>
                    {c.body}
                  </Txt>
                  <Muted size={10}>{c.at}</Muted>
                </View>
              ))}
            </View>
          ) : null}

          {commentFor === p.id ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={comment}
                onChangeText={setComment}
                placeholder="Skrifa athugasemd…"
                placeholderTextColor={colors.ink3}
                autoFocus
                onSubmitEditing={() => sendComment(p)}
              />
              <Pressable
                onPress={() => sendComment(p)}
                disabled={!comment.trim()}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: comment.trim() ? colors.brand : colors.line2,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send color={comment.trim() ? "#fff" : colors.ink3} size={15} />
              </Pressable>
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
