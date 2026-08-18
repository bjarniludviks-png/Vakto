// Heim — Mitt svæði: stimplun, vikuplan, næstu vaktir, launamat, réttindi.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Clock, LogIn, LogOut } from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Btn, Muted, Pill, SectionTitle } from "../../src/components/ui";
import { colors } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { getMyArea, type MyArea } from "../../src/lib/api/me";
import { clockIn, clockOut } from "../../src/lib/api/punches";
import { kr, dec1 } from "../../src/lib/format";

function elapsed(sinceISO: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(sinceISO).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")} klst`;
}

export default function Home() {
  const { me, loading } = useMe();
  const [area, setArea] = useState<MyArea | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    setArea(await getMyArea(me));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  // minute tick for the elapsed-time display while clocked in
  useEffect(() => {
    if (area?.openSince) {
      timer.current = setInterval(() => tick((n) => n + 1), 30000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
  }, [area?.openSince]);

  async function punch(into: boolean) {
    if (!me) return;
    setBusy(true);
    setError(null);
    const res = into ? await clockIn(me) : await clockOut(me);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Aðgerð tókst ekki");
      return;
    }
    load();
  }

  const firstName = me?.fullName.split(/\s+/)[0] ?? "";

  if (!loading && !me) {
    return (
      <Screen title="Mitt svæði">
        <Card>
          <Txt weight="semibold" size={15}>
            Enginn starfsmannaprófíll tengdur
          </Txt>
          <Muted>
            Aðgangurinn þinn er ekki tengdur starfsmanni. Hafðu samband við stjórnanda fyrirtækisins.
          </Muted>
        </Card>
      </Screen>
    );
  }

  const onShift = !!area?.openSince;

  return (
    <Screen
      title={firstName ? `Hæ, ${firstName}` : "Mitt svæði"}
      subtitle={me?.department ?? undefined}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {/* Stimplun */}
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Clock color={onShift ? colors.good : colors.ink3} size={20} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={16}>
              {onShift ? "Á vakt" : "Ekki á vakt"}
            </Txt>
            {onShift && area?.openSince ? (
              <Muted>
                Stimplað inn{" "}
                {new Date(area.openSince).toTimeString().slice(0, 5)} — {elapsed(area.openSince)}
              </Muted>
            ) : (
              <Muted>Stimplaðu þig inn þegar vaktin hefst</Muted>
            )}
          </View>
          {onShift ? <Pill label="Í gangi" tone="good" /> : null}
        </View>
        {error ? (
          <Txt color={colors.bad} size={13}>
            {error}
          </Txt>
        ) : null}
        <Btn
          title={onShift ? "Stimpla út" : "Stimpla inn"}
          variant={onShift ? "danger" : "good"}
          loading={busy}
          onPress={() => punch(!onShift)}
        />
      </Card>

      {/* Vikan */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <Txt weight="semibold" size={16}>
            Vikan mín
          </Txt>
          <Muted>{area ? `${dec1(area.weekHours)} klst` : ""}</Muted>
        </View>
        <View style={{ gap: 8 }}>
          {(area?.days ?? []).map((d) => (
            <View
              key={d.date}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: d.today ? colors.brandSoft : "transparent",
              }}
            >
              <Txt
                weight={d.today ? "semibold" : "regular"}
                size={13}
                style={{ width: 64 }}
                color={d.today ? colors.brandDeep : colors.ink}
              >
                {d.label}
              </Txt>
              <Txt size={13} weight={d.time ? "medium" : "regular"} color={d.time ? colors.ink : colors.ink3} style={{ flex: 1 }}>
                {d.time ?? "Frí"}
              </Txt>
              {d.premium ? <Pill label={d.premium} tone="brand" /> : null}
            </View>
          ))}
        </View>
      </Card>

      {/* Launamat */}
      {area?.pay ? (
        <Card>
          <SectionTitle>Launamat mánaðarins</SectionTitle>
          <View style={{ gap: 6 }}>
            <Row label={`Dagvinna · ${dec1(area.pay.dayH)} klst`} value={kr(area.pay.dayKr)} />
            {area.pay.premH > 0 ? (
              <Row label={`Álag · ${dec1(area.pay.premH)} klst`} value={kr(area.pay.premKr)} />
            ) : null}
            {area.pay.otH > 0 ? (
              <Row label={`Yfirvinna · ${dec1(area.pay.otH)} klst`} value={kr(area.pay.otKr)} />
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
            <Row label={`Samtals · ${dec1(area.pay.totalH)} klst`} value={kr(area.pay.totalKr)} bold />
          </View>
          <Muted size={12}>
            {"\n"}Áætlun út frá stimplunum — launaseðill kemur við launakeyrslu.
          </Muted>
        </Card>
      ) : null}

      {/* Réttindi */}
      {area?.rights ? (
        <Card>
          <SectionTitle>Réttindi og staða</SectionTitle>
          <View style={{ gap: 6 }}>
            <Row label="Unnið í mánuðinum" value={`${dec1(area.rights.worked)} klst`} />
            <Row label="Viðmið mánaðar" value={`${dec1(area.rights.required)} klst`} />
            <Row
              label="Tímabanki"
              value={`${area.rights.bank >= 0 ? "+" : ""}${dec1(area.rights.bank)} klst`}
            />
            <Row label="Áunnið orlof" value={`${dec1(area.rights.orlofDays)} dagar`} />
            {area.rights.orlofFund > 0 ? <Row label="Orlofssjóður" value={kr(area.rights.orlofFund)} /> : null}
            {area.rights.union ? <Row label="Stéttarfélag" value={area.rights.union} /> : null}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Txt size={13} color={bold ? colors.ink : colors.ink2} weight={bold ? "semibold" : "regular"}>
        {label}
      </Txt>
      <Txt size={13} weight={bold ? "semibold" : "medium"}>
        {value}
      </Txt>
    </View>
  );
}
