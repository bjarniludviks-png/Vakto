// Skjalasafn — sameiginleg skjöl fyrirtækisins (HACCP, handbækur …) + skjölin mín.
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { FileText, FolderOpen } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, SectionTitle, Pill } from "../src/components/ui";
import { colors } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { listDocs, signedUrl, type DocRow } from "../src/lib/api/docs";

export default function Skjol() {
  const { me } = useMe();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    setDocs(await listDocs(me));
    setLoaded(true);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(doc: DocRow) {
    setError(null);
    const r = await signedUrl(doc.path);
    if (!r.ok || !r.url) {
      setError(r.error ?? "Tókst ekki að opna skjalið.");
      return;
    }
    await WebBrowser.openBrowserAsync(r.url);
  }

  const shared = docs.filter((d) => d.shared);
  const mine = docs.filter((d) => !d.shared);

  function DocList({ rows }: { rows: DocRow[] }) {
    return (
      <View style={{ gap: 4 }}>
        {rows.map((d) => (
          <Pressable key={d.id} onPress={() => open(d)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 }}>
              <FileText color={colors.brand} size={18} />
              <View style={{ flex: 1 }}>
                <Txt weight="medium" size={14} numberOfLines={1}>
                  {d.name}
                </Txt>
                <Muted size={11}>{d.created}</Muted>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Screen
      title="Skjalasafn"
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {error ? (
        <Card style={{ backgroundColor: colors.badSoft, borderColor: colors.bad }}>
          <Txt color={colors.bad} size={13}>
            {error}
          </Txt>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <SectionTitle>Skjöl fyrirtækisins</SectionTitle>
          <Pill label={`${shared.length}`} tone="brand" />
        </View>
        {loaded && shared.length === 0 ? (
          <Muted>Engin sameiginleg skjöl ennþá.</Muted>
        ) : (
          <DocList rows={shared} />
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <SectionTitle>Skjölin mín</SectionTitle>
          <Pill label={`${mine.length}`} />
        </View>
        {loaded && mine.length === 0 ? (
          <Muted>Engin skjöl skráð á þig.</Muted>
        ) : (
          <DocList rows={mine} />
        )}
      </Card>
    </Screen>
  );
}
