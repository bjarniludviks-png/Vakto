// Vakt — fullur skjár fyrir eina vakt: litaður haus, upplýsingar, samstarfsfólk,
// áætluð laun (eigin vakt), bjóða vakt / forföll / sækja um / skilaboð.
import React, { useCallback, useState } from "react";
import { tr, trf } from "../../src/lib/i18n";
import { View, Pressable, Share } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MoreHorizontal, ArrowLeftRight, MessageCircle, Share2 } from "lucide-react-native";
import { Screen, IconBtn } from "../../src/components/screen";
import { Card, Txt, Muted, Pill, Btn, Avatar, AvatarStack, Sheet, Eyebrow, KV, Row, useToast } from "../../src/components/ui";
import { colors, deptColor, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { supabase } from "../../src/lib/supabase";
import { estimateShift } from "../../src/lib/api/pay";
import { applyForShift, listMyRequests } from "../../src/lib/api/requests";
import { startDM, peopleMap } from "../../src/lib/api/chat";
import { dec1, kr } from "../../src/lib/format";
import { OfferSheet, CantSheet } from "../../src/components/request-sheets";

const DAY_L = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];
const DAY_FULL = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];
const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
const hoursOf = (s: string | null, e: string | null) => { if (!s || !e) return 0; let h = parseInt(e.slice(0, 2)) + parseInt(e.slice(3, 5)) / 60 - parseInt(s.slice(0, 2)) - parseInt(s.slice(3, 5)) / 60; if (h < 0) h += 24; return Math.round(h * 10) / 10; };

type Shift = { id: string; date: string; start: string | null; end: string | null; empId: string | null; empName: string | null; empColor: string | null; empPhoto: string | null; dept: string | null; deptColor: string | null; typeName: string | null; typeColor: string | null; location: string | null; company: string };
type Co = { id: string; empId: string; name: string; color: string | null; photo: string | null; start: string; end: string };

