// Ég — laun, skírteini, skjöl, beiðnir, tímar, samstarfsfólk, stillingar, útskráning.
import React, { useCallback, useState } from "react";
import { tr, trf } from "../../src/lib/i18n";
import { View, Pressable, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { IdCard, FolderOpen, FileText, LogOut, Clock, Users, Settings, CheckCircle2, ChevronRight, Gauge } from "lucide-react-native";
import { Screen, IconBtn } from "../../src/components/screen";
import { Txt, Muted, Avatar, List, Row, IconBox, Eyebrow, Bar, Pill, iconColor } from "../../src/components/ui";
import { colors, useTheme } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { supabase } from "../../src/lib/supabase";
import { getMonthPay } from "../../src/lib/api/home";
import { listMyRequests } from "../../src/lib/api/requests";
import type { MonthPay } from "../../src/lib/api/pay";
import { kr, dec1 } from "../../src/lib/format";
import { unregisterPush } from "../../src/lib/push";
import { isManager } from "../../src/lib/api/ops";

export default function Eg() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const [pay, setPay] = useState<MonthPay | null>(null);
  const [pending, setPending] = useState(0);
  const [reqCount, setReqCount] = useState(0);
  const [manager, setManager] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!me) return;
    getMonthPay(me).then(setPay).catch(() => {});
    listMyRequests(me).then((r) => { setReqCount(r.length); setPending(r.filter((x) => x.status === "pending").length); }).catch(() => {});
    isManager().then(setManager).catch(() => {});
  }, [me]));

  const pct = pay && pay.projectedKr > 0 ? pay.earnedKr / pay.projectedKr : 0;

  return (
    <Screen title="Ég" right={<IconBtn label="Stillingar" onPress={() => router.push("/stillingar")}><Settings color={colors.ink} size={22} /></IconBtn>}>
      {me ? (
        <Pressable onPress={() => router.push("/profill")} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 2, paddingVertical: 4 }}>
          <Avatar name={me.fullName} size={56} color={me.avatarColor} photo={me.photoUrl} />
          <View style={{ flex: 1 }}>
            <Txt weight="bold" size={20} style={{ letterSpacing: -0.4 }}>{me.fullName}</Txt>
            <Muted>{[me.title, me.department].filter(Boolean).join(" · ") || "Starfsmaður"}</Muted>
          </View>
          <ChevronRight color={colors.ink3} size={20} />
        </Pressable>
      ) : null}

      {/* laun */}
      <Pressable onPress={() => router.push("/laun")} style={({ pressed }) => ({ backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, padding: 16, gap: 10, opacity: pressed ? 0.9 : 1 })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>{trf("Laun · {x}", pay?.monthLabel ?? "…")}</Eyebrow>
          {pay ? <Pill tone="good" label={trf("Greitt {x}", pay.payday)} /> : null}
        </View>
        <View>
          <Txt weight="bold" size={34} style={{ letterSpacing: -0.8, lineHeight: 38, fontVariant: ["tabular-nums"] }}>{pay ? kr(pay.earnedKr) : "—"}</Txt>
          <Muted>{pay ? `unnið hingað til · ${dec1(pay.earnedH)} klst · ${pay.shifts} ${pay.shifts === 1 ? "vakt" : "vaktir"}` : "sæki…"}</Muted>
        </View>
        <Bar value={pct} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Muted>Áætlað í mánaðarlok</Muted>
          <Txt weight="bold" size={14} style={{ fontVariant: ["tabular-nums"] }}>{pay ? kr(pay.projectedKr) : "—"}</Txt>
        </View>
      </Pressable>

      {manager ? (
        <List>
          <Row
            icon={<IconBox tone="warn"><Gauge color={iconColor("warn")} size={19} /></IconBox>}
            title={tr("Rekstur")}
            sub={tr("Á vakt núna, laun%, beiðnir og ómannaðar vaktir")}
            onPress={() => router.push("/rekstur")}
            last
          />
        </List>
      ) : null}

      <List>
        <Row icon={<IconBox tone="brand"><IdCard color={iconColor("brand")} size={19} /></IconBox>} title="Starfsmannaskírteini" sub="Sýna eða bæta í Wallet" onPress={() => router.push("/skirteini")} />
        <Row icon={<IconBox tone="info"><FolderOpen color={iconColor("info")} size={19} /></IconBox>} title="Skjöl" sub="Ráðningarsamningur, HACCP, handbækur" onPress={() => router.push("/skjol")} />
        <Row icon={<IconBox tone="good"><CheckCircle2 color={iconColor("good")} size={19} /></IconBox>} title="Beiðnir" sub={reqCount ? `${pending} í bið · ${reqCount} alls` : "Frí, vaktaskipti, leiðréttingar"} onPress={() => router.push("/beidnir")} />
        <Row icon={<IconBox><Clock color={colors.ink2} size={19} /></IconBox>} title="Tímar og stimplanir" sub={pay ? trf("{n} klst í {x}", dec1(pay.earnedH), pay.monthLabel.split(" ")[0]) : "Stimplanirnar þínar"} onPress={() => router.push("/timar")} />
        <Row icon={<IconBox><Users color={colors.ink2} size={19} /></IconBox>} title="Samstarfsfólk" sub="Hverjir vinna með þér" onPress={() => router.push("/samstarfsfolk")} last />
      </List>

      <List>
        <Row icon={<IconBox><FileText color={colors.ink2} size={19} /></IconBox>} title="Ráðningarsamningur" sub="Lesa eða undirrita" onPress={() => router.push("/samningur")} />
        <Row icon={<IconBox><Settings color={colors.ink2} size={19} /></IconBox>} title="Stillingar" sub="Tilkynningar, prófíll, lykilorð" onPress={() => router.push("/stillingar")} />
        <Row
          icon={<IconBox tone="bad"><LogOut color={iconColor("bad")} size={19} /></IconBox>}
          title="Skrá út" danger chevron={false} last
          onPress={() => Alert.alert(tr("Skrá út"), tr("Viltu skrá þig út?"), [{ text: tr("Hætta við"), style: "cancel" }, { text: tr("Skrá út"), style: "destructive", onPress: async () => { await unregisterPush().catch(() => {}); supabase.auth.signOut(); } }])}
        />
      </List>
      <Muted size={11.5} style={{ textAlign: "center" }}>VAKTO 1.0 · vakto.is · hjalp@vakto.is</Muted>
    </Screen>
  );
}
