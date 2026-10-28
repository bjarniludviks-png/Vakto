// Prófíllinn minn — mynd, sími, netfang, bankareikningur (self-service breytingar).
import React, { useEffect, useState } from "react";
import { tr } from "../src/lib/i18n";
import { View, TextInput, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Images } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Btn, SectionTitle, Avatar } from "../src/components/ui";
import { colors, radius, font, useTheme } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { updateMyProfile, uploadMyPhoto } from "../src/lib/api/requests";

const inputStyle = () => ({
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.control,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  fontFamily: font.regular,
  color: colors.ink,
  backgroundColor: colors.panel,
} as const);

export default function Profill() {
  useTheme();
  const { me, reload } = useMe();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bank, setBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      setPhone(me.phone ?? "");
      setEmail(me.email ?? "");
      setBank(me.bankAccount ?? "");
    }
  }, [me]);

  async function choosePhoto(camera: boolean) {
    if (!me || photoBusy) return;
    setPhotoMsg(null);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setPhotoMsg(tr("Leyfðu aðgang að myndavél í stillingum símans")); return; }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    setPhotoBusy(true);
    const up = await uploadMyPhoto(me, a.uri, a.mimeType === "image/png" ? "image/png" : "image/jpeg");
    setPhotoBusy(false);
    if (!up.ok || !up.url) { setPhotoMsg(up.error ?? tr("Mynd hlóðst ekki upp")); return; }
    setPhoto(up.url);
    reload();
  }

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
      {me ? (
        <Card style={{ alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => choosePhoto(false)} accessibilityLabel={tr("Breyta mynd")} style={{ opacity: photoBusy ? 0.5 : 1 }}>
            <Avatar name={me.fullName} size={96} color={me.avatarColor} photo={photo ?? me.photoUrl} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn title="Taka mynd" variant="soft" size="sm" icon={<Camera color={colors.ink} size={16} />} disabled={photoBusy} onPress={() => choosePhoto(true)} />
            <Btn title="Velja mynd" variant="soft" size="sm" icon={<Images color={colors.ink} size={16} />} loading={photoBusy} onPress={() => choosePhoto(false)} />
          </View>
          {photoMsg ? <Txt size={13} color={colors.bad}>{photoMsg}</Txt> : null}
        </Card>
      ) : null}
      <Card style={{ gap: 12 }}>
        <SectionTitle>Upplýsingarnar mínar</SectionTitle>
        <Field label="Símanúmer">
          <TextInput style={inputStyle()} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </Field>
        <Field label="Netfang">
          <TextInput
            style={inputStyle()}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Bankareikningur">
          <TextInput
            style={inputStyle()}
            value={bank}
            onChangeText={setBank}
            placeholder={tr("0000-26-000000")}
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
