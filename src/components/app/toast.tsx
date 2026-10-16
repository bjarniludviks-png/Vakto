"use client";

import { useEffect, useState } from "react";

/** Lightweight toast matching the prototype `.toast` style. */
let emit: ((msg: string, kind: "ok" | "error") => void) | null = null;

/** Villuskilaboð sem kallandinn merkti ekki sem villu (margir senda `res.error` beint) fá samt viðvörunarmerki. */
const LOOKS_LIKE_ERROR = /^(villa|error|tókst ekki|ekki tókst|gat ekki|fylltu|vantar)|tókst ekki|failed|could not/i;

/** kind "error": viðvörunarmerki í stað haks og stendur lengur (villur þarf að ná að lesa).
 *  Án kind er giskað út frá textanum. */
export function toast(message: string, kind?: "ok" | "error") {
  emit?.(message, kind ?? (LOOKS_LIKE_ERROR.test(message) ? "error" : "ok"));
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
