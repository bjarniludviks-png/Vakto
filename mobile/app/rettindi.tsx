// Réttindin mín: orlof (réttur skv. kjarasamningi, áunnið, tekið, eftir), veikindi og veikindi barna síðustu
// 12 mánuði á móti rétti, næsta hækkun og fjarvistir. Sama regla og vefurinn (Starfsfólk → Frí, Innsýn).
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Wallet } from "lucide-react-native";
import { tr, trf } from "../src/lib/i18n";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Eyebrow, Bar, Btn, Pill, KV } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { getMyRights, type MyRights } from "../src/lib/api/rights";
import { dec1 } from "../src/lib/format";

const dm = (iso: string) => { const [y, m, d] = iso.split("-"); return `${+d}.${+m}.${y}`; };
const pct = (n: number) => String(n).replace(".", ",");
const TYPE_LBL: Record<string, string> = { veikindi: "Veikindi", veikindi_barns: "Veikindi barns", orlof: "Orlof", olaunad: "Launalaust frí", annad: "Frí" };

function Meter({ label, used, right, rightLabel, note }: { label: string; used: number; right: number; rightLabel: string; note?: string }) {
  const share = right > 0 ? used / right : used > 0 ? 1 : 0;
  const tone = right > 0 && used > right ? "bad" : share >= 0.8 ? "warn" : "good";
  const color = tone === "bad" ? colors.bad : tone === "warn" ? colors.warn : colors.good;
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Eyebrow>{tr(label)}</Eyebrow>
        <Pill tone={tone} label={tone === "bad" ? tr("Umfram rétt") : tone === "warn" ? tr("Að klárast") : tr("Í lagi")} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Txt weight="bold" size={30} style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.6 }}>{used}</Txt>
        <Muted>{trf("af {x} dögum notaðir", right > 0 ? String(right) : "0")}</Muted>
      </View>
      <Bar value={share} color={color} />
      <Muted size={12}>{tr("Réttur")}: {rightLabel}{note ? ` · ${note}` : ""}</Muted>
    </Card>
  );
}

export default function Rettindi() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const [r, setR] = useState<MyRights | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { if (me) setR(await getMyRights(me).catch(() => null)); }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const b = r?.orlof.balance ?? null;
  const o = r?.orlof.right ?? null;

  return (
    <Screen title="Réttindin mín" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {me?.contractor ? (
        <Card><Muted>{tr("Verktakar eiga ekki orlofs- eða veikindarétt hjá fyrirtækinu — þú sérð um það sjálf(ur).")}</Muted></Card>
      ) : !r ? (
        <Card><Muted>{tr("Sæki réttindin…")}</Muted></Card>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow>{tr("Orlof")}</Eyebrow>
              {o ? <Pill tone="brand" label={`${o.now.days} ${tr("dagar")} · ${pct(o.now.pct)} %`} /> : null}
            </View>
            {b?.tracksDays ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Txt weight="bold" size={34} style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.8 }}>{dec1(b.remainingDays)}</Txt>
                  <Muted>{tr("orlofsdagar eftir")}</Muted>
                </View>
                <Bar value={b.earnedDays > 0 ? (b.takenDays + b.pendingDays) / b.earnedDays : 0} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Muted size={12}>{trf("Áunnið {x} d.", dec1(b.earnedDays))}</Muted>
                  <Muted size={12}>{trf("Tekið {x} d.", dec1(b.takenDays))}{b.pendingDays ? ` · ${trf("í bið {x}", dec1(b.pendingDays))}` : ""}</Muted>
                </View>
                <Muted size={12}>{trf("Orlofsárið hófst {x}", dm(b.yearStart))}</Muted>
              </>
            ) : (
              <>
                <Txt weight="bold" size={20}>{b ? `${pct(b.pct)} %` : o ? `${pct(o.now.pct)} %` : "—"}</Txt>
                <Muted>{b?.mode === "to_bank" ? tr("Orlofið er lagt inn á orlofsreikning með hverjum launum.") : tr("Orlofið er greitt út með hverjum launum, svo engin dagastaða safnast hér.")}</Muted>
                {r.leaveTaken ? <Muted size={12}>{trf("Frí tekið á orlofsárinu: {x} dagar", String(r.leaveTaken))}</Muted> : null}
              </>
            )}
            {o?.next ? <Muted size={12}>{trf("Hækkar í {n} daga ({x} %) {x}", o.next.days, pct(o.next.pct), dm(o.next.from))}</Muted> : null}
          </Card>

          {r.sick.right ? (
            <Meter label="Veikindi síðustu 12 mánuði" used={r.sick.used} right={r.sick.right.days} rightLabel={r.sick.right.label} />
          ) : (
            <Card><Eyebrow>{tr("Veikindi síðustu 12 mánuði")}</Eyebrow><Txt weight="bold" size={22} style={{ marginTop: 4 }}>{r.sick.used} {tr("dagar")}</Txt><Muted size={12}>{tr("Veikindaréttur fyrir þitt félag er ekki kominn inn í VAKTO.")}</Muted></Card>
          )}
          <Meter label="Veikindi barna" used={r.child.used} right={r.child.days} rightLabel={r.child.label} />

          <Card style={{ paddingVertical: 6 }}>
            <KV k={tr("Kjarasamningur")} v={r.agreement?.name ?? r.union ?? "—"} />
            <KV k={tr("Ráðin(n)")} v={r.hireDate ? dm(r.hireDate) : tr("vantar — talaðu við yfirmann")} />
            {r.priorMonths ? <KV k={tr("Fyrri starfstími sem telst með")} v={`${Math.floor(r.priorMonths / 12)} ${tr("ár")} ${r.priorMonths % 12} ${tr("mán.")}`} /> : null}
            <KV k={tr("Næsta breyting")} v={r.nextChange ? `${dm(r.nextChange.date)} · ${tr(r.nextChange.text)}` : "—"} last />
          </Card>

          {r.absences.length ? (
            <Card style={{ paddingVertical: 10 }}>
              <Eyebrow>{tr("Fjarvistir síðustu 12 mánuði")}</Eyebrow>
              {r.absences.slice(0, 12).map((a, i) => (
                <View key={a.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: i === Math.min(r.absences.length, 12) - 1 ? 0 : 1, borderBottomColor: colors.line2 }}>
                  <View style={{ flexShrink: 1 }}>
                    <Txt size={14} weight="semibold">{tr(TYPE_LBL[a.type] ?? "Frí")}</Txt>
                    <Muted size={12}>{dm(a.from)}{a.to !== a.from ? ` – ${dm(a.to)}` : ""}</Muted>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Txt size={14} weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>{a.days} {tr("d.")}</Txt>
                    {a.status !== "approved" ? <Muted size={11.5}>{a.status === "pending" ? tr("í bið") : tr("hafnað")}</Muted> : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <Muted size={12} style={{ lineHeight: 18 }}>{tr("Reiknað eftir kjarasamningnum þínum og starfsaldri. Veikindadagar eru virkir dagar. Ef eitthvað stemmir ekki, talaðu við yfirmanninn þinn.")}</Muted>
        </>
      )}
      <Btn title="Launin mín" variant="ghost" icon={<Wallet color={colors.ink} size={17} />} onPress={() => router.push("/laun")} />
    </Screen>
  );
}
