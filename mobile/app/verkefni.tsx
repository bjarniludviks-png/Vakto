// Verkefnin mín (0111) — Mín / Sameiginleg (+ Liðið hjá stjórnendum). Hak, mynd, frávik, færa ábyrgð, Vel gert.
// Sama SQL-regla og vefurinn: tasks_day / tasks_board / tick_task.
import React, { useCallback, useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Check, Camera, MoreHorizontal, ArrowLeftRight, AlertTriangle, Plus, PartyPopper } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Btn, Seg, Sheet, Bar, Avatar, Empty, useToast } from "../src/components/ui";
import { Field, inputStyle } from "../src/components/request-sheets";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { tr, trf } from "../src/lib/i18n";
import { iso } from "../src/lib/api/me";
import { isManager } from "../src/lib/api/ops";
import { uploadImage } from "../src/lib/api/feed";
import {
  getMyDayOrLegacy, tick, getBoard, getTeamWeek, reportIncident, getPeople, handOver, getMyRoles, addTaskFull,
  type IncidentCategory, type Person, type MyRole,
} from "../src/lib/api/tasks";
import { counts, isLate, type BoardRow, type DayAdhoc, type DayItem, type DayList, type DayTasks } from "../src/lib/tasks";

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const hm = (s: string | null) => (s ? new Date(s).toTimeString().slice(0, 5) : "");
const first = (s: string | null | undefined) => (s ?? "").split(" ")[0];

function Box({ on, size = 26 }: { on: boolean; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 8, borderWidth: 1.5, borderColor: on ? colors.good : colors.line, backgroundColor: on ? colors.good : "transparent", alignItems: "center", justifyContent: "center" }}>
      {on ? <Check color="#fff" size={16} strokeWidth={3} /> : null}
    </View>
  );
}

function ItemRow({ title, done, sub, late, photo, onPress, onMore }: { title: string; done: boolean; sub?: string; late?: boolean; photo?: boolean; onPress: () => void; onMore?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, opacity: pressed ? 0.7 : 1 })}>
        <Box on={done} />
        <View style={{ flex: 1 }}>
          <Txt size={15} color={done ? colors.ink3 : colors.ink} style={done ? { textDecorationLine: "line-through" } : undefined}>{title}</Txt>
          {sub || late || (photo && !done) ? (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 2, alignItems: "center" }}>
              {photo && !done ? <Camera size={12} color={colors.ink3} /> : null}
              {late ? <Txt size={12} weight="semibold" color={colors.bad}>{tr("Of seint")}</Txt> : null}
              {sub ? <Txt size={12} color={colors.ink3}>{sub}</Txt> : null}
            </View>
          ) : null}
        </View>
      </Pressable>
      {onMore ? <Pressable onPress={onMore} hitSlop={10} accessibilityLabel={tr("Meira")}><MoreHorizontal size={20} color={colors.ink3} /></Pressable> : null}
    </View>
  );
}

