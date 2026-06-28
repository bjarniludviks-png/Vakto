"use client";

import Link from "next/link";
import { useLang } from "./lang";

/** Clean "no data yet" placeholder for a new/empty company (no demo data). */
export function EmptyState({
  title,
  message,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const { t } = useLang();
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="cb" style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{
          width: 52, height: 52, margin: "0 auto 16px", borderRadius: 14,
          background: "var(--brand-soft)", color: "var(--brand)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{t(title)}</div>
        <p className="muted" style={{ fontSize: 13.5, maxWidth: 420, margin: "0 auto", lineHeight: 1.55 }}>{t(message)}</p>
        {ctaLabel && ctaHref && (
          <Link className="btn" href={ctaHref} style={{ marginTop: 18, textDecoration: "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            {t(ctaLabel)}
          </Link>
        )}
      </div>
    </div>
  );
}
