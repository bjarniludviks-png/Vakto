"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { savePushSubscription, removePushSubscription } from "@/lib/push-actions";

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Enable/disable web push on this device. Foundation UI — used in Settings +
 * Mitt svæði. No-op-safe when VAPID isn't configured. */
export default function PushToggle() {
  const { t } = useLang();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) { setSupported(false); return; }
    navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription().then((s) => setOn(!!s)));
  }, []);

  async function enable() {
    if (!pub) { toast(t("Tilkynningar eru ekki stilltar (VAPID-lyklar vantar).")); return; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast(t("Leyfi fyrir tilkynningum ekki veitt.")); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(pub) as BufferSource });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys });
      if (!res.ok) { toast(res.error ?? "Villa"); return; }
      setOn(true); toast(t("Tilkynningar virkjaðar á þessu tæki"));
    } catch {
      toast(t("Tókst ekki að virkja tilkynningar"));
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setOn(false); toast(t("Tilkynningar afvirkjaðar"));
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  if (!supported) return null;
  return (
    <button className="btn ghost sm" disabled={busy} onClick={() => (on ? disable() : enable())}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      {on ? t("Slökkva á tilkynningum") : t("Virkja tilkynningar")}
    </button>
  );
}
