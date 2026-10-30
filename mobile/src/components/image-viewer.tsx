// Mynd í fullri stærð — opnast í appinu, ekki í vafra. Notað í spjalli (myndir) og á prófíl (prófílmynd).
import React, { useState } from "react";
import { Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { X, Download } from "lucide-react-native";
import { useToast } from "./ui";
import { tr } from "../lib/i18n";

export function ImageViewer({ url, onClose, save = true }: { url: string | null; onClose: () => void; save?: boolean }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function saveImage(u: string) {
    if (saving) return;
    setSaving(true);
    try {
      const name = u.split("?")[0].split("/").pop() || `vakto-${Date.now()}.jpg`;
      const dest = new File(Paths.cache, name);
      if (dest.exists) dest.delete();
      const file = await File.downloadFileAsync(u, dest);
      await Sharing.shareAsync(file.uri, { UTI: "public.image", mimeType: file.type || "image/jpeg" });
    } catch {
      toast(tr("Tókst ekki að vista mynd"));
    } finally {
      setSaving(false);
    }
  }

  const btn = { position: "absolute", top: insets.top + 10, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,.16)", alignItems: "center", justifyContent: "center" } as const;
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,.94)", justifyContent: "center" }}>
        {url ? <Image source={{ uri: url }} style={{ width: "100%", height: "82%" }} contentFit="contain" /> : null}
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={tr("Loka")} style={{ ...btn, right: 16 }}>
          <X color="#fff" size={20} />
        </Pressable>
        {url && save ? (
          <Pressable onPress={() => saveImage(url)} disabled={saving} hitSlop={12} accessibilityLabel={tr("Vista mynd")} style={{ ...btn, right: 64, opacity: saving ? 0.5 : 1 }}>
            <Download color="#fff" size={19} />
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}
