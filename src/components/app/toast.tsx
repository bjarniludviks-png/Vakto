"use client";

import { useEffect, useState } from "react";

/** Lightweight toast matching the prototype `.toast` style. */
let emit: ((msg: string, kind: "ok" | "error") => void) | null = null;

/** kind "error": viðvörunarmerki í stað haks og stendur lengur (villur þarf að ná að lesa). */
export function toast(message: string, kind: "ok" | "error" = "ok") {
  emit?.(message, kind);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [kind, setKind] = useState<"ok" | "error">("ok");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    emit = (m: string, k: "ok" | "error") => {
      setMsg(m);
      setKind(k);
      setShow(true);
      clearTimeout(t);
      t = setTimeout(() => setShow(false), k === "error" ? 7000 : 2200);
    };
    return () => {
      emit = null;
      clearTimeout(t);
    };
  }, []);

  return (
    <div className={`toast${show ? " show" : ""}`} id="toast">
      <span className="ck" style={kind === "error" ? { color: "#ff9f8a" } : undefined}>{kind === "error" ? "!" : "✓"}</span>
      {msg}
    </div>
  );
}
