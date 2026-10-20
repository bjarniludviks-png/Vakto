// Fyrrverandi starfsmaður á lesaðgangstíma (0088): aðeins launaseðlar/skjöl og samningar, síðan lokast.
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { FileText, FileSignature, LogOut } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Btn } from "../src/components/ui";
import { colors, useTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { tr } from "../src/lib/i18n";
import { getAccessState, isoToIs, type AccessState } from "../src/lib/api/access";

export default function Starfslok() {
  useTheme();
  const router = useRouter();
  const [st, setSt] = useState<AccessState | null>(null);
  useEffect(() => { getAccessState().then(setSt).catch(() => {}); }, []);

  return (
    <Screen title={tr("Starfslok")}>
      <Card>
        <Txt weight="bold" size={20} style={{ letterSpacing: -0.4 }}>Takk fyrir samstarfið</Txt>
        <Muted style={{ marginTop: 6, lineHeight: 20 }}>
          {`${tr("Ráðningu þinni lauk")} ${isoToIs(st?.lastDay ?? null)}. ${tr("Þú getur áfram skoðað og sótt launaseðla, samninga og skjöl til og með")} ${isoToIs(st?.accessUntil ?? null)}. ${tr("Eftir það lokast aðgangurinn — sæktu það sem þú vilt eiga.")}`}
        </Muted>
      </Card>
      <View style={{ gap: 10 }}>
        <Btn title={tr("Launaseðlar og skjöl")} variant="soft" icon={<FileText color={colors.brandDeep} size={18} />} onPress={() => router.push("/skjol")} />
        <Btn title={tr("Samningar")} variant="soft" icon={<FileSignature color={colors.brandDeep} size={18} />} onPress={() => router.push("/samningur")} />
        <Btn title={tr("Skrá út")} variant="ghost" icon={<LogOut color={colors.ink} size={18} />} onPress={() => supabase.auth.signOut()} />
      </View>
      <Muted size={12} style={{ textAlign: "center", marginTop: 6 }}>Aðeins til skoðunar. Spurningar um laun eða starfslok fara til vinnuveitandans.</Muted>
    </Screen>
  );
}
