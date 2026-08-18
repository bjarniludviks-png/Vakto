// Starfsmannaskírteini — stafrænt skírteini með mynd/upphafsstöfum.
import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Svg, { Rect } from "react-native-svg";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Avatar } from "../src/components/ui";
import { colors } from "../src/theme";
import { useMe } from "../src/lib/me-context";

export default function Skirteini() {
  const { me } = useMe();

  return (
    <Screen title="Skírteini" back>
      {me ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <View
            style={{
              backgroundColor: colors.brand,
              paddingVertical: 14,
              paddingHorizontal: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Svg width={22} height={22} viewBox="0 0 28 28" fill="none">
              <Rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#ffffffb0" />
              <Rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#ffffff" />
              <Rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#ffffffd9" />
            </Svg>
            <Txt weight="bold" size={16} color="#fff" style={{ letterSpacing: 1 }}>
              VAKTO
            </Txt>
            <View style={{ flex: 1 }} />
            <Txt size={11} color="#ffffffcc">
              Starfsmannaskírteini
            </Txt>
          </View>

          <View style={{ alignItems: "center", padding: 24, gap: 12 }}>
            {me.photoUrl ? (
              <Image
                source={{ uri: me.photoUrl }}
                style={{ width: 110, height: 110, borderRadius: 55 }}
                contentFit="cover"
              />
            ) : (
              <Avatar name={me.fullName} size={110} />
            )}
            <View style={{ alignItems: "center" }}>
              <Txt weight="bold" size={20}>
                {me.fullName}
              </Txt>
              <Muted>{[me.title, me.department].filter(Boolean).join(" · ") || "Starfsmaður"}</Muted>
            </View>
            {me.kennitala ? (
              <View style={{ alignItems: "center" }}>
                <Muted size={11}>Kennitala</Muted>
                <Txt weight="medium" size={14}>
                  {me.kennitala}
                </Txt>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}
      <Muted size={12}>Sýndu skírteinið við innkomu eða þegar óskað er eftir auðkenningu.</Muted>
    </Screen>
  );
}
