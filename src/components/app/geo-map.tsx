"use client";

// Small map for geofencing: workplace pins with their radius circle, punch
// positions (green = inside, red = outside), and an optional click-to-pick.
// MapLibre + OpenFreeMap tiles (free, no key). maplibre-gl is loaded lazily so
// it only ships to the screens that open a map.

import { useEffect, useLayoutEffect, useRef } from "react";
import type { Map as MlMap, Marker as MlMarker, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type GeoPoint = { lat: number; lng: number; kind: "site" | "ok" | "bad"; label?: string };
export type GeoCircle = { lat: number; lng: number; radius: number };

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const REYKJAVIK: [number, number] = [-21.9426, 64.1466];
const COLOR = { site: "#e9700f", ok: "#1f9d57", bad: "#d64545" } as const;

/** Circle of `radius` metres as a GeoJSON ring (the map has no metric circle). */
function circleRing(c: GeoCircle, steps = 64): [number, number][] {
  const out: [number, number][] = [];
  const dLat = c.radius / 111320;
  const dLng = c.radius / (111320 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return out;
}

function circlesData(circles: GeoCircle[]) {
  return {
    type: "FeatureCollection" as const,
    features: circles.map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [circleRing(c)] } })),
  };
}

function dot(kind: GeoPoint["kind"]): HTMLElement {
  const el = document.createElement("div");
  const size = kind === "site" ? 16 : 14;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${COLOR[kind]};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
  return el;
}

export default function GeoMap({ points = [], circles = [], onPick, height = 260 }: {
  points?: GeoPoint[]; circles?: GeoCircle[]; onPick?: (lat: number, lng: number) => void; height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<MlMarker[]>([]);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const pickRef = useRef(onPick);
  const ready = useRef(false);
  const latest = useRef({ points, circles });
  useLayoutEffect(() => { pickRef.current = onPick; latest.current = { points, circles }; });

  function draw(fit: boolean) {
    const m = map.current, ml = lib.current;
    if (!m || !ml || !ready.current) return;
    const { points: pts, circles: cs } = latest.current;
    (m.getSource("fences") as GeoJSONSource | undefined)?.setData(circlesData(cs));
    markers.current.forEach((mk) => mk.remove());
    markers.current = pts.map((p) => {
      const mk = new ml.Marker({ element: dot(p.kind) }).setLngLat([p.lng, p.lat]);
      if (p.label) mk.setPopup(new ml.Popup({ offset: 12, closeButton: false }).setText(p.label));
      return mk.addTo(m);
    });
    if (!fit) return;
    const all: [number, number][] = [...pts.map((p) => [p.lng, p.lat] as [number, number]), ...cs.flatMap((c) => circleRing(c, 8))];
    if (all.length === 0) return;
    if (all.length === 1 || (pts.length <= 1 && cs.length === 0)) { m.jumpTo({ center: all[0], zoom: 15 }); return; }
    const b = new ml.LngLatBounds(all[0], all[0]);
    all.forEach((c) => b.extend(c));
    m.fitBounds(b, { padding: 40, maxZoom: 16, duration: 0 });
  }

  useEffect(() => {
    let dead = false;
    import("maplibre-gl").then((ml) => {
      if (dead || !box.current) return;
      lib.current = ml;
      const m = new ml.Map({ container: box.current, style: STYLE, center: REYKJAVIK, zoom: 11, attributionControl: { compact: true } });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        m.addSource("fences", { type: "geojson", data: circlesData([]) });
        m.addLayer({ id: "fence-fill", type: "fill", source: "fences", paint: { "fill-color": COLOR.site, "fill-opacity": 0.12 } });
        m.addLayer({ id: "fence-line", type: "line", source: "fences", paint: { "line-color": COLOR.site, "line-width": 2 } });
        ready.current = true;
        draw(true);
      });
      m.on("click", (e) => pickRef.current?.(e.lngLat.lat, e.lngLat.lng));
      map.current = m;
    });
    return () => { dead = true; map.current?.remove(); map.current = null; ready.current = false; };
  }, []);

  // Redraw on data change; refit only when the set of things changes size.
  const sig = `${points.length}:${circles.length}`;
  const lastSig = useRef(sig);
  useEffect(() => {
    const refit = lastSig.current !== sig;
    lastSig.current = sig;
    draw(refit);
  }, [points, circles, sig]);

  return <div ref={box} style={{ height, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", cursor: onPick ? "crosshair" : undefined }} />;
}
