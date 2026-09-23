// Heim — næsta vakt + stimplun, hverjir eru á vakt með þér, flýtihnappar,
// tilkynningar. (Prototýpa 2026-09-23.)
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Clock, CalendarPlus, ArrowLeftRight, Banknote, Check, CalendarDays, MessageCircle, Newspaper, LayoutGrid } from "lucide-react-native";
import { IconBtn } from "../../src/components/screen";
import { Card, Txt, Btn, Muted, Eyebrow, Avatar, useToast, Sheet, iconColor } from "../../src/components/ui";
import { colors, radius, brandShadow } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { getHome, dayLabel, type Home, type Noti } from "../../src/lib/api/home";
import { clockIn, clockOut } from "../../src/lib/api/punches";
import { estimateShift } from "../../src/lib/api/pay";
import { iso } from "../../src/lib/api/me";
import { kr, dec1 } from "../../src/lib/format";
import { LeaveSheet, OfferSheet } from "../../src/components/request-sheets";

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const DAYS = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Góða nótt" : h < 12 ? "Góðan daginn" : h < 18 ? "Góðan dag" : "Gott kvöld";
}
function elapsed(sinceISO: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(sinceISO).getTime()) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const { me, loading } = useMe();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [home, setHome] = useState<Home | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | "leave" | "offer" | "notis">(null);
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    try { setHome(await getHome(me)); } catch (e) { console.warn("home", e); }
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (home?.openSince) {
      timer.current = setInterval(() => tick((n) => n + 1), 1000);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
  }, [home?.openSince]);

  async function punch(into: boolean) {
    if (!me) return;
    setBusy(true);
    const res = into ? await clockIn(me) : await clockOut(me);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Aðgerð tókst ekki"); return; }
    toast(into ? `Stimplað inn kl. ${new Date().toTimeString().slice(0, 5)}` : "Stimplað út — tímarnir bíða samþykkis");
    load();
  }

  const first = me?.fullName.split(/\s+/)[0] ?? "";
  const now = new Date();
  const todayISO = iso(now);
  const onShift = !!home?.openSince;
  const shift = home?.today ?? null;
  const est = me && shift ? estimateShift(me, shift.date, shift.start, shift.end) : null;
  const shiftIsToday = shift?.date === todayISO;

  if (!loading && !me) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 20, padding: 20 }}>
        <Card>
          <Txt weight="bold" size={16}>Enginn starfsmannaprófíll tengdur</Txt>
          <Muted>Aðgangurinn þinn er ekki tengdur starfsmanni. Stjórnandi fyrirtækisins þarf að bjóða þér með sama netfangi og er á starfsmannaspjaldinu þínu.</Muted>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header */}
      <View style={{ backgroundColor: colors.panel, paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
        <Pressable onPress={() => router.push("/meira")}>
          <Avatar name={me?.fullName ?? ""} size={40} color={me?.avatarColor} photo={me?.photoUrl} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt weight="bold" size={20} style={{ letterSpacing: -0.4 }}>{greeting()}, {first}</Txt>
          <Muted>{DAYS[now.getDay()]} {now.getDate()}. {MONTHS[now.getMonth()]}</Muted>
        </View>
        <IconBtn label="Tilkynningar" onPress={() => setSheet("notis")} badge={(home?.notis.length ?? 0) > 0}>
          <Bell color={colors.ink} size={22} />
        </IconBtn>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}>
        {/* hero */}
        {onShift ? (
          <View style={{ backgroundColor: colors.good, borderRadius: 22, padding: 18, overflow: "hidden" }}>
            <View style={{ position: "absolute", right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,.12)" }} />
            <Eyebrow color="rgba(255,255,255,.85)">Á vakt · síðan {new Date(home!.openSince!).toTimeString().slice(0, 5)}</Eyebrow>
            <Txt weight="bold" size={40} color="#fff" style={{ letterSpacing: -0.8, marginTop: 4, fontVariant: ["tabular-nums"] }}>{elapsed(home!.openSince!)}</Txt>
            <Txt size={14} color="rgba(255,255,255,.9)">{shift && shiftIsToday ? `Vaktin endar ${shift.end}${shift.dept ? ` · ${shift.dept}` : ""}` : "Engin vakt á plani — stimplun skráð samt"}</Txt>
            <Pressable onPress={() => punch(false)} disabled={busy} style={({ pressed }) => ({ marginTop: 14, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: pressed ? 0.9 : 1 })}>
              <Txt weight="bold" size={16} color={colors.good}>{busy ? "Augnablik…" : "Stimpla út"}</Txt>
            </Pressable>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.brand, borderRadius: 22, padding: 18, overflow: "hidden", ...brandShadow }}>
            <View style={{ position: "absolute", right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,.12)" }} />
            <Eyebrow color="rgba(255,255,255,.85)">{shift ? `Næsta vakt · ${dayLabel(shift.date, todayISO)}` : "Næsta vakt"}</Eyebrow>
            {shift ? (
              <>
                <Txt weight="bold" size={28} color="#fff" style={{ letterSpacing: -0.6, marginTop: 4, fontVariant: ["tabular-nums"] }}>{shift.start}–{shift.end}</Txt>
                <Txt size={14} color="rgba(255,255,255,.92)">{[shift.dept, shift.typeName].filter(Boolean).join(" · ") || "Vakt"}{est ? ` · ${dec1(est.hours)} klst · áætlað ${kr(est.total)}` : ""}</Txt>
              </>
            ) : (
              <Txt weight="bold" size={20} color="#fff" style={{ marginTop: 4 }}>Engin vakt á plani næstu 3 vikur</Txt>
            )}
            <Pressable onPress={() => punch(true)} disabled={busy} style={({ pressed }) => ({ marginTop: 14, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: pressed ? 0.9 : 1 })}>
              <Clock color={colors.brandDeep} size={20} />
              <Txt weight="bold" size={16} color={colors.brandDeep}>{busy ? "Augnablik…" : "Stimpla inn"}</Txt>
            </Pressable>
          </View>
        )}

        {/* á vakt með þér */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Eyebrow>Á vakt með þér í dag</Eyebrow>
            <Muted>{home ? `${home.coworkers.length} manns` : ""}</Muted>
          </View>
          {home && home.coworkers.length === 0 ? (
            <Muted style={{ marginTop: 10 }}>Enginn annar á plani í dag.</Muted>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, marginTop: 12, paddingRight: 8 }}>
              {(home?.coworkers ?? []).map((c) => (
                <Pressable key={c.empId} onPress={() => router.push(`/starfsmadur/${c.empId}`)} style={{ alignItems: "center", gap: 5, width: 64 }}>
                  <Avatar name={c.name} size={56} color={c.color} photo={c.photo} />
                  <Txt weight="semibold" size={11} color={colors.ink2} numberOfLines={1}>{c.name.split(/\s+/)[0]}</Txt>
                  <Txt size={10.5} color={colors.ink3} style={{ fontVariant: ["tabular-nums"] }}>{c.start}–{c.end}</Txt>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Card>

        {/* flýtihnappar */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Quick icon={<LayoutGrid color={colors.brandDeep} size={18} />} title="Lausar vaktir" sub={home ? `${home.openCount} í boði` : "…"} onPress={() => router.push("/vaktir?seg=open")} />
          <Quick icon={<CalendarPlus color={colors.brandDeep} size={18} />} title="Biðja um frí" sub="svar frá vaktstjóra" onPress={() => setSheet("leave")} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Quick icon={<ArrowLeftRight color={colors.brandDeep} size={18} />} title="Bjóða vakt" sub="skipti við samstarfsfólk" onPress={() => setSheet("offer")} />
          <Quick icon={<Banknote color={colors.brandDeep} size={18} />} title="Laun" sub={home ? `${kr(home.pay.earnedKr)} unnið` : "…"} onPress={() => router.push("/laun")} />
        </View>

        {/* tilkynningar */}
        <Card style={{ paddingVertical: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 }}>
            <Eyebrow>Tilkynningar</Eyebrow>
            <Pressable onPress={() => setSheet("notis")}><Txt weight="bold" size={12.5} color={colors.brandDeep}>Allar</Txt></Pressable>
          </View>
          {home && home.notis.length === 0 ? <Muted style={{ paddingBottom: 10 }}>Ekkert nýtt — þú ert með allt á hreinu.</Muted> : null}
          {(home?.notis ?? []).slice(0, 4).map((n, i, arr) => <NotiRow key={n.id} n={n} last={i === arr.length - 1} onPress={() => go(n)} />)}
        </Card>
      </ScrollView>

      <LeaveSheet open={sheet === "leave"} onClose={() => setSheet(null)} onDone={load} />
      <OfferSheet open={sheet === "offer"} onClose={() => setSheet(null)} onDone={load} />
      <Sheet open={sheet === "notis"} onClose={() => setSheet(null)} title="Tilkynningar">
        {home && home.notis.length === 0 ? <Muted>Ekkert nýtt.</Muted> : null}
        {(home?.notis ?? []).map((n, i, arr) => <NotiRow key={n.id} n={n} last={i === arr.length - 1} onPress={() => { setSheet(null); go(n); }} />)}
      </Sheet>
    </View>
  );

  function go(n: Noti) {
    if (n.kind === "open") router.push("/vaktir?seg=open");
    else if (n.kind === "request") router.push("/beidnir");
    else if (n.kind === "post") router.push("/frettir");
    else if (n.kind === "chat") router.push("/spjall");
  }
}

function Quick({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View>
        <Txt weight="bold" size={13.5}>{title}</Txt>
        <Txt size={12} color={colors.ink2}>{sub}</Txt>
      </View>
    </Pressable>
  );
}

function NotiRow({ n, last, onPress }: { n: Noti; last?: boolean; onPress: () => void }) {
  const Icon = n.kind === "open" ? LayoutGrid : n.kind === "request" ? Check : n.kind === "post" ? Newspaper : n.kind === "chat" ? MessageCircle : CalendarDays;
  const bg = n.tone === "brand" ? colors.brandSoft : n.tone === "good" ? colors.goodSoft : n.tone === "bad" ? colors.badSoft : n.tone === "info" ? colors.infoSoft : colors.warnSoft;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line2, alignItems: "flex-start" }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Icon color={iconColor(n.tone)} size={18} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="bold" size={14} numberOfLines={1}>{n.title}</Txt>
        <Txt size={12.5} color={colors.ink2} numberOfLines={2}>{n.sub}</Txt>
      </View>
      {n.when ? <Txt size={11} color={colors.ink3} style={{ paddingTop: 2 }}>{n.when}</Txt> : null}
    </Pressable>
  );
}