export default function VerkefniScreen() {
  useTheme();
  const { me } = useMe();
  const toast = useToast();
  const params = useLocalSearchParams<{ fravik?: string }>();
  const today = iso(new Date());
  const [day, setDay] = useState<DayTasks | null>(null);
  const [tab, setTab] = useState<"min" | "sam" | "lid">("min");
  const [manager, setManager] = useState(false);
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | { k: "more"; title: string } | { k: "incident"; ref?: string } | { k: "handover"; fromId?: string; fromName?: string } | { k: "good" } | { k: "add" }>(null);
  const [team, setTeam] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const [d, m] = await Promise.all([getMyDayOrLegacy(me, today), isManager().catch(() => false)]);
    setDay(d); setManager(m);
    if (m) setBoard(await getBoard(today));
  }, [me, today]);
  useFocusEffect(useCallback(() => { load(); if (params.fravik) setSheet({ k: "incident" }); }, [load, params.fravik]));

  if (!me) return <Screen title="Verkefnin mín" back><Muted>{tr("Sæki…")}</Muted></Screen>;

  const mine = day ? { ...day, lists: day.lists.filter((l) => !l.shared), adhoc: day.adhoc.filter((a) => !a.shared) } : null;
  const shared = day ? { ...day, lists: day.lists.filter((l) => l.shared), adhoc: day.adhoc.filter((a) => a.shared) } : null;
  const view = tab === "min" ? mine : shared;
  const all = day ? counts(day) : { done: 0, total: 0 };
  const now = nowHM();

  async function afterTick(next: DayTasks) {
    const c = counts(next);
    if (c.total > 0 && c.done === c.total) { setTeam(await getTeamWeek()); setSheet({ k: "good" }); }
  }

  async function pickPhoto(): Promise<string | null | undefined> {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const r = perm.granted ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (r.canceled || !r.assets?.[0]) return undefined;
    const up = await uploadImage(me!, r.assets[0].uri, "jpg");
    if (!up.ok || !up.url) { toast(tr("Tókst ekki að hlaða myndinni upp")); return null; }
    return up.url;
  }

  async function toggleItem(l: DayList, i: DayItem) {
    if (!day) return;
    const next = !i.done;
    let photo: string | undefined;
    if (next && i.needs_photo) { const p = await pickPhoto(); if (!p) return; photo = p; }
    const upd: DayTasks = { ...day, lists: day.lists.map((x) => (x.id === l.id ? { ...x, items: x.items.map((y) => (y.id === i.id ? { ...y, done: next, done_at: new Date().toISOString(), done_by_name: me!.fullName } : y)) } : x)) };
    setDay(upd);
    if (!(await tick("item", i.id, today, next, { photo }))) { toast(tr("Tókst ekki að vista")); load(); return; }
    if (next) afterTick(upd);
  }
  async function toggleAdhoc(a: DayAdhoc) {
    if (!day) return;
    const next = !a.done;
    let photo: string | undefined;
    if (next && a.needs_photo) { const p = await pickPhoto(); if (!p) return; photo = p; }
    const upd: DayTasks = { ...day, adhoc: day.adhoc.map((x) => (x.id === a.id ? { ...x, done: next, done_at: new Date().toISOString(), done_by_name: me!.fullName } : x)) };
    setDay(upd);
    if (!(await tick("adhoc", a.id, today, next, { photo, legacy: a.legacy }))) { toast(tr("Tókst ekki að vista")); load(); return; }
    if (next) afterTick(upd);
  }

  return (
    <Screen title="Verkefnin mín" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Seg value={tab} onChange={setTab} items={[{ id: "min", label: tr("Mín") }, { id: "sam", label: tr("Sameiginleg") }, ...(manager ? [{ id: "lid" as const, label: tr("Liðið") }] : [])]} />

      {tab !== "lid" ? (
        <>
          {day && day.roles.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {day.roles.map((r) => (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: r.via === "faert" ? colors.brandSoft : r.via === "vara" ? colors.warnSoft : colors.panel }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color ?? colors.brand }} />
                  <Txt size={12.5} weight="semibold" color={colors.ink}>{r.name}</Txt>
                  {r.from_name ? <Txt size={12} color={colors.ink2}>{trf("fyrir {x}", first(r.from_name))}</Txt> : null}
                </View>
              ))}
            </View>
          ) : null}

          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Eyebrow>{tr("Í dag")}</Eyebrow><Muted>{trf("{a} af {b} klárað", all.done, all.total)}</Muted>
            </View>
            <Bar value={all.total ? all.done / all.total : 0} color={all.total && all.done === all.total ? colors.good : colors.brand} />
          </Card>

          {view && view.lists.length === 0 && view.adhoc.length === 0 ? (
            <Empty icon={<Check color={colors.brand} size={26} />} title={tab === "min" ? tr("Ekkert á þinni könnu") : tr("Engir sameiginlegir listar")} sub={tab === "min" ? tr("Verkefni frá yfirmanni og listar hlutverksins þíns birtast hér.") : tr("Listar sem allir á vaktinni deila birtast hér.")} />
          ) : null}

          {view?.lists.map((l) => {
            const d = l.items.filter((i) => i.done).length;
            return (
              <Card key={l.id}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Txt weight="bold" size={16} style={{ flex: 1 }}>{l.name}</Txt>
                  <Muted>{d}/{l.items.length}</Muted>
                </View>
                <Muted size={12.5}>{[l.due_time ? trf("Fyrir kl. {x}", l.due_time) : null, l.from_name ? trf("Fyrir {x}", first(l.from_name)) : null, l.role_name].filter(Boolean).join(" · ")}</Muted>
                <View style={{ marginTop: 6 }}>
                  {l.items.map((i) => (
                    <ItemRow key={i.id} title={i.title} done={i.done} photo={i.needs_photo}
                      late={isLate(l.due_time, i.done, now, true)}
                      sub={i.done && l.shared ? `${first(i.done_by_name)} ${hm(i.done_at)}` : undefined}
                      onPress={() => toggleItem(l, i)} onMore={() => setSheet({ k: "more", title: i.title })} />
                  ))}
                </View>
              </Card>
            );
          })}

          {view && view.adhoc.length > 0 ? (
            <Card>
              <Txt weight="bold" size={16} style={{ marginBottom: 4 }}>{tr("Stök verkefni")}</Txt>
              {view.adhoc.map((a) => (
                <ItemRow key={a.id} title={a.title} done={a.done} photo={a.needs_photo}
                  late={isLate(a.due_time, a.done, now, true)}
                  sub={[a.due_time ? trf("fyrir kl. {x}", a.due_time) : null, a.from_name ? trf("fyrir {x}", first(a.from_name)) : null, a.done && a.shared ? `${first(a.done_by_name)} ${hm(a.done_at)}` : null, a.note].filter(Boolean).join(" · ") || undefined}
                  onPress={() => toggleAdhoc(a)} onMore={a.legacy ? undefined : () => setSheet({ k: "more", title: a.title })} />
              ))}
            </Card>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn style={{ flex: 1 }} variant="ghost" title={tr("Tilkynna frávik")} icon={<AlertTriangle size={17} color={colors.ink} />} onPress={() => setSheet({ k: "incident" })} />
            <Btn style={{ flex: 1 }} variant="ghost" title={tr("Færa ábyrgð")} icon={<ArrowLeftRight size={17} color={colors.ink} />} onPress={() => setSheet({ k: "handover" })} />
          </View>
        </>
      ) : (
        <>
          <Btn title={tr("Nýtt verkefni")} icon={<Plus size={18} color="#fff" />} onPress={() => setSheet({ k: "add" })} />
          {(board ?? []).length === 0 ? <Empty title={tr("Engin verkefni í dag")} sub={tr("Búðu til hlutverk og lista í tölvunni (Verkefni).")} /> : null}
          {(board ?? []).map((r) => {
            const c = counts(r);
            return (
              <Card key={r.employee_id} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar name={r.name} size={40} color={r.color} photo={r.photo_url} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" size={15}>{r.name}</Txt>
                    <Muted size={12.5}>{[r.on_shift ? tr("Á vakt") : tr("Ekki á vakt"), ...r.roles.map((x) => x.name + (x.from_name ? ` (${trf("fyrir {x}", first(x.from_name))})` : ""))].join(" · ")}</Muted>
                  </View>
                  <Txt weight="bold" size={14} color={c.total && c.done === c.total ? colors.good : colors.ink2}>{c.done}/{c.total}</Txt>
                </View>
                <Bar value={c.total ? c.done / c.total : 0} color={c.total && c.done === c.total ? colors.good : colors.brand} />
                <Pressable onPress={() => setSheet({ k: "handover", fromId: r.employee_id, fromName: r.name })} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ArrowLeftRight size={14} color={colors.brandDeep} /><Txt size={13} weight="semibold" color={colors.brandDeep}>{trf("Færa ábyrgð {x}", first(r.name))}</Txt>
                </Pressable>
              </Card>
            );
          })}
        </>
      )}

      <Sheet open={sheet?.k === "more"} onClose={() => setSheet(null)} title={sheet?.k === "more" ? sheet.title : ""}>
        <Btn variant="ghost" title={tr("Tilkynna frávik")} icon={<AlertTriangle size={17} color={colors.ink} />} onPress={() => setSheet({ k: "incident", ref: sheet?.k === "more" ? sheet.title : undefined })} />
      </Sheet>

      <IncidentSheet open={sheet?.k === "incident"} taskRef={sheet?.k === "incident" ? sheet.ref : undefined} onClose={() => setSheet(null)}
        onSend={async (cat, title, note) => { const ok = await reportIncident(me, { category: cat, title, note, taskRef: sheet?.k === "incident" ? sheet.ref : undefined }); toast(ok ? tr("Frávikið er skráð — yfirmaður fær tilkynningu") : tr("Tókst ekki að skrá frávikið")); if (ok) setSheet(null); }} />

      <HandoverSheet open={sheet?.k === "handover"} me={me} fromId={sheet?.k === "handover" ? sheet.fromId ?? me.empId : me.empId} fromName={sheet?.k === "handover" ? sheet.fromName : undefined}
        onClose={() => setSheet(null)} onDone={(msg) => { toast(msg); setSheet(null); load(); }} />

      <AddTaskSheet open={sheet?.k === "add"} me={me} onClose={() => setSheet(null)} onDone={() => { toast(tr("Verkefninu bætt við")); setSheet(null); load(); }} />

      <Sheet open={sheet?.k === "good"} onClose={() => setSheet(null)}>
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 10 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.goodSoft, alignItems: "center", justifyContent: "center" }}><PartyPopper size={34} color={colors.good} /></View>
          <Txt weight="bold" size={24}>{tr("Vel gert!")}</Txt>
          <Muted style={{ textAlign: "center" }}>{tr("Þú kláraðir allt sem var á þinni könnu í dag.")}</Muted>
          {team && team.total > 0 ? (
            <Card style={{ alignSelf: "stretch", gap: 8, marginTop: 6 }}>
              <Eyebrow>{tr("Liðið í vikunni")}</Eyebrow>
              <Txt weight="bold" size={28}>{Math.round((team.done / team.total) * 100)}%</Txt>
              <Bar value={team.done / team.total} color={colors.good} />
              <Muted size={12.5}>{trf("{a} af {b} verkefnum klárað", team.done, team.total)}</Muted>
            </Card>
          ) : null}
          <Btn style={{ alignSelf: "stretch", marginTop: 6 }} title={tr("Takk")} onPress={() => setSheet(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const CATS: [IncidentCategory, string][] = [["hitastig", "Hitastig"], ["vara", "Vara vantar"], ["bilun", "Bilun"], ["atvik", "Atvik"], ["verkefni", "Náði ekki að klára"], ["annad", "Annað"]];

function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map(([k, l]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: value === k ? colors.brand : colors.line, backgroundColor: value === k ? colors.brandSoft : colors.panel }}>
          <Txt size={13.5} weight="semibold" color={value === k ? colors.brandDeep : colors.ink2}>{tr(l)}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

function IncidentSheet({ open, taskRef, onClose, onSend }: { open: boolean; taskRef?: string; onClose: () => void; onSend: (c: IncidentCategory, title: string, note: string) => Promise<void> }) {
  const [cat, setCat] = useState<IncidentCategory>(taskRef ? "verkefni" : "atvik");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const label = CATS.find(([k]) => k === cat)?.[1] ?? "";
  return (
    <Sheet open={open} onClose={onClose} title={tr("Tilkynna frávik")}>
      {taskRef ? <Muted>{trf("Verkefni: {x}", taskRef)}</Muted> : null}
      <Chips value={cat} onChange={setCat} items={CATS} />
      <Field label="Hvað gerðist?"><TextInput style={inputStyle()} value={title} onChangeText={setTitle} placeholder={tr("t.d. Kælir 2 sýndi 9°C")} placeholderTextColor={colors.ink3} maxLength={200} /></Field>
      <Field label="Nánar (valfrjálst)"><TextInput style={[inputStyle(), { minHeight: 70, textAlignVertical: "top" }]} multiline value={note} onChangeText={setNote} placeholderTextColor={colors.ink3} /></Field>
      <Btn title="Senda til yfirmanns" size="lg" loading={busy} onPress={async () => { setBusy(true); await onSend(cat, title.trim() || tr(label), note); setBusy(false); setTitle(""); setNote(""); }} />
    </Sheet>
  );
}

function HandoverSheet({ open, me, fromId, fromName, onClose, onDone }: { open: boolean; me: NonNullable<ReturnType<typeof useMe>["me"]>; fromId: string; fromName?: string; onClose: () => void; onDone: (msg: string) => void }) {
  const toast = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<MyRole[]>([]);
  const [what, setWhat] = useState<string>("all");
  const [to, setTo] = useState<string | null>(null);
  const [len, setLen] = useState<"today" | "week" | "open">("today");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (!open) return;
    setTo(null); setWhat("all"); setLen("today"); setNote("");
    getPeople(me).then(setPeople);
    if (fromId === me.empId) getMyRoles(me).then((r) => setRoles(r.filter((x) => !x.backup))); else setRoles([]);
  }, [open, me, fromId]);
  const today = iso(new Date());
  const end = len === "today" ? today : len === "week" ? (() => { const d = new Date(); d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7))); return iso(d); })() : null;
  async function send() {
    if (!to) return;
    setBusy(true);
    const err = await handOver(me, { fromId, toId: to, roleIds: what === "all" ? null : [what], start: today, end, note });
    setBusy(false);
    if (err) { toast(tr("Tókst ekki að færa ábyrgðina")); return; }
    onDone(trf("Ábyrgðin er komin til {x}", first(people.find((p) => p.id === to)?.name)));
  }
  return (
    <Sheet open={open} onClose={onClose} title={fromName ? trf("Færa ábyrgð {x}", first(fromName)) : tr("Færa ábyrgðina mína")}>
      <Muted>{tr("Án veikindaskráningar og óháð vöktum. Ábyrgðin fer sjálfkrafa til baka.")}</Muted>
      <Field label="Hvað?"><Chips value={what} onChange={setWhat} items={[["all", "Allt"], ...roles.map((r) => [r.id, r.name] as [string, string])]} /></Field>
      <Field label="Hversu lengi?"><Chips value={len} onChange={setLen} items={[["today", "Í dag"], ["week", "Út vikuna"], ["open", "Þar til ég skila"]]} /></Field>
      <Field label="Til hvers?">
        <View style={{ gap: 2 }}>
          {people.filter((p) => p.id !== fromId).map((p) => (
            <Pressable key={p.id} onPress={() => setTo(p.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, backgroundColor: to === p.id ? colors.brandSoft : "transparent" }}>
              <Avatar name={p.name} size={34} color={p.color} photo={p.photo} />
              <Txt size={15} weight={to === p.id ? "bold" : "regular"} style={{ flex: 1 }}>{p.name}</Txt>
              {to === p.id ? <Check size={18} color={colors.brandDeep} /> : null}
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="Skilaboð (valfrjálst)"><TextInput style={inputStyle()} value={note} onChangeText={setNote} placeholder={tr("t.d. Lyklarnir eru í skúffunni")} placeholderTextColor={colors.ink3} maxLength={500} /></Field>
      <Btn title="Færa ábyrgð" size="lg" loading={busy} disabled={!to} onPress={send} />
    </Sheet>
  );
}

function AddTaskSheet({ open, me, onClose, onDone }: { open: boolean; me: NonNullable<ReturnType<typeof useMe>["me"]>; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [who, setWho] = useState<string>("any");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (open) { getPeople(me).then(setPeople); setTitle(""); setDue(""); setWho("any"); } }, [open, me]);
  async function save() {
    setBusy(true);
    const ok = await addTaskFull(me, { employeeId: who === "any" ? null : who, title, date: iso(new Date()), dueTime: due || null });
    setBusy(false);
    if (!ok) { toast(tr("Tókst ekki að bæta verkefninu við")); return; }
    onDone();
  }
  return (
    <Sheet open={open} onClose={onClose} title={tr("Nýtt verkefni")}>
      <Field label="Hvað þarf að gera?"><TextInput style={inputStyle()} value={title} onChangeText={setTitle} placeholder={tr("t.d. Fara með samlokur í Hagkaup")} placeholderTextColor={colors.ink3} maxLength={200} /></Field>
      <Field label="Fyrir kl. (valfrjálst)"><TextInput style={inputStyle()} value={due} onChangeText={setDue} placeholder="10:30" placeholderTextColor={colors.ink3} keyboardType="numbers-and-punctuation" maxLength={5} /></Field>
      <Field label="Hver?">
        <Chips value={who} onChange={setWho} items={[["any", "Hver sem er á vakt"], ...people.map((p) => [p.id, first(p.name)] as [string, string])]} />
      </Field>
      <Btn title="Bæta við" size="lg" loading={busy} disabled={!title.trim()} onPress={save} />
    </Sheet>
  );
}
