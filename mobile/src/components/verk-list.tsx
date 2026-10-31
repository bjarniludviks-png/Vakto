// VAKTO Verk (0102): listi yfir verk, tímataka í gangi og nýtt verk. Notað sem flipi verktaka og á /verk.
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Briefcase, Plus, Square } from "lucide-react-native";
import { Screen, IconBtn } from "./screen";
import { Card, Txt, Muted, Pill, Btn, Seg, Empty, Sheet, useToast } from "./ui";
import { Field, inputStyle } from "./request-sheets";
import { colors, useTheme } from "../theme";
import { useMe } from "../lib/me-context";
import { listJobs, saveClient, saveJob, stop, here, hrs, type Client, type JobRow, type Running } from "../lib/api/verk";

export function Elapsed({ since, size = 22, color = "#fff" }: { since: string; size?: number; color?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return <Txt weight="bold" size={size} color={color} style={{ fontVariant: ["tabular-nums"] }}>{`${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`}</Txt>;
}

/** Stöðva tímatöku: km og stutt lýsing (valfrjálst). */
export function StopSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [km, setKm] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Stöðva tímatöku">
      <View style={{ gap: 12 }}>
        <Field label="Hvað var gert? (valfrjálst)"><TextInput style={[inputStyle(), { minHeight: 70, textAlignVertical: "top" }]} multiline value={note} onChangeText={setNote} placeholder="t.d. Flísalögn á vegg" placeholderTextColor={colors.ink3} /></Field>
        <Field label="Akstur (km)"><TextInput style={inputStyle()} value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.ink3} /></Field>
        <Btn title="Stöðva og vista" loading={busy} onPress={async () => { setBusy(true); const r = await stop({ km, note }); setBusy(false); if (!r.ok) { toast(r.error ?? "Tókst ekki"); return; } setKm(""); setNote(""); toast("Tími vistaður"); onDone(); }} />
      </View>
    </Sheet>
  );
}

function NewJobSheet({ open, onClose, clients, onSaved }: { open: boolean; onClose: () => void; clients: Client[]; onSaved: (id: string) => void }) {
  const { me } = useMe();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string | "new" | "">("");
  const [client, setClient] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState("");
  const [rate, setRate] = useState("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!me) return;
    setBusy(true);
    let cid = clientId === "new" ? "" : clientId;
    if (clientId === "new") {
      const c = await saveClient(me, client);
      if (!c.ok) { setBusy(false); toast(c.error ?? "Tókst ekki"); return; }
      cid = c.id ?? "";
    }
    const r = await saveJob(me, { title, clientId: cid || null, address, rate, pos });
    setBusy(false);
    if (!r.ok || !r.id) { toast(r.error ?? "Tókst ekki"); return; }
    setTitle(""); setClientId(""); setClient({ name: "", email: "", phone: "" }); setAddress(""); setRate(""); setPos(null);
    onSaved(r.id);
  }

  const chip = (id: string, label: string) => (
    <Pressable key={id} onPress={() => setClientId(id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: clientId === id ? colors.brand : colors.panel2 }}>
      <Txt size={13.5} weight="semibold" color={clientId === id ? "#fff" : colors.ink}>{label}</Txt>
    </Pressable>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Nýtt verk">
      <View style={{ gap: 12 }}>
        <Field label="Heiti verks"><TextInput style={inputStyle()} value={title} onChangeText={setTitle} placeholder="t.d. Baðherbergi, Laugavegi 5" placeholderTextColor={colors.ink3} /></Field>
        <Field label="Viðskiptavinur">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {chip("", "Enginn")}
            {clients.map((c) => chip(c.id, c.name))}
            {chip("new", "+ Nýr")}
          </View>
        </Field>
        {clientId === "new" ? (
          <View style={{ gap: 8 }}>
            <TextInput style={inputStyle()} value={client.name} onChangeText={(v) => setClient({ ...client, name: v })} placeholder="Nafn viðskiptavinar" placeholderTextColor={colors.ink3} />
            <TextInput style={inputStyle()} value={client.email} onChangeText={(v) => setClient({ ...client, email: v })} placeholder="Netfang (fyrir verkskýrslur)" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.ink3} />
            <TextInput style={inputStyle()} value={client.phone} onChangeText={(v) => setClient({ ...client, phone: v })} placeholder="Sími" keyboardType="phone-pad" placeholderTextColor={colors.ink3} />
          </View>
        ) : null}
        <Field label="Heimilisfang verkstaðar"><TextInput style={inputStyle()} value={address} onChangeText={setAddress} placeholder="Gata og númer, bær" placeholderTextColor={colors.ink3} /></Field>
        <Pressable onPress={async () => { const p = await here(); if (p) { setPos(p); toast("Staðsetning verkstaðar vistuð"); } else toast("Fékk ekki staðsetningu"); }}>
          <Txt size={13.5} weight="semibold" color={colors.brandDeep}>{pos ? "✓ Ég er á verkstaðnum — staðsetning vistuð" : "Ég er á verkstaðnum — nota staðsetningu"}</Txt>
        </Pressable>
        <Field label="Tímagjald (kr. án vsk.)"><TextInput style={inputStyle()} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="t.d. 9500" placeholderTextColor={colors.ink3} /></Field>
        <Btn title="Stofna verk" loading={busy} disabled={!title.trim()} onPress={save} />
      </View>
    </Sheet>
  );
}

