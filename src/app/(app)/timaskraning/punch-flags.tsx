"use client";

// Deviation tags for a punch row (late, left early, over plan, forgot to clock
// out, …) plus the row accent that makes them easy to spot while skimming a
// month. Shared by the employee timesheet page and the quick-look modal.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import { getFenceSites, type FenceSite, type PunchFlag, type PunchGeo, type PunchRow } from "./actions";
import type { GeoPoint } from "@/components/app/geo-map";

const GeoMap = dynamic(() => import("@/components/app/geo-map"), { ssr: false });

const distText = (m: number) => m >= 1000 ? `${dec1(m / 1000)} km` : `${m} m`;

export function flagLabel(f: PunchFlag, t: (k: string) => string): string {
  switch (f.code) {
    case "open_long": return `${t("Vantar útstimplun")} · ${f.n} ${t("klst")}`;
    case "long": return `${t("Óvenju löng vakt")} · ${dec1(f.n)} ${t("klst")}`;
    case "short": return `${t("Óvenju stutt vakt")} · ${f.n} ${t("mín")}`;
    case "late": return `${f.n} ${t("mín of seint")}`;
    case "early": return `${t("fór")} ${f.n} ${t("mín fyrr")}`;
    case "over": return `+${dec1(f.n)} ${t("klst yfir áætlun")}`;
    case "unscheduled": return t("óáætluð vakt");
    case "off_site": return `${f.edge === "in" ? t("Inn") : t("Út")} ${t("utan svæðis")} · ${distText(f.n)}`;
    case "no_location": return `${f.edge === "in" ? t("Inn") : t("Út")} ${t("án staðsetningar")}`;
  }
}

const PinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: -1, marginRight: 4 }}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
);

/** Flag tags for a punch. With `geo`, location flags open a map of where the
 *  punch happened; a punch with a position but no flag gets a small map link. */
export function PunchFlags({ flags, geo, title }: { flags: PunchFlag[]; geo?: PunchGeo | null; title?: string }) {
  const { t } = useLang();
  const [map, setMap] = useState(false);
  const hasPos = !!(geo?.in?.lat != null || geo?.out?.lat != null);
  const geoFlag = flags.some((f) => f.code === "off_site");
  if (!flags.length && !hasPos) return null;
  return (
    <>
      {flags.map((f, i) => (f.code === "off_site" && hasPos
        ? <button key={i} type="button" className={`tag ${f.kind}`} style={{ whiteSpace: "nowrap", border: 0, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setMap(true)}><PinIcon />{flagLabel(f, t)}</button>
        : <span key={i} className={`tag ${f.kind}`} style={{ whiteSpace: "nowrap" }}>{flagLabel(f, t)}</span>
      ))}
      {hasPos && !geoFlag && (
        <button type="button" className="btn ghost sm" title={t("Sjá á korti")} onClick={() => setMap(true)}><PinIcon />{t("Kort")}</button>
      )}
      {map && geo && <PunchMapModal geo={geo} title={title} onClose={() => setMap(false)} />}
    </>
  );
}

/** Where the employee clocked in/out, against the pinned workplaces. */
function PunchMapModal({ geo, title, onClose }: { geo: PunchGeo; title?: string; onClose: () => void }) {
  const { t } = useLang();
  const [sites, setSites] = useState<FenceSite[] | null>(null);
  useEffect(() => { getFenceSites().then(setSites); }, []);
  const points: GeoPoint[] = [];
  for (const k of ["in", "out"] as const) {
    const e = geo[k];
    if (e?.lat == null || e.lng == null) continue;
    const what = k === "in" ? t("Stimplaði inn") : t("Stimplaði út");
    points.push({ lat: e.lat, lng: e.lng, kind: e.verdict === "outside" ? "bad" : "ok", label: e.dist != null ? `${what} · ${distText(e.dist)} ${t("frá næsta stað")}` : what });
  }
  for (const s of sites ?? []) points.push({ lat: s.lat, lng: s.lng, kind: "site", label: s.name });
  const row = (k: "in" | "out") => {
    const e = geo[k];
    if (!e) return null;
    const label = k === "in" ? t("Inn") : t("Út");
    const text = e.verdict === "missing" ? t("engin staðsetning") : e.verdict === "outside" ? `${t("utan svæðis")} · ${distText(e.dist ?? 0)}` : `${t("á svæðinu")}${e.dist != null ? ` · ${distText(e.dist)}` : ""}`;
    return <div className="mr" key={k}><span>{label}</span><b style={{ color: e.verdict === "outside" ? "var(--bad)" : e.verdict === "missing" ? "var(--warn)" : "var(--good)" }}>{text}</b></div>;
  };
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{title ?? t("Staðsetning stimplunar")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {sites === null ? <div className="muted" style={{ height: 300, display: "grid", placeItems: "center" }}>{t("Hleð korti…")}</div>
            : <GeoMap height={300} points={points} circles={sites.map((s) => ({ lat: s.lat, lng: s.lng, radius: s.radius }))} />}
          <div className="mini" style={{ marginTop: 12 }}>{row("in")}{row("out")}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t("Appelsínugult = vinnustaður og radíus hans. Grænt = á svæðinu, rautt = utan.")}</div>
        </div>
      </div>
    </div>
  );
}

/** "08:00 – 02:15 (+1)" when a shift crossed midnight. */
export function spanText(p: Pick<PunchRow, "in" | "out" | "outDate" | "date">, openWord: string): string {
  const out = p.out ?? openWord;
  if (!p.out || !p.outDate) return `${p.in} – ${out}`;
  const days = Math.round((Date.parse(p.outDate) - Date.parse(p.date)) / 864e5);
  return `${p.in} – ${out} (+${days})`;
}
