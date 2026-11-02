"use client";

import { useEffect, useState } from "react";

/** Lightweight toast matching the prototype `.toast` style. */
export type ToastAction = { label: string; onClick: () => void };
let emit: ((msg: string, kind: "ok" | "error", action?: ToastAction) => void) | null = null;

/** Villuskilaboð sem kallandinn merkti ekki sem villu (margir senda `res.error` beint) fá samt viðvörunarmerki. */
const LOOKS_LIKE_ERROR = /^(villa|error|tókst ekki|ekki tókst|gat ekki|fylltu|vantar)|tókst ekki|ekki í boði í demo|aðeins til skoðunar|failed|could not|not available in the demo/i;

/** kind "error": viðvörunarmerki í stað haks og stendur lengur (villur þarf að ná að lesa).
 *  Án kind er giskað út frá textanum. */
export function toast(message: string, kind?: "ok" | "error", action?: ToastAction) {
  emit?.(message, kind ?? (LOOKS_LIKE_ERROR.test(message) ? "error" : "ok"), action);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [kind, setKind] = useState<"ok" | "error">("ok");
  const [action, setAction] = useState<ToastAction | null>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    emit = (m: string, k: "ok" | "error", a?: ToastAction) => {
      setMsg(m);
      setKind(k);
      setAction(a ?? null);
      setShow(true);
      clearTimeout(t);
      // Með aðgerð („Afturkalla“) stendur hún lengur svo hægt sé að ná að smella.
      t = setTimeout(() => { setShow(false); setAction(null); }, a ? 9000 : k === "error" ? 7000 : 2200);
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
      {action && (
        <button type="button" className="toast-act" onClick={() => { const a = action; setShow(false); setAction(null); a.onClick(); }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