export function VerkList({ inTab = false }: { inTab?: boolean }) {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const [data, setData] = useState<{ jobs: JobRow[]; clients: Client[]; running: Running } | null>(null);
  const [filter, setFilter] = useState<"open" | "done">("open");
  const [sheet, setSheet] = useState<"new" | "stop" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { if (me) setData(await listJobs(me)); }, [me]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const running = data?.running ?? null;
  const runJob = running ? data?.jobs.find((j) => j.id === running.jobId) : null;
  const jobs = (data?.jobs ?? []).filter((j) => j.status === filter);
  const monthH = (data?.jobs ?? []).reduce((a, j) => a + j.hoursMonth, 0);

  return (
    <Screen title="Verk" back={!inTab} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
      right={<IconBtn onPress={() => setSheet("new")} label="Nýtt verk"><Plus color={colors.brand} size={22} /></IconBtn>}>
      {running && runJob ? (
        <Pressable onPress={() => router.push(`/verk/${runJob.id}`)}>
          <View style={{ backgroundColor: "#1c1b24", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#2fd17c" }} />
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={15} color="#fff" numberOfLines={1}>{runJob.title}</Txt>
              <Txt size={12.5} color="rgba(255,255,255,.65)" numberOfLines={1}>{runJob.client ?? runJob.address ?? "Í gangi"}</Txt>
            </View>
            <Elapsed since={running.startedAt} />
            <Pressable onPress={() => setSheet("stop")} accessibilityLabel="Stöðva" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
              <Square color="#1c1b24" fill="#1c1b24" size={14} />
            </Pressable>
          </View>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1, padding: 13 }}><Muted size={12}>Tímar í mánuðinum</Muted><Txt weight="bold" size={20}>{hrs(monthH)}</Txt></Card>
        <Card style={{ flex: 1, padding: 13 }}><Muted size={12}>Opin verk</Muted><Txt weight="bold" size={20}>{(data?.jobs ?? []).filter((j) => j.status === "open").length}</Txt></Card>
      </View>
      <Seg value={filter} onChange={setFilter} items={[{ id: "open", label: "Opin" }, { id: "done", label: "Lokið" }]} />
      {data && jobs.length === 0 ? (
        <Empty icon={<Briefcase color={colors.ink3} size={26} />} title={filter === "open" ? "Engin opin verk" : "Engin lokin verk"} sub="Stofnaðu verk, byrjaðu tímatöku á staðnum og sendu viðskiptavininum verkskýrslu til samþykktar." />
      ) : null}
      {jobs.map((j) => (
        <Pressable key={j.id} onPress={() => router.push(`/verk/${j.id}`)}>
          <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderColor: running?.jobId === j.id ? "#2fd17c" : colors.line }}>
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={15.5} numberOfLines={1}>{j.title}</Txt>
              <Muted size={12.5}>{[j.client, j.address].filter(Boolean).join(" · ") || "—"}</Muted>
            </View>
            {running?.jobId === j.id ? <Pill tone="good" label="Í gangi" /> : <View style={{ alignItems: "flex-end" }}><Txt weight="bold" size={14}>{hrs(j.hoursMonth)}</Txt><Muted size={11}>í mánuðinum</Muted></View>}
          </Card>
        </Pressable>
      ))}
      {data && !jobs.length && filter === "open" ? <Btn title="+ Nýtt verk" onPress={() => setSheet("new")} /> : null}
      <NewJobSheet open={sheet === "new"} onClose={() => setSheet(null)} clients={data?.clients ?? []} onSaved={(id) => { setSheet(null); void load(); router.push(`/verk/${id}`); }} />
      <StopSheet open={sheet === "stop"} onClose={() => setSheet(null)} onDone={() => { setSheet(null); void load(); }} />
    </Screen>
  );
}
