// Spjallþráður — skilaboð + sending, pollar á 4 s (eins og vefurinn).
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Send } from "lucide-react-native";
import { Image } from "expo-image";
import { Txt, Muted, Avatar } from "../../src/components/ui";
import { colors, radius, font } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listMessages, sendChatMessage, type ChatMessage } from "../../src/lib/api/chat";

export default function Thread() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { me } = useMe();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!me || !id) return;
    setMsgs(await listMessages(me, id));
  }, [me, id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 4000);
      return () => clearInterval(t);
    }, [load])
  );

  async function send() {
    const body = text.trim();
    if (!me || !id || !body || sending) return;
    setSending(true);
    setText("");
    await sendChatMessage(me, id, body);
    await load();
    setSending(false);
    list.current?.scrollToEnd({ animated: true });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          backgroundColor: colors.panel,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft color={colors.ink} size={22} />
        </Pressable>
        <Txt weight="semibold" size={17}>
          {name ?? "Spjall"}
        </Txt>
      </View>

      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: m }) => (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignSelf: m.me ? "flex-end" : "flex-start",
              maxWidth: "82%",
            }}
          >
            {!m.me ? <Avatar name={m.sender} size={28} /> : null}
            <View
              style={{
                backgroundColor: m.me ? colors.brand : colors.panel,
                borderRadius: radius.card,
                borderWidth: m.me ? 0 : 1,
                borderColor: colors.line,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              {!m.me ? (
                <Txt weight="semibold" size={11} color={colors.brandDeep}>
                  {m.sender}
                </Txt>
              ) : null}
              {m.kind === "image" && m.url ? (
                <Image
                  source={{ uri: m.url }}
                  style={{ width: 200, height: 150, borderRadius: 8, marginVertical: 4 }}
                  contentFit="cover"
                />
              ) : null}
              {m.body ? (
                <Txt size={14} color={m.me ? "#fff" : colors.ink}>
                  {m.body}
                </Txt>
              ) : null}
              <Txt size={10} color={m.me ? "#ffffffaa" : colors.ink3} style={{ marginTop: 2 }}>
                {m.at}
              </Txt>
            </View>
          </View>
        )}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 10,
          padding: 12,
          paddingBottom: Math.max(12, insets.bottom),
          backgroundColor: colors.panel,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      >
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: radius.pill,
            paddingHorizontal: 14,
            paddingVertical: 9,
            fontSize: 14,
            fontFamily: font.regular,
            color: colors.ink,
            maxHeight: 100,
          }}
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Skrifaðu skilaboð…"
          placeholderTextColor={colors.ink3}
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: text.trim() ? colors.brand : colors.line2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send color={text.trim() ? "#fff" : colors.ink3} size={18} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
