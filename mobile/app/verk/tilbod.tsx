// VAKTO Verk, fasi 2 (0104): tilboð — staða, deila hlekk; samþykkt tilboð opnar verkið. Tilboð eru skrifuð á vefnum
// (eða með VAKTO AI) þar sem línurnar komast fyrir.
import React, { useCallback, useState } from "react";
import { View, Pressable, Share, Linking } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FileText } from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Pill, Btn, Empty, useToast } from "../../src/components/ui";
import { colors, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { listQuotes, sendQuote, kr, type QuoteRow } from "../../src/lib/api/verk";

const LABEL: Record<QuoteRow["status"], string> = { draft: "Drög", sent: "Sent", accepted: "Samþykkt", declined: "Hafnað" };
const TONE: Record<QuoteRow["status"], "neutral" | "warn" | "good" | "bad"> = { draft: "neutral", sent: "warn", accepted: "good", declined: "bad" };

export default function Tilbod() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<QuoteRow[] | null>(null);
  const load = useCallback(async () => { if (me) setRows(await listQuotes(me)); }, [me]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function share(q: QuoteRow) {
    const r = await sendQuote(q);
    if (!r.ok || !r.url) { toast(r.error ?? "Tókst ekki"); return; }
    await Share.share({ message: `Tilboð í ${q.title}:\n${r.url}` });
    void load();
  }

  return (
    <Screen title="Tilboð" back>
      <Muted size={13}>Skrifaðu tilboð á vakto.is eða biddu VAKTO AI um drög. Hér sérðu stöðuna og sendir hlekkinn.</Muted>
      {rows && rows.length === 0 ? <Empty icon={<FileText color={colors.ink3} size={26} />} title="Engin tilboð enn" sub="Tilboð sem þú býrð til birtast hér." /> : null}
      {(rows ?? []).map((q) => (
        <Card key={q.id} style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={15} numberOfLines={1}>#{q.number} · {q.title}</Txt>
              <Muted size={12.5}>{[q.client, q.signedName ? `${LABEL[q.status]} af ${q.signedName}` : null].filter(Boolean).join(" · ") || "—"}</Muted>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}><Txt weight="bold" size={14}>{kr(q.total)}</Txt><Pill tone={TONE[q.status]} label={LABEL[q.status]} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {q.status === "draft" || q.status === "sent" ? <View style={{ flex: 1 }}><Btn size="sm" title={q.status === "draft" ? "Senda" : "Deila hlekk"} onPress={() => share(q)} /></View> : null}
            {q.jobId ? <View style={{ flex: 1 }}><Btn size="sm" variant="ghost" title="Opna verk" onPress={() => router.push(`/verk/${q.jobId}`)} /></View> : null}
            {q.status !== "draft" ? <Pressable onPress={() => Linking.openURL(`https://www.vakto.is/tilbod/${q.token}`)} style={{ justifyContent: "center", paddingHorizontal: 8 }}><Txt size={13} weight="semibold" color={colors.brandDeep}>Skoða</Txt></Pressable> : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
