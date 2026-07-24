"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteNode } from "@/lib/data";
import { statusHex } from "@/lib/status";
import { useI18n } from "@/lib/i18n";

// A tilted 3D Paris in daylight. Free + keyless: OpenFreeMap vector tiles
// (OpenMapTiles schema) + a hand-built light style with extruded limestone
// buildings, tuned to sit calmly beside the limestone-paper UI rather than a
// generic Google basemap.
const PARIS_STYLE = {
  version: 8 as const,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    omt: { type: "vector" as const, url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "bg", type: "background" as const, paint: { "background-color": "#eef0ec" } },
    { id: "water", type: "fill" as const, source: "omt", "source-layer": "water", paint: { "fill-color": "#bcd4e6" } },
    {
      id: "green",
      type: "fill" as const,
      source: "omt",
      "source-layer": "park",
      paint: { "fill-color": "#d6e3cb", "fill-opacity": 0.7 },
    },
    {
      id: "roads",
      type: "line" as const,
      source: "omt",
      "source-layer": "transportation",
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 16, 2.4] as unknown as number,
      },
    },
    {
      id: "building-3d",
      type: "fill-extrusion" as const,
      source: "omt",
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "render_height"],
          0,
          "#e4e0d6",
          40,
          "#d8d2c4",
          160,
          "#c7bfae",
        ] as unknown as string,
        "fill-extrusion-height": ["get", "render_height"] as unknown as number,
        "fill-extrusion-base": ["get", "render_min_height"] as unknown as number,
        "fill-extrusion-opacity": 0.92,
      },
    },
    {
      id: "place-labels",
      type: "symbol" as const,
      source: "omt",
      "source-layer": "place",
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]] as unknown as string,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 13] as unknown as number,
      },
      paint: { "text-color": "#3f4650", "text-halo-color": "#f3f1ec", "text-halo-width": 1.4 },
    },
  ],
};

function segmentColor(node: RouteNode | undefined): string {
  return node?.line?.color ?? "#6b7683"; // walking legs (no line) render neutral
}

export default function MetroMap({ nodes, className }: { nodes: RouteNode[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current || nodes.length === 0) return;
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    // Flipped once the style and first frame are up, so a later tile error can
    // be told apart from a map that never came alive at all.
    let drawn = false;
    const markers: import("maplibre-gl").Marker[] = [];

    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !ref.current) return;

        const lats = nodes.map((n) => n.coord.lat);
        const lngs = nodes.map((n) => n.coord.lng);
        const bounds: [[number, number], [number, number]] = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ];

        map = new maplibregl.Map({
          container: ref.current,
          style: PARIS_STYLE as never,
          bounds,
          fitBoundsOptions: { padding: 64, pitch: 52, bearing: -18, maxZoom: 15 },
          pitch: 52,
          bearing: -18,
          attributionControl: { compact: true },
          dragRotate: true,
        });
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

        map.on("load", () => {
          if (!map) return;
          drawn = true;
          // Route drawn as per-line coloured segments, plus a soft glow underneath.
          const features = nodes.slice(1).map((node, i) => ({
            type: "Feature" as const,
            properties: { color: segmentColor(node) },
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [nodes[i].coord.lng, nodes[i].coord.lat],
                [node.coord.lng, node.coord.lat],
              ],
            },
          }));
          map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features } });
          map.addLayer({
            id: "route-glow",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": ["get", "color"], "line-width": 11, "line-opacity": 0.22, "line-blur": 6 },
          });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": ["get", "color"], "line-width": 4.5 },
          });

          // Station markers: status-coloured disc + letter, the app's own vocabulary.
          nodes.forEach((node, i) => {
            const el = document.createElement("div");
            el.style.cssText = `width:26px;height:26px;border-radius:9999px;display:grid;place-items:center;font:700 12px/1 var(--ff-mono),monospace;color:#fff;text-shadow:0 1px 2px rgba(26,28,34,.45);background:${statusHex(
              node.at
            )};box-shadow:0 0 0 3px #ffffff,0 0 0 4px rgba(26,28,34,.12),0 2px 6px rgba(26,28,34,.28);`;
            el.textContent = String.fromCharCode(65 + i);
            const marker = new maplibregl!.Marker({ element: el }).setLngLat([node.coord.lng, node.coord.lat]).addTo(map!);
            markers.push(marker);
          });
        });

        map.on("error", () => {
          // One tile that fails to arrive is not a broken map. Only an error
          // before the first render is fatal; otherwise a single hiccup would
          // cover a perfectly good 3D view for the rest of the session.
          if (!cancelled && !drawn) setFailed(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      map?.remove();
    };
  }, [nodes]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {/* Not role="img": the pan/zoom controls live inside, and an image role
          would hide them from a screen reader while leaving them tabbable. */}
      <div ref={ref} className="h-full w-full" aria-label={t("route_map_label")} role="group" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-surface px-6 text-center text-[13px] leading-relaxed text-ink-soft">
          {t("map_3d_failed")}
        </div>
      )}
    </div>
  );
}
