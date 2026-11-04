import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/** Hæð lyklaborðsins á Android (0 á iOS).
 *
 * Expo SDK 54+ keyrir Android „edge-to-edge“: glugginn minnkar EKKI þegar lyklaborðið opnast
 * (adjustResize virkar ekki) og KeyboardAvoidingView án behavior gerir ekkert — innsláttarreiturinn
 * lenti undir lyklaborðinu í spjalli o.fl. Skjáir leggja þessa hæð við paddingBottom á Android;
 * iOS heldur áfram að nota KeyboardAvoidingView (behavior="padding"). */
export function useAndroidKeyboardPad(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => setH(Math.max(0, e.endCoordinates?.height ?? 0)));
    const hide = Keyboard.addListener("keyboardDidHide", () => setH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return h;
}
