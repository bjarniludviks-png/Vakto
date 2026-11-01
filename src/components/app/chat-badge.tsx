"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadCounts } from "@/app/(app)/spjall/actions";

/** Fired by the chat screen right after it marks a thread read, so the sidebar
 * count drops instantly even before the realtime UPDATE round-trips. */
export const CHAT_READ_EVENT = "vakto-chat-read";

/** Total unread chat messages as a small brand pill on the "Laun & spjall" nav
 * item. Renders nothing at 0 (the pill sits at margin-left:auto, so appearing
 * or vanishing never moves the label). Refreshes on mount, on every new message
 * (Realtime INSERT on `messages`, RLS-scoped), on read-cursor changes, and when
 * the tab becomes visible again. */
export function ChatBadge({ companyId }: { companyId?: string } = {}) {
  const [total, setTotal] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        getUnreadCounts().then((r) => { if (alive) setTotal(r.total); }).catch(() => undefined);
      }, 250);
    };
    refresh();

    // Síað á fyrirtækið (skilaboð) og eigin lestrarstöðu — Realtime metur þá ekki atburði
    // annarra fyrirtækja/notenda fyrir hvern tengdan glugga.
    const supabase = createClient();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const uid = data.session?.user.id;
      ch = supabase
        .channel("chat-badge")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}) }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "channel_reads", ...(uid ? { filter: `user_id=eq.${uid}` } : {}) }, refresh)
        .subscribe();
    });

    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(CHAT_READ_EVENT, refresh);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(CHAT_READ_EVENT, refresh);
      if (ch) void supabase.removeChannel(ch);
    };
  }, [companyId]);

  if (total <= 0) return null;
  return <span className="ct" aria-label={`${total} ólesin skilaboð`}>{total > 99 ? "99+" : total}</span>;
}
