// Prófíllinn minn — sími, netfang, bankareikningur (self-service breytingar).
import React, { useEffect, useState } from "react";
import { View, TextInput } from "react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Btn, SectionTitle } from "../src/components/ui";
import { colors, radius, font } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { updateMyProfile } from "../src/lib/api/requests";

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.control,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  fontFamily: font.regular,
  color: colors.ink,
  backgroundColor: colors.panel,
} as const;

export default function Profill() {
  const { me, reload } = useMe();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bank, setBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      setPhone(me.phone ?? "");
      setEmail(me.email ?? "");
      setBank(me.bankAccount ?? "");
    }
  }, [me]);

  async function save() {
    if (!me) return;
    setBusy(true);
    setMsg(null);
    const r = await updateMyProfile(me, { phone, email, bankAccount: bank });
    setBusy(false);
    setMsg(r.ok ? "Breytingar vistaðar." : (r.error ?? "Villa við vistun"));
    if (r.ok) reload();
  }

  return (
    <Screen title="Prófíllinn minn" back>
      <Card style={{ gap: 12 }}>
        <SectionTitle>Upplýsingarnar mínar</SectionTitle>
        <Field label="Símanúmer">
          <TextInput style={inputStyle} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </Field>
        <Field label="Netfang">
          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Bankareikningur">
          <TextInput
            style={inputStyle}
            value={bank}
            onChangeText={setBank}
            placeholder="0000-26-000000"
            placeholderTextColor={colors.ink3}
          />
        </Field>
        {msg ? (
          <Txt size={13} color={msg.startsWith("Breytingar") ? colors.good : colors.bad}>
            {msg}
          </Txt>
        ) : null}
        <Btn title="Vista breytingar" loading={busy} onPress={save} />
      </Card>
      <Muted size={12}>
        Nafn, kennitala og launakjör eru uppfærð af stjórnanda fyrirtækisins.
      </Muted>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Muted size={12}>{label}</Muted>
      {children}
    </View>
  );
}
