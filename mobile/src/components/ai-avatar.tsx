// Merki VAKTO AI: brand-hringur með neista (spjalllisti, Heim og samtalsskjár).
import React from "react";
import { View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { colors } from "../theme";

export function AiAvatar({ size = 36 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
      <Sparkles color="#fff" size={Math.round(size * 0.5)} />
    </View>
  );
}
