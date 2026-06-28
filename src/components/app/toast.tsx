"use client";

import { useEffect, useState } from "react";

/** Lightweight toast matching the prototype `.toast` style. */
let emit: ((msg: string) => void) | null = null;

export function toast(message: string) {
  emit?.(message);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    emit = (m: string) => {
      setMsg(m);
      setShow(true);
      clearTimeout(t);
      t = setTimeout(() => setShow(false), 2200);
    };
    return () => {
      emit = null;
      clearTimeout(t);
    };
  }, []);

  return (
    <div className={`toast${show ? " show" : ""}`} id="toast">
      <span className="ck">✓</span>
      {msg}
    </div>
  );
}
