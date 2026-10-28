"use client";

// Merkir innskráðan notanda virkan meðan síðan er opin og sýnileg (á 3 mín. fresti) — fyrir „Virk(ur) núna“
// í spjalli. Gagnagrunnurinn skráir aðeins síðasta tíma (engin saga), mest á 2 mín. fresti.
import { useEffect } from "react";
import { touchPresence } from "@/app/(app)/spjall/presence-actions";

export function PresencePing() {
  useEffect(() => {
    const ping = () => { if (document.visibilityState === "visible") void touchPresence(); };
    ping();
    const t = window.setInterval(ping, 3 * 60 * 1000);
    document.addEventListener("visibilitychange", ping);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", ping); };
  }, []);
  return null;
}
