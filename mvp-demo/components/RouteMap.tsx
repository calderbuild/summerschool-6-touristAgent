"use client";

import { useEffect } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import type { DemoRoute } from "@/lib/data";
import { statusHex } from "@/lib/status";
import { useI18n } from "@/lib/i18n";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function RouteOverlay({ route }: { route: DemoRoute }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const nodes = route.nodes;
    const overlays: google.maps.Polyline[] = [];

    // One segment per leg, coloured by the transit line ridden into the next
    // stop (M14 purple, RER C yellow, ...); dashed grey for a walking leg and
    // dashed in the line colour when that leg's accessibility status is unknown,
    // so the map speaks the same honesty language as the spine.
    for (let i = 0; i < nodes.length - 1; i++) {
      const leg = [nodes[i].coord, nodes[i + 1].coord];
      const ridden = nodes[i + 1].line;
      const unknown = nodes[i + 1].into?.status === "unknown";
      if (ridden && !unknown) {
        overlays.push(
          new google.maps.Polyline({
            path: leg,
            map,
            strokeColor: ridden.color,
            strokeOpacity: 0.95,
            strokeWeight: 5,
          })
        );
      } else {
        const color = ridden ? ridden.color : "#6b7280";
        overlays.push(
          new google.maps.Polyline({
            path: leg,
            map,
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeColor: color, strokeOpacity: 1, scale: 3 },
                offset: "0",
                repeat: "12px",
              },
            ],
          })
        );
      }
    }

    const markers = nodes.map(
      (n, i) =>
        new google.maps.Marker({
          position: n.coord,
          map,
          title: n.name,
          label: {
            text: String.fromCharCode(65 + i),
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: "700",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: statusHex(n.at),
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2.5,
          },
        })
    );

    const bounds = new google.maps.LatLngBounds();
    nodes.forEach((n) => bounds.extend(n.coord));
    map.fitBounds(bounds, 56);

    return () => {
      overlays.forEach((o) => o.setMap(null));
      markers.forEach((m) => m.setMap(null));
    };
  }, [map, route]);

  return null;
}

export default function RouteMap({ route }: { route: DemoRoute }) {
  const { t } = useI18n();

  if (!KEY) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-ink/25 bg-ink/[0.03] p-6 text-center text-[13px] leading-snug text-ink-soft">
        {t("map_missing")}
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-hidden rounded-xl border border-ink/10"
      role="img"
      aria-label={`${t("route_map_label")}: ${route.from} → ${route.to}`}
    >
      <APIProvider apiKey={KEY}>
        <Map
          defaultCenter={{ lat: 48.858, lng: 2.34 }}
          defaultZoom={12}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          className="h-full w-full"
        >
          <RouteOverlay route={route} />
        </Map>
      </APIProvider>
    </div>
  );
}
