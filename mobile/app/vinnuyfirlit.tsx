// Vinnuyfirlit — skoða eigið yfirlit og staðfesta eða gera athugasemd (0084).
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { FileCheck } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, SectionTitle, Pill, Btn, KV, Empty, useToast } from "../src/components/ui";
import { inputStyle } from "../src/components/request-sheets";
import { colors, useTheme, type Tone } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { tr } from "../src/lib/i18n";
import { dec1, kr } from "../src/lib/format";
import { signedUrl } from "../src/lib/api/docs";
import { listMyOverviews, respondOverview, overviewPdfPath, type MyOverview, type WoStatus } from "../src/lib/api/overview";

const STATUS: Record<WoStatus, { label: string; tone: Tone }> = {
  draft: { label: "Drög", tone: "neutral" },
  sent: { label: "Bíður staðfestingar", tone: "warn" },
  employee_approved: { label: "Þú staðfestir", tone: "brand" },
  employee_flagged: { label: "Athugasemd send", tone: "warn" },
  final: { label: "Lokið", tone: "good" },
};
const DOW = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const nice = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}.${m}.${y}`; };
const LEAVE: Record<string, string> = { orlof: "Orlof", veikindi: "Veikindi", olaunad: "Launalaust" };

export default function Vinnuyfirlit() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const [rows, setRows] = useState<MyOverview[] | null>([]);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState<MyOverview | null>(null);
  const [flag, setFlag] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    const r = await listMyOverviews(me.empId);
    setRows(r);
    setSel((cur) => (cur ? r?.find((x) => x.id === cur.id) ?? null : r?.find((x) => x.status === "sent") ?? r?.[0] ?? null));
    setLoaded(true);
  }, [me]);
  useEffect(() => { load(); }, [load]);

  async function respond(approve: boolean) {
    if (!sel) return;
    setBusy(true);
    const r = await respondOverview(sel.id, approve, note);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    toast(approve ? "Takk — yfirlitið er staðfest" : "Athugasemd send til stjórnanda");
    setFlag(false); setNote("");
    await load();
  }
  async function openPdf() {
    if (!sel?.documentId) return;
    const path = await overviewPdfPath(sel.documentId);
    const r = path ? await signedUrl(path) : { ok: false as const, error: "PDF fannst ekki" };
    if (!r.ok || !r.url) { toast(r.error ?? "Tókst ekki að opna PDF"); return; }
    await WebBrowser.openBrowserAsync(r.url);
  }

  const s = sel?.snapshot;
  return (
    <Screen title="Vinnuyfirlit" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {loaded && (!rows || rows.length === 0) ? (
        <Empty icon={<FileCheck color={colors.ink3} size={28} />} title={rows ? "Engin vinnuyfirlit enn" : "Vinnuyfirlit eru ekki virk enn"} sub="Þegar stjórnandi sendir þér yfirlit tímabilsins birtist það hér til staðfestingar." />
      ) : null}

      {rows && rows.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => { setSel(r); setFlag(false); }} style={{ paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: sel?.id === r.id ? colors.brand : colors.line, backgroundColor: colors.panel }}>
              <Txt size={12.5} weight="semibold">{`${nice(r.from)} – ${nice(r.to)}`}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      {sel && s ? (
        <>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <SectionTitle>{`${nice(sel.from)} – ${nice(sel.to)}`}</SectionTitle>
              <Pill label={tr(STATUS[sel.status].label)} tone={STATUS[sel.status].tone} />
            </View>
            <KV k="Á plani" v={`${dec1(s.totals.planned)} klst`} />
            <KV k="Unnið" v={`${dec1(s.totals.worked)} klst`} />
            <KV k="Frávik" v={`${s.totals.diff > 0.05 ? "+" : s.totals.diff < -0.05 ? "−" : ""}${dec1(Math.abs(s.totals.diff))} klst`} />
            <KV k="Brúttólaun" v={kr(s.pay.gross)} last />
            {s.pendingPunches > 0 ? <Muted size={12}>{`${s.pendingPunches} ${tr("stimplanir biðu samþykktar og eru ekki með í yfirlitinu.")}`}</Muted> : null}
          </Card>

          <Card>
            <SectionTitle>Dagar</SectionTitle>
            {s.days.length === 0 ? <Muted>Engar vaktir eða vinnustundir á tímabilinu.</Muted> : s.days.map((d, i) => {
              const off = Math.abs(d.worked - d.planned) >= 0.05;
              return (
                <View key={d.date} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line2 }}>
                  <View style={{ flex: 1 }}>
                    <Txt size={13.5} weight="semibold">{`${tr(DOW[new Date(`${d.date}T12:00:00Z`).getUTCDay()])} ${nice(d.date)}`}</Txt>
                    <Muted size={11.5}>{[d.plannedText ? `${tr("Plan")} ${d.plannedText}` : null, d.punches.length ? d.punches.map((p) => `${p.in}–${p.out}`).join(", ") : null, d.leave ? tr(LEAVE[d.leave] ?? d.leave) : null, d.breakMin ? `${tr("hlé")} ${d.breakMin} ${tr("mín")}` : null].filter(Boolean).join(" · ")}</Muted>
                  </View>
                  <Txt size={13.5} weight="bold" color={off ? colors.warn : colors.ink} style={{ fontVariant: ["tabular-nums"] }}>{`${dec1(d.worked)} / ${dec1(d.planned)}`}</Txt>
                </View>
              );
            })}
          </Card>

          <Card>
            <SectionTitle>Launaliðir</SectionTitle>
            {s.pay.monthly ? <KV k="Mánaðarlaun" v={kr(s.pay.dayPay)} /> : (
              <>
                <KV k={`${tr("Tímakaup")} · ${dec1(s.pay.hours)} ${tr("klst")}`} v={kr(s.pay.dayPay)} />
                {s.pay.alag.length || s.pay.premiums ? <KV k={`${tr("Álag")} · ${s.pay.alag.map((a) => `${String(Math.round(a.pct * 10) / 10).replace(".", ",")}%: ${dec1(a.h)}`).join(", ")}`} v={kr(s.pay.premiums)} /> : null}
                {s.pay.yfirvinnaH || s.pay.overtime ? <KV k={`${tr("Yfirvinnuálag")} · ${dec1(s.pay.yfirvinnaH)} ${tr("klst")}`} v={kr(s.pay.overtime)} /> : null}
              </>
            )}
            {s.pay.uppbot ? <KV k="Desember-/orlofsuppbót" v={kr(s.pay.uppbot)} /> : null}
            {s.pay.orlof ? <KV k="Orlof" v={kr(s.pay.orlof)} /> : null}
            {s.pay.benefits ? <KV k="Hlunnindi og styrkir" v={kr(s.pay.benefits)} /> : null}
            <KV k="Brúttólaun" v={kr(s.pay.gross)} last />
            <Muted size={11.5}>Sami útreikningur og launakeyrslan. Frádráttur og útborgun koma á launaseðli.</Muted>
          </Card>

          {sel.employeeComment ? (
            <Card style={{ backgroundColor: colors.warnSoft, gap: 4 }}>
              <Txt weight="bold" size={13}>Athugasemdin þín</Txt>
              <Muted>{`„${sel.employeeComment}“`}</Muted>
            </Card>
          ) : null}

          {sel.status === "sent" ? (
            <Card style={{ gap: 10 }}>
              {flag ? (
                <>
                  <TextInput style={[inputStyle(), { minHeight: 80, textAlignVertical: "top" }]} multiline value={note} onChangeText={setNote} placeholder={tr("T.d. vantar vakt 14.10. kl. 17–22")} placeholderTextColor={colors.ink3} />
                  <Btn title={tr("Senda athugasemd")} loading={busy} disabled={!note.trim()} onPress={() => respond(false)} />
                  <Btn title={tr("Hætta við")} variant="ghost" onPress={() => setFlag(false)} />
                </>
              ) : (
                <>
                  <Muted size={12.5}>Farðu yfir dagana og tímana. Ef allt passar, staðfestu. Annars skrifaðu athugasemd og stjórnandi fer yfir hana.</Muted>
                  <Btn title={tr("Staðfesta")} loading={busy} onPress={() => respond(true)} />
                  <Btn title={tr("Athugasemd")} variant="ghost" onPress={() => setFlag(true)} />
                </>
              )}
            </Card>
          ) : null}
          {sel.status === "final" && sel.documentId ? <Btn title={tr("Sækja PDF")} variant="soft" onPress={openPdf} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
