"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, useApiLoadingStatus, APILoadingStatus } from "@vis.gl/react-google-maps";
import { CalendarClock, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * A look at the door before you travel to it.
 *
 * This is the immersive piece, and it is pointed at the same question as the rest of
 * the product: a register can tell you a venue is "partially accessible", but only a
 * photograph tells you there are six steps and a handrail on the left. For somebody
 * who cannot take stairs, seeing the entrance is worth more than another adjective.
 *
 * Which is exactly why the capture date is not a footnote here. Street View imagery
 * of these sights ranges from 2007 to 2017: Sacre-Coeur's is nineteen years old.
 * Presenting a 2007 photograph as "the entrance" would be an undated claim about
 * what somebody will meet tomorrow, which is the failure this whole product exists
 * to avoid. So the date is stamped on the image, and anything older than three years
 * carries a warning in its own right rather than a caveat somewhere below.
 *
 * Not every sight has imagery, and the guard against showing the wrong doorway is
 * distance rather than a source filter. The first version asked only for OUTDOOR
 * coverage, which is the official car, and reported that the Louvre had nothing:
 * there is in fact a panorama standing exactly on its coordinates, dated July 2018,
 * that the filter was hiding. So it asks for the car first, falls back to any
 * imagery at the same spot, and then measures how far the panorama it got actually
 * is from the sight. Anything beyond a short walk is discarded and reported as no
 * imagery, because a view of the next street is a picture of a different door.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** Older than this and the doorway may simply have been rebuilt since. */
const STALE_AFTER_YEARS = 3;

/** How far the panorama may stand from the sight before it is a different place. */
const MAX_METRES = 120;
const SEARCH_RADIUS = 90;

/** Metres between two points, so the check does not need the geometry library. */
function metresBetween(a: google.maps.LatLng, lat: number, lng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(a.lat() - lat);
  const dLng = toRad(a.lng() - lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(a.lat())) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; date: string | null }
  | { kind: "none" }
  | { kind: "failed" };

function Panorama({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const { t, lang } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status !== APILoadingStatus.LOADED || !host.current) return;
    let cancelled = false;
    const el = host.current;

    const svc = new google.maps.StreetViewService();
    const at = { location: { lat, lng }, radius: SEARCH_RADIUS };
    // The official car first, because its imagery looks along the pavement somebody
    // will actually arrive on. Anything else at the same spot is better than nothing.
    svc
      .getPanorama({ ...at, source: google.maps.StreetViewSource.OUTDOOR })
      .catch(() => svc.getPanorama({ ...at, source: google.maps.StreetViewSource.DEFAULT }))
      .then(({ data }) => {
        if (cancelled) return;
        const here = data.location?.latLng;
        if (here && metresBetween(here, lat, lng) > MAX_METRES) {
          setState({ kind: "none" });
          return;
        }
        new google.maps.StreetViewPanorama(el, {
          pano: data.location?.pano,
          // Pointed at the building rather than down the street, and zoomed out
          // enough to show the whole frontage including its steps.
          pov: { heading: data.tiles?.centerHeading ?? 0, pitch: 0 },
          zoom: 0,
          addressControl: false,
          fullscreenControl: true,
          motionTracking: false,
          motionTrackingControl: false,
          // Leaving the arrows on: walking a few metres along the pavement is how
          // somebody finds the accessible entrance when it is not the main one.
          linksControl: true,
        });
        setState({ kind: "ready", date: data.imageDate ?? null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // ZERO_RESULTS is a fact about the world, not a fault: say there is no
        // imagery here rather than showing a view of somewhere else.
        setState({ kind: /ZERO_RESULTS/.test(String(err)) ? "none" : "failed" });
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, status]);

  if (status === APILoadingStatus.FAILED || state.kind === "failed") {
    return <Note icon="off" text={t("street_failed")} />;
  }
  if (state.kind === "none") {
    return <Note icon="off" text={t("street_none")} />;
  }

  const year = state.kind === "ready" && state.date ? Number(state.date.slice(0, 4)) : null;
  const stale = year !== null && new Date().getFullYear() - year > STALE_AFTER_YEARS;
  const when =
    state.kind === "ready" && state.date
      ? new Date(`${state.date}-01T00:00:00Z`).toLocaleDateString(lang === "zh" ? "zh-CN" : lang, {
          year: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : null;

  return (
    <figure className="m-0">
      <div
        ref={host}
        role="img"
        aria-label={t("street_alt").replace("{place}", label)}
        className="h-[260px] w-full overflow-hidden rounded-xl bg-ink/[0.06] sm:h-[320px]"
      />
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {when && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] font-bold ${
              stale ? "bg-caution/15 text-caution-ink" : "bg-ink/[0.06] text-ink-soft"
            }`}
          >
            <CalendarClock size={12} strokeWidth={2.4} aria-hidden />
            {t("street_dated").replace("{when}", when)}
          </span>
        )}
        <span className="text-[12px] leading-snug text-ink-soft">
          {stale ? t("street_stale") : t("street_caveat")}
        </span>
      </figcaption>
    </figure>
  );
}

function Note({ text }: { icon: "off"; text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-ink/[0.04] px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">
      <EyeOff size={15} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

export default function StreetLook({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const { t } = useI18n();
  if (!KEY) return <Note icon="off" text={t("street_nokey")} />;
  return (
    <APIProvider apiKey={KEY}>
      <Panorama lat={lat} lng={lng} label={label} />
    </APIProvider>
  );
}
