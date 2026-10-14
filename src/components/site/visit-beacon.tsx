"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Telur heimsókn á opnu síðunum (/api/v, 0079). Innri kerfissíður eru ekki taldar.
const PUBLIC = ["/", "/ny", "/um-okkur", "/fjarfestar", "/skilmalar", "/personuvernd", "/vafrakokur", "/nyskraning", "/login"];
const isPublic = (p: string) => PUBLIC.some((x) => (x === "/" ? p === "/" : p === x || p.startsWith(`${x}/`)));

export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !isPublic(pathname)) return;
    const q = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      path: pathname, ref: document.referrer || null,
      utm_source: q.get("utm_source"), utm_campaign: q.get("utm_campaign"), utm_content: q.get("utm_content"),
    });
    try {
      if (!navigator.sendBeacon?.("/api/v", new Blob([body], { type: "application/json" })))
        fetch("/api/v", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch { /* teljum ekki */ }
  }, [pathname]);
  return null;
}
