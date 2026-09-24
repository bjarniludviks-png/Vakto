// Beiðna-sheet: frí, bjóða vakt, leiðrétta tíma, forföll. Notað úr Heim og Vaktir.
import React, { useEffect, useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Sheet, Btn, Txt, Muted, useToast, Seg } from "./ui";
import { colors, radius, font } from "../theme";
import { useMe } from "../lib/me-context";
import { submitLeaveRequest, requestShiftSwap } from "../lib/api/requests";
import { supabase } from "../lib/supabase";
import { iso } from "../lib/api/me";

/** Reiknað við hverja teikningu svo liturinn fylgi þemanu. */
export const inputStyle = () => ({
  borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12,
  fontSize: 15, fontFamily: font.regular, color: colors.ink, backgroundColor: colors.panel2,
} as const);

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt weight="bold" size={12.5} color={colors.ink2}>{label}</Txt>
      {children}
    </View>
  );
}

const DAY_L = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
function fmtDate(d: string) { const x = new Date(d + "T12:00:00"); return `${DAY_L[(x.getDay() + 6) % 7]} ${x.getDate()}.${x.getMonth() + 1}`; }

/** Einfalt dagsetningarval: +/- dagar frá í dag (engin native date picker í Expo Go). */
function DatePick({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  const shift = (n: number) => { const d = new Date(value + "T12:00:00"); d.setDate(d.getDate() + n); const v = iso(d); if (min && v < min) return; onChange(v); };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable onPress={() => shift(-1)} style={{ width: 40, height: 44, borderRadius: 12, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}><Txt weight="bold" size={18}>–</Txt></Pressable>
      <View style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}>
        <Txt weight="bold" size={15}>{fmtDate(value)}</Txt>
      </View>
      <Pressable onPress={() => shift(1)} style={{ width: 40, height: 44, borderRadius: 12, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}><Txt weight="bold" size={18}>+</Txt></Pressable>
    </View>
  );
}

export function LeaveSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const { me } = useMe();
  const toast = useToast();
  const today = iso(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [type, setType] = useState<"orlof" | "veikindi" | "olaunad">("orlof");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (to < from) setTo(from); }, [from, to]);
  async function send() {
    if (!me) return;
    setBusy(true);
    const r = await submitLeaveRequest(me, { fromDate: from, toDate: to, type });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Tókst ekki"); return; }
    toast("Beiðni send — þú færð svar í appinu");
    onClose(); onDone?.();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Biðja um frí">
      <Seg value={type} onChange={setType} items={[{ id: "orlof", label: "Orlof" }, { id: "veikindi", label: "Veikindi" }, { id: "olaunad", label: "Ólaunað" }]} />
      <Field label="Frá"><DatePick value={from} onChange={setFrom} min={today} /></Field>
      <Field label="Til"><DatePick value={to} onChange={setTo} min={from} /></Field>
      <Btn title="Senda beiðni" size="lg" loading={busy} onPress={send} />
      <Muted size={12}>Vaktstjóri fær tilkynningu strax og þú sérð svarið undir Beiðnir.</Muted>
    </Sheet>
  );
}

export function OfferSheet({ open, onClose, onDone, shiftLabel }: { open: boolean; onClose: () => void; onDone?: () => void; shiftLabel?: string }) {
  const { me } = useMe();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setNote(shiftLabel ? `Býð vaktina ${shiftLabel} til skipta` : ""); }, [open, shiftLabel]);
  async function send() {
    if (!me || !note.trim()) return;
    setBusy(true);
    const r = await requestShiftSwap(me, note.trim());
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Tókst ekki"); return; }
    toast("Sent — vaktstjóri og samstarfsfólk sjá boðið");
    onClose(); onDone?.();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Bjóða vakt til skipta">
      <Muted>Segðu hvaða vakt þú vilt losna við og hvort þú vilt skipta við einhvern ákveðinn. Vaktstjóri samþykkir skiptin.</Muted>
      <Field label="Skilaboð">
        <TextInput style={[inputStyle(), { minHeight: 90, textAlignVertical: "top" }]} multiline value={note} onChangeText={setNote} placeholder="t.d. Býð laugardagsvaktina 11:30–23:00 — Wiktoria getur tekið hana" placeholderTextColor={colors.ink3} />
      </Field>
      <Btn title="Senda" size="lg" loading={busy} disabled={!note.trim()} onPress={send} />
    </Sheet>
  );
}

export function CorrectionSheet({ open, onClose, onDone, date: initDate }: { open: boolean; onClose: () => void; onDone?: () => void; date?: string }) {
  const { me } = useMe();
  const toast = useToast();
  const [date, setDate] = useState(initDate ?? iso(new Date()));
  const [inT, setIn] = useState("");
  const [outT, setOut] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && initDate) setDate(initDate); }, [open, initDate]);
  async function send() {
    if (!me) return;
    setBusy(true);
    const { error } = await supabase.from("punch_corrections").insert({ company_id: me.companyId, employee_id: me.empId, date, requested_in: inT || null, requested_out: outT || null, reason: reason.trim() || null, status: "pending" });
    setBusy(false);
    if (error) { toast(error.message); return; }
    toast("Leiðréttingarbeiðni send");
    onClose(); onDone?.();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Leiðrétta tíma">
      <Field label="Dagur"><DatePick value={date} onChange={setDate} /></Field>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Rétt inn"><TextInput style={inputStyle()} value={inT} onChangeText={setIn} placeholder="11:30" placeholderTextColor={colors.ink3} keyboardType="numbers-and-punctuation" /></Field></View>
        <View style={{ flex: 1 }}><Field label="Rétt út"><TextInput style={inputStyle()} value={outT} onChangeText={setOut} placeholder="23:05" placeholderTextColor={colors.ink3} keyboardType="numbers-and-punctuation" /></Field></View>
      </View>
      <Field label="Skýring"><TextInput style={[inputStyle(), { minHeight: 70, textAlignVertical: "top" }]} multiline value={reason} onChangeText={setReason} placeholder="Gleymdi að stimpla út…" placeholderTextColor={colors.ink3} /></Field>
      <Btn title="Senda beiðni" size="lg" loading={busy} onPress={send} />
    </Sheet>
  );
}

export function CantSheet({ open, onClose, onDone, shiftLabel }: { open: boolean; onClose: () => void; onDone?: () => void; shiftLabel: string }) {
  const { me } = useMe();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!me) return;
    setBusy(true);
    const r = await requestShiftSwap(me, `Forföll: get ekki mætt ${shiftLabel}${reason.trim() ? ` — ${reason.trim()}` : ""}`);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Tókst ekki"); return; }
    toast("Tilkynnt — vaktstjóri fær skilaboð núna");
    onClose(); onDone?.();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Get ekki mætt">
      <Muted>Vaktstjóri fær tilkynningu strax og getur sett vaktina í „Lausar vaktir“.</Muted>
      <Field label="Ástæða"><TextInput style={[inputStyle(), { minHeight: 70, textAlignVertical: "top" }]} multiline value={reason} onChangeText={setReason} placeholder="Veik(ur)…" placeholderTextColor={colors.ink3} /></Field>
      <Btn title="Tilkynna forföll" size="lg" variant="danger" loading={busy} onPress={send} />
    </Sheet>
  );
}
