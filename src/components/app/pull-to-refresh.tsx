"use client";

import { useEffect, useRef, useState } from "react";

/** Touch-only pull-to-refresh: drag down from the very top of the page to
 * reload — standalone PWAs on iOS have no native reload gesture. Pulls that
 * start inside an inner scroller that is already scrolled are ignored. */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const st = useRef({ startY: 0, on: false });

  useEffect(() => {
    if (!("ontouchstart" in window)) return;
    const pageTop = () => (document.scrollingElement?.scrollTop ?? 0) <= 0;
    const innerScrolled = (t: EventTarget | null) => {
      for (let el = t as HTMLElement | null; el && el !== document.body; el = el.parentElement)
        if (el.scrollTop > 0) return true;
      return false;
    };
    const onStart = (e: TouchEvent) => {
      st.current.on = pageTop() && !innerScrolled(e.target);
      st.current.startY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!st.current.on) return;
      const dy = e.touches[0].clientY - st.current.startY;
      setPull(dy > 8 && pageTop() ? Math.min((dy - 8) * 0.4, 84) : 0);
    };
    const onEnd = () => {
      if (!st.current.on) return;
      st.current.on = false;
      setPull((p) => {
        if (p >= 56) { setBusy(true); window.location.reload(); return 84; }
        return 0;
      });
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (!pull && !busy) return null;
  return (
    <div className="ptr" style={{ opacity: busy ? 1 : Math.min(pull / 56, 1) }}>
      <span className={`ptr-dot${busy || pull >= 56 ? " go" : ""}`} style={{ transform: `translateY(${pull}px)` }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ transform: busy ? undefined : `rotate(${pull * 3.2}deg)` }}>
          <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
        </svg>
      </span>
    </div>
  );
}
