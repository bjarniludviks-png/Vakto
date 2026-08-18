// Spjall — samtalalisti (Almennt fest efst, síðan eftir virkni). Pollar á 10 s.
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Megaphone, Users, User } from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted } from "../../src/components/ui";
import { colors } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listConversations, type Conversation } from "../../src/lib/api/chat";

function KindIcon({ kind }: { kind: Conversation["kind"] }) {
  const P = kind === "general" ? Megaphone : kind === "group" ? Users : User;
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: colors.brandSoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <P color={colors.brandDeep} size={18} />
    </View>
  );
}

export default function Spjall() {
  const { me } = useMe();
  const router = useRouter();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    setConvs(await listConversations(me));
    setLoaded(true);
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 10000);
      return () => clearInterval(t);
    }, [load])
  );

  return (
    <Screen
      title="Spjall"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {loaded && convs.length === 0 ? (
        <Card>
          <Muted>Engin samtöl ennþá — Almennt rásin birtist þegar fyrirtækið notar spjallið.</Muted>
        </Card>
      ) : null}
      {convs.map((c) => (
        <Pressable key={c.id} onPress={() => router.push(`/spjall/${c.id}?name=${encodeURIComponent(c.name)}`)}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <KindIcon kind={c.kind} />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={15}>
                {c.name}
              </Txt>
              <Muted size={13}>{c.last ?? "Engin skilaboð"}</Muted>
            </View>
            {c.lastAt ? (
              <Muted size={11}>{new Date(c.lastAt).toTimeString().slice(0, 5)}</Muted>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
