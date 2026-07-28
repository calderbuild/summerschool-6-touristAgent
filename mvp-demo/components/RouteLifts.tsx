"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { stationKey } from "@/lib/idfm";
import { TriangleAlert } from "lucide-react";

/**
 * The lifts the operator says are broken, on this journey, right now.
 *
 * This is the one thing on the page that can be different ten minutes from now,
 * and it is the reason the whole product exists: a route that is step-free on
 * paper is not step-free tonight if the lift between the concourse and the
 * platform is out. The verdict above cannot see it, which is the same defect this
 * repo has hit three times: a summary computed from a subset of the journey's
 * fields is blind to every field the journey later gains. So this is its own
 * block, deliberately not folded into that sentence.
 *
 * It fetches rather than receives, because `/api/plan` is cached for a day (the
 * graph only changes when the build script runs) and lift state is minutes old.
 * Two different lifetimes, so two different requests.
 *
 * When nothing is broken it renders nothing at all. That is not the same as
 * saying every lift works, and the page never says that: `LiftStatusLine` on
 * /how-it-works carries the counts, including the lifts the operator itself
 * publishes no verdict on.
 */

interface Lift {
  station: string;
  lat: number | null;
  lng: number | null;
  liftId: string;
  status: "working" | "out" | "unknown";
  reason: string | null;
  situation: string | null;
  updatedAt: string | null;
}

/** The same threshold, the same two conditions and the same normaliser as
 *  `liftsAt` on the server: a name alone matches the wrong station and a
 *  coordinate alone matches the one across the street. `stationKey` is imported
 *  rather than reimplemented because it strips stop words ("gare", "de", "les")
 *  that a hand-rolled copy would not, and the two would then disagree about which
 *  lifts are on the journey: the model's prompt would name one the card does not
 *  show. */
const MATCH_M = 250;

function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const mid = ((aLat + bLat) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(mid);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

export default function RouteLifts({
  stops,
}: {
  /** The stations this journey actually calls at, in order. */
  stops: { name: string; lat: number; lng: number }[];
}) {
  const { t, lang } = useI18n();
  const [lifts, setLifts] = useState<Lift[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/lifts")
      .then((r) => r.json())
      .then((d: { live?: boolean; out?: Lift[] }) => {
        if (alive) setLifts(d.live && Array.isArray(d.out) ? d.out : []);
      })
      // A failed fetch renders nothing rather than an empty reassurance.
      .catch(() => alive && setLifts([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!lifts || lifts.length === 0) return null;

  const hits = stops.flatMap((s) => {
    const key = stationKey(s.name);
    return lifts
      .filter((l) => {
        if (l.lat === null || l.lng === null) return false;
        if (metres(s.lat, s.lng, l.lat, l.lng) > MATCH_M) return false;
        const lk = stationKey(l.station);
        return lk === key || lk.startsWith(key) || key.startsWith(lk);
      })
      .map((l) => ({ stop: s.name, lift: l }));
  });

  if (hits.length === 0) return null;

  return (
    <div
      className="mt-3 flex items-start gap-2.5 rounded-2xl border border-barrier/40 bg-barrier/8 p-4"
      role="status"
    >
      <TriangleAlert size={17} strokeWidth={2.3} aria-hidden className="mt-0.5 shrink-0 text-barrier-ink" />
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-snug text-ink">
          {hits.length} {t(hits.length === 1 ? "route_lift_out_one" : "route_lift_out_many")}
        </p>
        <ul className="mt-1.5 space-y-1">
          {hits.map(({ stop, lift }) => (
            <li key={`${stop}-${lift.liftId}`} className="text-[12.5px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">{stop}</span>
              {lift.situation ? <span className="font-mono text-[11.5px]"> · {lift.situation}</span> : null}
              {lift.updatedAt ? (
                <span className="text-ink-faint">
                  {" "}
                  · {t("route_lift_updated")}{" "}
                  {new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : lang === "fr" ? "fr-FR" : "en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(lift.updatedAt))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{t("route_lift_note")}</p>
      </div>
    </div>
  );
}