export default function VaktScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<Shift | null>(null);
  const [co, setCo] = useState<Co[]>([]);
  const [applied, setApplied] = useState(false);
  const [sheet, setSheet] = useState<null | "more" | "offer" | "cant">(null);

  const load = useCallback(async () => {
    if (!id || !me) return;
    const { data } = await supabase.from("shifts").select("id, date, start_time, end_time, employee_id, employees(full_name, avatar_color, photo_url, departments(name, color)), shift_types(name, color), locations(name), companies(name)").eq("id", id).maybeSingle();
    if (!data) return;
    const emp = (Array.isArray(data.employees) ? data.employees[0] : data.employees) as { full_name?: string; avatar_color?: string; photo_url?: string; departments?: { name?: string; color?: string } | { name?: string; color?: string }[] } | null;
    const dep = emp?.departments ? (Array.isArray(emp.departments) ? emp.departments[0] : emp.departments) : null;
    const st = (Array.isArray(data.shift_types) ? data.shift_types[0] : data.shift_types) as { name?: string; color?: string } | null;
    const loc = (Array.isArray(data.locations) ? data.locations[0] : data.locations) as { name?: string } | null;
    const comp = (Array.isArray(data.companies) ? data.companies[0] : data.companies) as { name?: string } | null;
    const sh: Shift = { id: data.id, date: data.date, start: hm(data.start_time), end: hm(data.end_time), empId: data.employee_id, empName: emp?.full_name ?? null, empColor: emp?.avatar_color ?? null, empPhoto: emp?.photo_url ?? null, dept: dep?.name ?? null, deptColor: dep?.color ?? null, typeName: st?.name ?? null, typeColor: st?.color ?? null, location: loc?.name ?? null, company: comp?.name ?? "" };
    setS(sh);
    const { data: same } = await supabase.from("shifts").select("id, employee_id, start_time, end_time, employees(full_name, avatar_color, photo_url)").eq("company_id", me.companyId).eq("date", sh.date).not("employee_id", "is", null).neq("id", sh.id).order("start_time");
    const s1 = sh.start ?? "00:00", e1r = sh.end ?? "24:00", e1 = e1r <= s1 ? "24:00" : e1r;
    setCo(((same ?? []) as Record<string, unknown>[]).filter((x) => { const s2 = hm(x.start_time as string) ?? "00:00", e2r = hm(x.end_time as string) ?? "24:00", e2 = e2r <= s2 ? "24:00" : e2r; return s2 < e1 && s1 < e2; }).map((x) => { const e = (Array.isArray(x.employees) ? x.employees[0] : x.employees) as { full_name?: string; avatar_color?: string; photo_url?: string } | null; return { id: x.id as string, empId: x.employee_id as string, name: e?.full_name ?? "—", color: e?.avatar_color ?? null, photo: e?.photo_url ?? null, start: hm(x.start_time as string) ?? "", end: hm(x.end_time as string) ?? "" }; }));
    if (!sh.empId) {
      const reqs = await listMyRequests(me);
      const d = new Date(sh.date + "T12:00:00");
      setApplied(reqs.some((r) => r.kind === "swap" && r.status === "pending" && r.label.startsWith("Umsókn um opna vakt") && r.label.includes(`${sh.start}–${sh.end}`) && r.label.includes(`${d.getDate()}.`)));
    }
  }, [id, me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!s) return <Screen title="Vakt" back><Muted>Sæki…</Muted></Screen>;
  const sh: Shift = s;
  const d = new Date(s.date + "T12:00:00");
  const mine = !!me && s.empId === me.empId;
  const open = !s.empId;
  const color = deptColor(s.dept, s.typeColor && s.typeColor !== "#e9700f" ? s.typeColor : s.deptColor);
  const hrs = hoursOf(s.start, s.end);
  const est = me && mine ? estimateShift(me, s.date, s.start, s.end) : null;
  const label = `${tr(DAY_L[d.getDay()])} ${d.getDate()}.${d.getMonth() + 1} ${s.start}–${s.end}`;

  async function apply() {
    if (!me || applied) return;
    setApplied(true);
    const r = await applyForShift(me, label);
    if (!r.ok) { setApplied(false); toast(r.error ?? "Tókst ekki"); return; }
    toast("Umsókn send — vaktstjóri fær tilkynningu");
  }
  async function message() {
    if (!me || !sh.empName) return;
    const people = await peopleMap(me.companyId);
    const other = [...people.values()].find((p) => p.name === sh.empName);
    if (!other) { toast("Þessi starfsmaður er ekki með aðgang að appinu"); return; }
    const r = await startDM(me, other.userId);
    if (r.ok && r.id) router.push(`/spjall/${r.id}?name=${encodeURIComponent(other.name)}`);
  }

  return (
    <Screen title="Vakt" back right={<IconBtn label="Meira" onPress={() => setSheet("more")}><MoreHorizontal color={colors.ink} size={22} /></IconBtn>} contentStyle={{ paddingTop: 0 }}
      header={
        <View style={{ backgroundColor: color, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ backgroundColor: "rgba(255,255,255,.18)", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, minWidth: 56, alignItems: "center" }}>
            <Txt weight="bold" size={26} color="#fff" style={{ lineHeight: 28 }}>{d.getDate()}</Txt>
            <Txt size={11} weight="bold" color="#fff">{tr(DAY_L[d.getDay()]).toUpperCase()}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="bold" size={22} color="#fff" style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.4 }}>{s.start && s.end ? `${s.start}–${s.end} · ${dec1(hrs)} klst` : "Opin vakt"}</Txt>
            <Txt size={13.5} color="rgba(255,255,255,.92)">{[s.typeName, s.dept, s.company].filter(Boolean).join(" · ")}</Txt>
          </View>
        </View>
      }
    >
      <View style={{ height: 16 }} />
      <Card style={{ paddingVertical: 4 }}>
        <KV k="Starfsmaður" v={open ? <Pill tone="brand" label="Laus til umsóknar" /> : <Pressable onPress={() => s.empId && router.push(`/starfsmadur/${s.empId}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Avatar name={s.empName ?? "?"} size={28} color={s.empColor} photo={s.empPhoto} /><Txt weight="bold" size={14.5}>{s.empName}</Txt></Pressable>} />
        <KV k="Dagsetning" v={`${tr(DAY_FULL[d.getDay()])} ${d.getDate()}. ${tr(MONTHS[d.getMonth()])}`} />
        <KV k="Staður" v={[s.company, s.location].filter(Boolean).join(" · ") || "—"} />
        {s.typeName || s.dept ? <KV k="Staða" v={[s.typeName, s.dept].filter(Boolean).join(" · ")} /> : null}
        <KV k="Samstarfsfólk" last v={co.length ? <AvatarStack people={co.map((c) => ({ name: c.name, color: c.color, photo: c.photo }))} /> : <Muted>Enginn á sama tíma</Muted>} />
      </Card>

      {co.length ? (
        <Card style={{ paddingVertical: 4 }}>
          <View style={{ paddingVertical: 10 }}><Eyebrow>{tr("Allir á vakt")}</Eyebrow></View>
          {co.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/starfsmadur/${c.empId}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line2 }}>
              <Avatar name={c.name} size={32} color={c.color} photo={c.photo} />
              <Txt weight="semibold" size={14.5} style={{ flex: 1 }} numberOfLines={1}>{c.name}</Txt>
              <Muted size={13}>{c.start}–{c.end}</Muted>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {est ? (
        <View style={{ backgroundColor: colors.brandSoft, borderRadius: 18, padding: 16 }}>
          <Eyebrow color={colors.brandDeep}>Áætluð laun fyrir vaktina</Eyebrow>
          <Txt weight="bold" size={30} style={{ letterSpacing: -0.6, marginTop: 4, fontVariant: ["tabular-nums"] }}>{kr(est.total)}</Txt>
          <Txt size={12.5} color={colors.brandDeep}>Dagvinna {kr(est.base)}{est.extra ? ` · ${est.label} ${kr(est.extra)}` : ` · ${est.label}`}{me?.union ? ` · ${me.union}` : ""}</Txt>
        </View>
      ) : null}

      {open ? (
        <Btn title={applied ? "Umsókn í bið hjá vaktstjóra" : "Sækja um þessa vakt"} size="lg" disabled={applied} onPress={apply} />
      ) : mine ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn title="Bjóða vakt" variant="ghost" icon={<ArrowLeftRight color={colors.ink} size={17} />} style={{ flex: 1 }} onPress={() => setSheet("offer")} />
          <Btn title="Get ekki mætt" variant="danger" style={{ flex: 1 }} onPress={() => setSheet("cant")} />
        </View>
      ) : (
        <Btn title={trf("Senda {x} skilaboð", (s.empName ?? "").split(/\s+/)[0])} variant="ghost" icon={<MessageCircle color={colors.ink} size={17} />} onPress={message} />
      )}

      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} scroll={false}>
        <View style={{ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, overflow: "hidden" }}>
          <Row icon={<Share2 color={colors.ink2} size={19} />} title="Deila vakt" sub="Senda tíma og stað áfram" chevron={false} onPress={() => { setSheet(null); Share.share({ message: `${tr(DAY_FULL[d.getDay()])} ${d.getDate()}. ${tr(MONTHS[d.getMonth()])} · ${s.start}–${s.end} · ${[s.typeName, s.dept, s.company].filter(Boolean).join(" · ")}` }); }} />
          {!open && s.empName ? <Row icon={<MessageCircle color={colors.ink2} size={19} />} title={mine ? "Opna spjall" : trf("Skilaboð til {x}", s.empName.split(/\s+/)[0])} chevron={false} last onPress={() => { setSheet(null); if (mine) router.push("/spjall"); else message(); }} /> : null}
        </View>
      </Sheet>
      <OfferSheet open={sheet === "offer"} onClose={() => setSheet(null)} onDone={() => router.back()} shiftLabel={label} />
      <CantSheet open={sheet === "cant"} onClose={() => setSheet(null)} onDone={() => router.back()} shiftLabel={label} />
    </Screen>
  );
}
