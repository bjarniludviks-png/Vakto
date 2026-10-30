// Talskilaboð í spjalli: upptaka (hljóðnemi → .m4a) og spilari í bólu.
// expo-audio er native-eining sem kom í build 1.0.2. runtimeVersion er „sdkVersion“, svo sama OTA fer líka
// á eldri build — þar er einingin ekki til. Því er hún aðeins sótt ef hún er í buildinu; annars er enginn
// hljóðnemahnappur og talskilaboð opnast í vafra.
import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Mic, Play, Pause, X, Send } from "lucide-react-native";
import { Txt } from "./ui";
import { colors } from "../theme";
import { tr } from "../lib/i18n";

type AudioLib = typeof import("expo-audio");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const A: AudioLib | null = requireOptionalNativeModule("ExpoAudio") ? (require("expo-audio") as AudioLib) : null;

export const canRecordVoice = !!A;
export const MAX_VOICE_SEC = 120;

const mmss = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

/** Hljóðnemahnappur við innsláttinn — aðeins ef buildið styður upptöku. */
export function MicButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  if (!A) return null;
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityLabel={tr("Taka upp talskilaboð")} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
      <Mic color={colors.brand} size={24} />
    </Pressable>
  );
}

/** Upptökustika (kemur í stað innsláttar): rauður punktur + tími, X hættir við, ör sendir. */
export function RecorderBar({ onDone, onCancel, onError }: { onDone: (uri: string, seconds: number) => void; onCancel: () => void; onError: (msg: string) => void }) {
  if (!A) return null;
  return <Recorder lib={A} onDone={onDone} onCancel={onCancel} onError={onError} />;
}

function Recorder({ lib, onDone, onCancel, onError }: { lib: AudioLib; onDone: (uri: string, seconds: number) => void; onCancel: () => void; onError: (msg: string) => void }) {
  const rec = lib.useAudioRecorder(lib.RecordingPresets.HIGH_QUALITY);
  const st = lib.useAudioRecorderState(rec, 250);
  const done = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const p = await lib.requestRecordingPermissionsAsync();
        if (!p.granted) { onError(tr("Leyfðu hljóðnema í stillingum símans")); onCancel(); return; }
        await lib.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await rec.prepareToRecordAsync();
        if (live) rec.record();
      } catch { onError(tr("Tókst ekki að hefja upptöku")); onCancel(); }
    })();
    return () => {
      live = false;
      if (!done.current) rec.stop().catch(() => {});
      lib.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish(send: boolean) {
    if (done.current) return;
    done.current = true;
    const secs = st.durationMillis / 1000;
    try { await rec.stop(); } catch { /* þegar stöðvað */ }
    if (!send) { onCancel(); return; }
    if (!rec.uri || secs < 1) { onError(tr("Of stutt — haltu áfram að tala")); onCancel(); return; }
    onDone(rec.uri, secs);
  }

  // hámarkslengd: senda sjálfkrafa
  useEffect(() => { if (st.durationMillis >= MAX_VOICE_SEC * 1000) void finish(true); }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
      <Pressable onPress={() => finish(false)} hitSlop={8} accessibilityLabel={tr("Hætta við")} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><X color={colors.ink2} size={24} /></Pressable>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: 14, height: 40 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: st.isRecording ? colors.bad : colors.ink3 }} />
        <Txt weight="semibold" size={15} color={colors.brandDeep}>{mmss(st.durationMillis / 1000)}</Txt>
        <Txt size={13} color={colors.ink3} numberOfLines={1} style={{ flexShrink: 1 }}>{st.isRecording ? tr("Tek upp…") : ""}</Txt>
      </View>
      <Pressable onPress={() => finish(true)} hitSlop={8} accessibilityLabel={tr("Senda")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Send color="#fff" size={19} /></Pressable>
    </View>
  );
}

/** Spilari í bólu: spila/hlé, framvindustika, tími. Eldri build (engin eining) → opnast í vafra. */
export function AudioBubble({ url, me }: { url: string; me: boolean }) {
  if (!A) {
    return (
      <Pressable onPress={() => Linking.openURL(url)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
        <Mic color={me ? "#fff" : colors.ink2} size={18} />
        <Txt weight="semibold" size={14.5} color={me ? "#fff" : colors.ink}>{tr("Talskilaboð")}</Txt>
      </Pressable>
    );
  }
  return <Player lib={A} url={url} me={me} />;
}

function Player({ lib, url, me }: { lib: AudioLib; url: string; me: boolean }) {
  const player = lib.useAudioPlayer(url);
  const st = lib.useAudioPlayerStatus(player);
  const [w, setW] = useState(0);
  useEffect(() => { if (st.didJustFinish) { player.pause(); player.seekTo(0).catch(() => {}); } }, [st.didJustFinish, player]);
  const dur = st.duration || 0;
  const pct = dur ? Math.min(1, st.currentTime / dur) : 0;
  const fg = me ? "#fff" : colors.brand;
  const track = me ? "rgba(255,255,255,.35)" : colors.line;
  async function toggle() {
    if (st.playing) { player.pause(); return; }
    await lib.setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.play();
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, width: 210, paddingVertical: 2 }}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={st.playing ? tr("Hlé") : tr("Spila")} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: me ? "rgba(255,255,255,.22)" : colors.panel, alignItems: "center", justifyContent: "center" }}>
        {st.playing ? <Pause color={fg} size={17} fill={fg} /> : <Play color={fg} size={17} fill={fg} style={{ marginLeft: 2 }} />}
      </Pressable>
      <Pressable style={{ flex: 1, height: 24, justifyContent: "center" }} onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onPress={(e) => { if (dur && w) player.seekTo((e.nativeEvent.locationX / w) * dur).catch(() => {}); }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: track }}>
          <View style={{ width: `${pct * 100}%`, height: 4, borderRadius: 2, backgroundColor: fg }} />
        </View>
      </Pressable>
      <Txt size={12} color={me ? "rgba(255,255,255,.9)" : colors.ink3} style={{ minWidth: 32, textAlign: "right" }}>{mmss(st.playing || st.currentTime ? st.currentTime : dur)}</Txt>
    </View>
  );
}
