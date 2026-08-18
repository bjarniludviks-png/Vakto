// Meira — prófíll, skírteini, skjalasafn, útskráning.
import React from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  IdCard,
  FolderOpen,
  UserRound,
  FileText,
  LogOut,
  ChevronRight,
} from "lucide-react-native";
import { Screen } from "../../src/components/screen";
import { Card, Txt, Muted, Avatar } from "../../src/components/ui";
import { colors } from "../../src/theme";
import { useMe } from "../../src/lib/me-context";
import { supabase } from "../../src/lib/supabase";

function MenuRow({
  icon,
  label,
  hint,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 13,
        }}
      >
        {icon}
        <View style={{ flex: 1 }}>
          <Txt weight="medium" size={15} color={danger ? colors.bad : colors.ink}>
            {label}
          </Txt>
          {hint ? <Muted size={12}>{hint}</Muted> : null}
        </View>
        {!danger ? <ChevronRight color={colors.ink3} size={18} /> : null}
      </View>
    </Pressable>
  );
}

export default function Meira() {
  const { me } = useMe();
  const router = useRouter();

  return (
    <Screen title="Meira">
      {me ? (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={me.fullName} size={52} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={17}>
              {me.fullName}
            </Txt>
            <Muted>{[me.title, me.department].filter(Boolean).join(" · ") || "Starfsmaður"}</Muted>
          </View>
        </Card>
      ) : null}

      <Card style={{ paddingVertical: 4 }}>
        <MenuRow
          icon={<UserRound color={colors.ink2} size={20} />}
          label="Prófíllinn minn"
          hint="Sími, netfang, bankareikningur"
          onPress={() => router.push("/profill")}
        />
        <View style={{ height: 1, backgroundColor: colors.line2 }} />
        <MenuRow
          icon={<IdCard color={colors.ink2} size={20} />}
          label="Starfsmannaskírteini"
          hint="Skírteinið þitt með mynd"
          onPress={() => router.push("/skirteini")}
        />
        <View style={{ height: 1, backgroundColor: colors.line2 }} />
        <MenuRow
          icon={<FolderOpen color={colors.ink2} size={20} />}
          label="Skjalasafn"
          hint="HACCP, handbækur og skjölin þín"
          onPress={() => router.push("/skjol")}
        />
        <View style={{ height: 1, backgroundColor: colors.line2 }} />
        <MenuRow
          icon={<FileText color={colors.ink2} size={20} />}
          label="Ráðningarsamningur"
          hint="Samningurinn þinn"
          onPress={() => router.push("/samningur")}
        />
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <MenuRow
          danger
          icon={<LogOut color={colors.bad} size={20} />}
          label="Skrá út"
          onPress={() =>
            Alert.alert("Skrá út", "Viltu skrá þig út?", [
              { text: "Hætta við", style: "cancel" },
              {
                text: "Skrá út",
                style: "destructive",
                onPress: () => supabase.auth.signOut(),
              },
            ])
          }
        />
      </Card>

      <Muted size={11}>VAKTO · vakto.is</Muted>
    </Screen>
  );
}
