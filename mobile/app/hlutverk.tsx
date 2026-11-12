// Hlutverkin mín (0111) — föst hlutverk, ábyrgð, varamaður og yfirmaður. Ég → Hlutverkin mín.
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Users } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Empty } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { tr, trf } from "../src/lib/i18n";
import { getMyRoles, getMyDay, type MyRole } from "../src/lib/api/tasks";
import { VIA_LABEL, type DayTasks } from "../src/lib/tasks";

export default function HlutverkScreen() {
  useTheme();
  const { me } = useMe();
  const [roles, setRoles] = useState<MyRole[] | null>(null);
  const [day, setDay] = useState<DayTasks | null>(null);
  useFocusEffect(useCallback(() => {
    if (!me) return;
    getMyRoles(me).then(setRoles).catch(() => setRoles([]));
    getMyDay().then(setDay);
  }, [me]));
  // Hlutverk sem ég er með í dag án þess að eiga þau föst (færð til mín, sem varamaður, fylgja vakt).
  const extra = (day?.roles ?? []).filter((r) => r.via !== "fast");
  return (
    <Screen title="Hlutverkin mín" back>
      {day?.boss ? (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Users size={20} color={colors.ink2} />
          <View style={{ flex: 1 }}><Eyebrow>{tr("Yfirmaðurinn þinn")}</Eyebrow><Txt weight="bold" size={15}>{day.boss.name}</Txt></View>
        </Card>
      ) : null}
      {extra.length > 0 ? (
        <Card style={{ gap: 8, backgroundColor: colors.brandSoft }}>
          <Eyebrow color={colors.brandDeep}>{tr("Í dag líka")}</Eyebrow>
          {extra.map((r) => <Txt key={r.id} size={14.5}><Txt weight="bold">{r.name}</Txt> · {tr(VIA_LABEL[r.via])}{r.from_name ? ` — ${r.from_name}` : ""}</Txt>)}
        </Card>
      ) : null}
      {roles && roles.length === 0 ? <Empty icon={<Users size={26} color={colors.brand} />} title={tr("Engin föst hlutverk")} sub={tr("Yfirmaðurinn þinn setur hlutverk í VAKTO, t.d. Bílstjóri eða Opnun.")} /> : null}
      {(roles ?? []).map((r) => (
        <Card key={r.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: r.color ?? colors.brand }} />
            <Txt weight="bold" size={17} style={{ flex: 1 }}>{r.name}</Txt>
            {r.backup ? <Txt size={12.5} weight="semibold" color={colors.warn}>{tr("Varamaður")}</Txt> : null}
          </View>
          {r.responsibilities.length ? (
            <View style={{ gap: 4 }}>{r.responsibilities.map((x, i) => <Txt key={i} size={14} color={colors.ink2}>•  {x}</Txt>)}</View>
          ) : null}
          {r.others.length ? (
            <Muted size={12.5}>{r.backup ? trf("Aðal: {x}", r.others.filter((o) => !o.backup).map((o) => o.name).join(", ") || "—") : trf("Varamaður: {x}", r.others.filter((o) => o.backup).map((o) => o.name).join(", ") || tr("enginn"))}</Muted>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
