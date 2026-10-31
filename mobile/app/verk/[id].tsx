// VAKTO Verk (0102): eitt verk — tímataka með staðsetningu, tímar, efni, myndir og verkskýrsla til samþykktar.
import React, { useCallback, useState } from "react";
import { View, Pressable, TextInput, Alert, Share, Linking } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Camera, Images, Play, Square, Trash2, MapPin } from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Pill, Btn, Seg, Sheet, useToast } from "../../src/components/ui";
import { Field, inputStyle } from "../../src/components/request-sheets";
import { Elapsed, StopSheet } from "../../src/components/verk-list";
import { ImageViewer } from "../../src/components/image-viewer";
import { colors, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import {
  getJob, listJobs, start, addEntry, removeEntry, addItem, removeItem, addPhoto, removePhoto, createReport, setStatus,
  totals, kr, hrs, isNum, type Job, type Running,
} from "../../src/lib/api/verk";

const today = () => new Date().toISOString().slice(0, 10);
const dIS = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${Number(m[3])}.${Number(m[2])}.` : iso; };
const hm = (iso: string) => new Date(iso).toISOString().slice(11, 16);
type Tab = "time" | "items" | "photos" | "reports";

export default function VerkDetail() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useMe();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [running, setRunning] = useState<Running>(null);
  const [tab, setTab] = useState<Tab>("time");
  const [sheet, setSheet] = useState<"stop" | "entry" | "item" | "report" | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState({ date: today(), start: "08:00", end: "16:00", km: "", note: "" });
  const [item, setItem] = useState({ kind: "material" as "material" | "expense", description: "", quantity: "1", unitPrice: "" });
  const [period, setPeriod] = useState({ from: `${today().slice(0, 8)}01`, to: today() });

  const load = useCallback(async () => {
    if (!me || !id) return;
    const [j, l] = await Promise.all([getJob(id), listJobs(me)]);
    setJob(j); setRunning(l.running);
  }, [me, id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const done = async (r: { ok: boolean; error?: string }, msg?: string) => { if (!r.ok) toast(r.error ?? "Tókst ekki"); else { if (msg) toast(msg); setSheet(null); await load(); } };

  if (!job || !me) return <Screen title="Verk" back><Muted>Hleð…</Muted></Screen>;
  const t = totals(job.entries, job.items, job.hourlyRate);
  const mine = running?.jobId === job.id;

  async function photo(camera: boolean) {
    if (!me || !job) return;
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast("Leyfi vantar"); return; }
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    const r = await addPhoto(me, job.id, res.assets[0].uri);
    setBusy(false);
    await done(r, "Mynd vistuð");
  }

  async function report() {
    if (!me || !job) return;
    setBusy(true);
    const r = await createReport(me, job, period.from, period.to);
    setBusy(false);
    if (!r.ok || !r.url) { toast(r.error ?? "Tókst ekki"); return; }
    setSheet(null);
    await load();
    const msg = `Verkskýrsla fyrir ${job.title} til samþykktar:\n${r.url}`;
    if (job.client?.email) {
      Alert.alert("Skýrsla tilbúin", "Senda viðskiptavininum?", [
        { text: "Tölvupóstur", onPress: () => Linking.openURL(`mailto:${job.client!.email}?subject=${encodeURIComponent(`Verkskýrsla: ${job.title}`)}&body=${encodeURIComponent(msg)}`) },
        { text: "Deila hlekk", onPress: () => Share.share({ message: msg }) },
        { text: "Seinna", style: "cancel" },
      ]);
    } else await Share.share({ message: msg });
  }

  return (
    <Screen title={job.title} back>
      <Muted size={13.5}>{[job.client?.name, job.address].filter(Boolean).join(" · ") || "Enginn viðskiptavinur"}{job.hourlyRate ? ` · ${kr(job.hourlyRate)}/klst.` : ""}</Muted>

      {mine && running ? (
        <View style={{ backgroundColor: "#1c1b24", borderRadius: 20, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#2fd17c" }} />
            <Txt size={13} color="rgba(255,255,255,.7)">Tímataka í gangi</Txt>
          </View>
          <Elapsed since={running.startedAt} size={38} />
          <Btn title="Stöðva" variant="soft" icon={<Square color={colors.ink} fill={colors.ink} size={14} />} onPress={() => setSheet("stop")} />
        </View>
      ) : (
        <Btn title="Byrja tímatöku" size="lg" icon={<Play color="#fff" fill="#fff" size={16} />} loading={busy} onPress={async () => {
          setBusy(true); const r = await start(me, job.id); setBusy(false);
          await done(r, r.onSite === true ? "Byrjað — staðfest á verkstað" : r.onSite === false ? "Byrjað — þú ert utan verkstaðar" : "Tímataka hafin");
        }} />
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1, padding: 12 }}><Muted size={11.5}>Tímar</Muted><Txt weight="bold" size={17}>{hrs(t.hours)}</Txt></Card>
        <Card style={{ flex: 1, padding: 12 }}><Muted size={11.5}>Vinna</Muted><Txt weight="bold" size={17}>{kr(t.labor)}</Txt></Card>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1, padding: 12 }}><Muted size={11.5}>Efni og útlagt</Muted><Txt weight="bold" size={17}>{kr(t.materials + t.expenses)}</Txt></Card>
        <Card style={{ flex: 1, padding: 12 }}><Muted size={11.5}>Akstur</Muted><Txt weight="bold" size={17}>{isNum(t.km)} km</Txt></Card>
      </View>

      <Seg value={tab} onChange={setTab} items={[{ id: "time", label: "Tímar" }, { id: "items", label: "Efni" }, { id: "photos", label: "Myndir" }, { id: "reports", label: "Skýrslur" }]} />

      {tab === "time" ? (
        <Card style={{ paddingVertical: 6 }}>
          {job.entries.length === 0 ? <Muted style={{ paddingVertical: 12 }}>Engir tímar enn.</Muted> : null}
          {job.entries.map((e, i) => (
            <Pressable key={e.id} onLongPress={() => Alert.alert("Eyða tímaskráningu?", undefined, [{ text: "Hætta við", style: "cancel" }, { text: "Eyða", style: "destructive", onPress: async () => done(await removeEntry(e.id)) }])}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line2 }}>
              <View style={{ width: 54 }}><Txt weight="bold" size={14}>{dIS(e.startedAt)}</Txt></View>
              <View style={{ flex: 1 }}>
                <Txt size={14} style={{ fontVariant: ["tabular-nums"] }}>{hm(e.startedAt)}–{e.endedAt ? hm(e.endedAt) : "…"}{e.onSite ? "  " : ""}{e.onSite ? <Txt size={12} color={colors.good}>● á staðnum</Txt> : null}</Txt>
                {e.note || e.km ? <Muted size={12}>{[e.note, e.km ? `${isNum(e.km)} km` : null].filter(Boolean).join(" · ")}</Muted> : null}
              </View>
              <Txt weight="bold" size={14}>{isNum(e.hours)}</Txt>
            </Pressable>
          ))}
          <View style={{ paddingVertical: 8 }}><Btn title="+ Skrá tíma handvirkt" variant="ghost" size="sm" onPress={() => setSheet("entry")} /></View>
        </Card>
      ) : null}

      {tab === "items" ? (
        <Card style={{ paddingVertical: 6 }}>
          {job.items.length === 0 ? <Muted style={{ paddingVertical: 12 }}>Ekkert efni skráð.</Muted> : null}
          {job.items.map((it, i) => (
            <Pressable key={it.id} onLongPress={() => Alert.alert("Eyða?", it.description, [{ text: "Hætta við", style: "cancel" }, { text: "Eyða", style: "destructive", onPress: async () => done(await removeItem(it.id)) }])}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line2 }}>
              <View style={{ flex: 1 }}>
                <Txt size={14}>{it.description}{it.kind === "expense" ? <Txt size={12} color={colors.ink3}> · útlagt</Txt> : null}</Txt>
                <Muted size={12}>{dIS(it.date)} · {isNum(it.quantity, 2)} × {kr(it.unitPrice)}</Muted>
              </View>
              <Txt weight="bold" size={14}>{kr(it.quantity * it.unitPrice)}</Txt>
            </Pressable>
          ))}
          <View style={{ paddingVertical: 8 }}><Btn title="+ Efni eða kostnaður" variant="ghost" size="sm" onPress={() => setSheet("item")} /></View>
        </Card>
      ) : null}

      {tab === "photos" ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Btn title="Taka mynd" icon={<Camera color="#fff" size={17} />} loading={busy} onPress={() => photo(true)} /></View>
            <View style={{ flex: 1 }}><Btn title="Úr myndasafni" variant="ghost" icon={<Images color={colors.ink} size={17} />} onPress={() => photo(false)} /></View>
          </View>
          {job.photos.length === 0 ? <Muted>Engar myndir enn. Myndir fylgja verkskýrslunni.</Muted> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {job.photos.map((p) => (
              <Pressable key={p.id} onPress={() => setViewer(p.url)} onLongPress={() => Alert.alert("Eyða mynd?", undefined, [{ text: "Hætta við", style: "cancel" }, { text: "Eyða", style: "destructive", onPress: async () => done(await removePhoto(p.id)) }])}>
                <Image source={{ uri: p.url }} style={{ width: 108, height: 108, borderRadius: 12 }} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {tab === "reports" ? (
        <Card style={{ paddingVertical: 6 }}>
          <Muted size={13} style={{ paddingVertical: 10 }}>Viðskiptavinurinn fær hlekk þar sem hann sér tíma, efni, myndir og upphæðir — og samþykkir með einum smelli.</Muted>
          {job.reports.map((r) => (
            <Pressable key={r.id} onPress={() => Linking.openURL(`https://www.vakto.is/samthykki/${r.token}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line2 }}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={14}>{dIS(r.from)}–{dIS(r.to)}</Txt>
                <Muted size={12}>{r.signedName ? `${r.signedName}${r.comment ? `: „${r.comment}“` : ""}` : `Send ${dIS(r.createdAt)}`}</Muted>
              </View>
              <Pill tone={r.status === "approved" ? "good" : r.status === "rejected" ? "bad" : "warn"} label={r.status === "approved" ? "Samþykkt" : r.status === "rejected" ? "Athugasemd" : "Bíður"} />
            </Pressable>
          ))}
          <View style={{ paddingVertical: 8 }}><Btn title="Senda verkskýrslu" onPress={() => setSheet("report")} /></View>
        </Card>
      ) : null}

      <Btn title={job.status === "done" ? "Opna verk aftur" : "Ljúka verki"} variant="ghost" onPress={async () => done(await setStatus(job.id, job.status === "done" ? "open" : "done"), job.status === "done" ? "Verk opnað" : "Verki lokið")} />
      {job.lat != null ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}><MapPin color={colors.ink3} size={13} /><Muted size={12}>Tímataka staðfestir hvort þú sért á verkstaðnum</Muted></View> : null}

      <StopSheet open={sheet === "stop"} onClose={() => setSheet(null)} onDone={() => { setSheet(null); void load(); }} />
      <Sheet open={sheet === "entry"} onClose={() => setSheet(null)} title="Skrá tíma">
        <View style={{ gap: 12 }}>
          <Field label="Dagur (ÁÁÁÁ-MM-DD)"><TextInput style={inputStyle()} value={entry.date} onChangeText={(v) => setEntry({ ...entry, date: v })} placeholderTextColor={colors.ink3} /></Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Frá"><TextInput style={inputStyle()} value={entry.start} onChangeText={(v) => setEntry({ ...entry, start: v })} keyboardType="numbers-and-punctuation" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Til"><TextInput style={inputStyle()} value={entry.end} onChangeText={(v) => setEntry({ ...entry, end: v })} keyboardType="numbers-and-punctuation" /></Field></View>
            <View style={{ flex: 1 }}><Field label="km"><TextInput style={inputStyle()} value={entry.km} onChangeText={(v) => setEntry({ ...entry, km: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.ink3} /></Field></View>
          </View>
          <Field label="Hvað var gert?"><TextInput style={inputStyle()} value={entry.note} onChangeText={(v) => setEntry({ ...entry, note: v })} placeholderTextColor={colors.ink3} /></Field>
          <Btn title="Vista" onPress={async () => { await done(await addEntry(me, { jobId: job.id, ...entry }), "Tími skráður"); setEntry({ ...entry, note: "", km: "" }); }} />
        </View>
      </Sheet>
      <Sheet open={sheet === "item"} onClose={() => setSheet(null)} title="Efni eða kostnaður">
        <View style={{ gap: 12 }}>
          <Seg value={item.kind} onChange={(k) => setItem({ ...item, kind: k })} items={[{ id: "material", label: "Efni" }, { id: "expense", label: "Útlagt" }]} />
          <Field label="Lýsing"><TextInput style={inputStyle()} value={item.description} onChangeText={(v) => setItem({ ...item, description: v })} placeholder="t.d. Flísar 60×60" placeholderTextColor={colors.ink3} /></Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Magn"><TextInput style={inputStyle()} value={item.quantity} onChangeText={(v) => setItem({ ...item, quantity: v })} keyboardType="decimal-pad" /></Field></View>
            <View style={{ flex: 2 }}><Field label="Einingaverð (kr. án vsk.)"><TextInput style={inputStyle()} value={item.unitPrice} onChangeText={(v) => setItem({ ...item, unitPrice: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.ink3} /></Field></View>
          </View>
          <Btn title="Vista" onPress={async () => { await done(await addItem(me, { jobId: job.id, ...item }), "Skráð"); setItem({ ...item, description: "", quantity: "1", unitPrice: "" }); }} />
        </View>
      </Sheet>
      <Sheet open={sheet === "report"} onClose={() => setSheet(null)} title="Senda verkskýrslu">
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Frá"><TextInput style={inputStyle()} value={period.from} onChangeText={(v) => setPeriod({ ...period, from: v })} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Til"><TextInput style={inputStyle()} value={period.to} onChangeText={(v) => setPeriod({ ...period, to: v })} /></Field></View>
          </View>
          <Btn title="Búa til hlekk" loading={busy} onPress={report} />
        </View>
      </Sheet>
      <ImageViewer url={viewer} onClose={() => setViewer(null)} />
    </Screen>
  );
}
