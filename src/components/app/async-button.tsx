"use client";

import { useState } from "react";

/** Button that shows an inline spinner + disables itself while its async onClick
 * runs — instant feedback for actions that take a moment (clock out, approve, …).
 * While busy it hides the button's own icon (.is-busy svg) so only the spinner shows. */
export function AsyncButton({
  onClick, children, className = "btn", style, disabled, title, type = "button",
}: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type={type} title={title} style={style} disabled={busy || disabled}
      className={busy ? `${className} is-busy` : className}
      onClick={async (e) => {
        if (busy) return;
        setBusy(true);
        try { await onClick?.(e); } finally { setBusy(false); }
      }}
    >
      {busy && <span className="spin" />}
      {children}
    </button>
  );
}
