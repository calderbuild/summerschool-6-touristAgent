"use client";

import { useEffect, useState } from "react";
import { APIProvider, APILoadingStatus, Map, useApiLoadingStatus, useMap } from "@vis.gl/react-google-maps";
import type { DemoRoute } from "@/lib/data";
import { statusHex } from "@/lib/status";
import { useI18n } from "@/lib/i18n";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

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
    //
    // Every leg gets a dark casing underneath first. Line colours are chosen by
    // the operator, not by us, and the pale ones (RER C and M1 yellow) vanish on
    // Google's light basemap without it.
    const CASING = "#1a1c22";
    for (let i = 0; i < nodes.length - 1; i++) {
      const leg = [nodes[i].coord, nodes[i + 1].coord];
      const ridden = nodes[i + 1].line;
      const unknown = nodes[i + 1].into?.status === "unknown";
      if (ridden && !unknown) {
        overlays.push(
          new google.maps.Polyline({
            path: leg,
            map,
            strokeColor: CASING,
            strokeOpacity: 0.5,
            strokeWeight: 9,
            zIndex: 1,
          }),
          new google.maps.Polyline({
            path: leg,
            map,
            strokeColor: ridden.color,
            strokeOpacity: 1,
            strokeWeight: 5,
            zIndex: 2,
          })
        );
      } else {
        const color = ridden ? ridden.color : "#6b7280";
        const dash = (stroke: string, scale: number, opacity: number, zIndex: number) =>
          new google.maps.Polyline({
            path: leg,
            map,
            strokeOpacity: 0,
            zIndex,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeColor: stroke, strokeOpacity: opacity, scale },
                offset: "0",
                repeat: "12px",
              },
            ],
          });
        overlays.push(dash(CASING, 4.6, 0.45, 1), dash(color, 3, 1, 2));
      }
    }

    const markers = nodes.map(
      (n, i) =>
        new google.maps.Marker({
          position: n.coord,
          map,
          title: n.name,
          // Google's own POI pins crowd the default basemap, so the stops have
          // to outweigh them: the route is what the traveller came here to read.
          zIndex: 10 + i,
          label: {
            text: String.fromCharCode(65 + i),
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: "700",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: statusHex(n.at),
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        })
    );

    const bounds = new google.maps.LatLngBounds();
    nodes.forEach((n) => bounds.extend(n.coord));
    const frame = () => map.fitBounds(bounds, 44);
    frame();

    // The card is sticky on desktop and swaps with the 3D view, so the map can
    // be measured before it has its final size. Without this the tile layer
    // keeps a stale offset and the route sits off-centre in a band of empty
    // canvas. Re-framing on resize also keeps the route in view on rotation.
    const host = map.getDiv();
    const ro = new ResizeObserver(frame);
    ro.observe(host);

    return () => {
      ro.disconnect();
      overlays.forEach((o) => o.setMap(null));
      markers.forEach((m) => m.setMap(null));
    };
  }, [map, route]);

  return null;
}

function Notice({ children, dashed = false }: { children: string; dashed?: boolean }) {
  return (
    <div
      className={`grid h-full min-h-[220px] place-items-center rounded-xl border bg-ink/[0.03] p-6 text-center text-[13px] leading-snug text-ink-soft ${
        dashed ? "border-dashed border-ink/25" : "border-ink/10"
      }`}
    >
      {children}
    </div>
  );
}

/** Watches the Maps script rather than assuming it arrives.
 *
 *  A key can be present and still be refused: the wrong HTTP referrer
 *  restriction, an exhausted quota, or a privacy extension that blocks
 *  maps.googleapis.com all end with an empty grey box and no explanation. That
 *  is the worst thing to be looking at during a pitch, because it reads as "the
 *  route is broken" when the route is fine. So the failure gets said out loud,
 *  and it says which half failed. */
function LoadGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const status = useApiLoadingStatus();
  const [slow, setSlow] = useState(false);
  const [rejected, setRejected] = useState(false);

  // A rejected key does not fail the script load, so the library's status stays
  // LOADED and only Google knows. It reports it by calling this global, which
  // nothing installs by default. This is the path a referrer restriction takes:
  // add the wrong domain to the key and every map silently becomes Google's own
  // grey apology box, with nothing from us explaining that the route is fine.
  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      setRejected(true);
      previous?.();
    };
    return () => {
      window.gm_authFailure = previous;
    };
  }, []);

  const failed =
    rejected || status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE;
  const pending = status === APILoadingStatus.NOT_LOADED || status === APILoadingStatus.LOADING;

  // A blocked script fires an error and lands on FAILED, but a stalled network
  // just stays LOADING forever, which looks identical to a working map that has
  // not painted yet. After ten seconds, say so.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (failed) return <Notice>{t("map_failed")}</Notice>;

  return (
    <>
      {children}
      {pending && slow && (
        <p role="status" className="absolute inset-x-0 bottom-0 bg-paper/90 px-3 py-1.5 text-center text-[12px] text-ink-soft">
          {t("map_slow")}
        </p>
      )}
    </>
  );
}

export default function RouteMap({ route }: { route: DemoRoute }) {
  const { t } = useI18n();

  if (!KEY) return <Notice dashed>{t("map_missing")}</Notice>;

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-xl border border-ink/10"
      // Not role="img": the zoom control and the map canvas itself are focusable,
      // and an image role would hide them from a screen reader while leaving them
      // in the tab order.
      role="group"
      aria-label={`${t("route_map_label")}: ${route.from} → ${route.to}`}
    >
      <APIProvider apiKey={KEY}>
        <LoadGuard>
          <Map
            defaultCenter={{ lat: 48.858, lng: 2.34 }}
            defaultZoom={12}
            // Scrolling the page over a map must scroll the page, so zooming here
            // is the controls, a pinch, or the fullscreen button. Taking the wheel
            // ("greedy") traps anyone reading past the map on a phone.
            gestureHandling="cooperative"
            disableDefaultUI
            zoomControl
            fullscreenControl
            className="h-full w-full"
          >
            <RouteOverlay route={route} />
          </Map>
        </LoadGuard>
      </APIProvider>
    </div>
  );
}
