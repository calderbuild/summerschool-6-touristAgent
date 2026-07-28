"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, TriangleAlert } from "lucide-react";

/**
 * One live fact, on the empty side of a desktop screen.
 *
 * The home screen was one 768px column, so on a wide monitor two thirds of the
 * viewport was blank paper. Filling it with a wider column of the same text would
 * have missed the point: a first-time visitor's real question is whether this
 * thing is reading Paris or describing it, and the answer is data, not prose.
 *
 * It carries exactly one claim: how many lifts the operator itself says are
 * broken. The first attempt put three here (weather, this count, and the 59.6%
 * stairway measurement) and that was the same mistake in a new place. This screen
 * already asks a visitor for a profile and offers three example questions; a
 * column of competing statistics beside that is noise, and the reader cannot tell
 * which number is the point. The stairway measurement lives on /how-it-works with
 * the rest of the provenance, one click away, where a reader who wants it is
 * actually looking for it.
 *
 * On a phone the grid collapses and this lands below the example prompts, which is
 * correct: the fastest route to a first answer stays above it, and the evidence is
 * there for anyone who scrolls to ask why they should believe it.
 *
 * When the feed is unreadable it says so rather than disappearing. A blank space
 * reads as "no lift is broken", which is the one thing it must never imply.
 */

interface Lift {
  station: string;
  situation: string | null;
  updatedAt: string | null;
  liftId: string;
}

interface Payload {
  live: boolean;
  count: number;
  classified: { working: number; out: number; unknown: number };
  out: Lift[];
}

/**
 * One row per station, newest report first.
 *
 * The endpoint returns one row per lift in alphabetical order, and both of those
 * were wrong here. Alphabetical put the airport at the top of a list a visitor to
 * central Paris reads, and per-lift meant Bagneux appeared twice in four rows and
 * read as a rendering bug rather than as two broken lifts. Recency is the one
 * ordering that is a fact about the data rather than a judgement about whose
 * journey matters: the operator stamps each record, so newest first is "what has
 * just been reported".
 */
function byStation(out: Lift[]): { station: string; situation: string | null; n: number; at: number }[] {
  const groups = new Map<string, { station: string; situation: string | null; n: number; at: number }>();
  for (const l of out) {
    const at = l.updatedAt ? new Date(l.updatedAt).valueOf() : 0;
    const hit = groups.get(l.station);
    if (!hit) {
      groups.set(l.station, { station: l.station, situation: l.situation, n: 1, at });
      continue;
    }
    hit.n += 1;
    // Keep the wording of the most recently reported lift, so the line and the
    // timestamp describe the same record.
    if (at > hit.at) {
      hit.at = at;
      hit.situation = l.situation;
    }
  }
  return [...groups.values()].sort((a, b) => b.at - a.at || a.station.localeCompare(b.station, "fr"));
}

const SHOWN = 3;

export default function LiveRail() {
  const { t } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/lifts")
      .then((r) => r.json())
      .then((d: Payload) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const dark = failed || (data !== null && !data.live);
  const stations = data?.live ? byStation(data.out) : [];

  return (
    <aside aria-labelledby="live-rail" className="mt-8 lg:mt-0">
      <div className="lg:sticky lg:top-6">
        <p
          id="live-rail"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint"
        >
          {t("rail_title")}
        </p>

        <div className="mt-3 rounded-2xl border border-ink/10 bg-surface p-4">
          {data === null && !failed ? (
            <p className="text-[12.5px] leading-relaxed text-ink-soft">{t("lift_checking")}</p>
          ) : dark ? (
            <div className="flex items-start gap-2">
              <TriangleAlert
                size={16}
                strokeWidth={2.2}
                aria-hidden
                className="mt-0.5 shrink-0 text-caution-ink"
              />
              <p className="text-[12.5px] leading-relaxed text-ink-soft">{t("lift_dark_body")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[38px] font-extrabold leading-none tracking-tight text-barrier-ink tabular-nums">
                  {data!.classified.out}
                </span>
                <span className="text-[12.5px] leading-snug text-ink-soft">{t("rail_out_label")}</span>
              </div>

              {/* Named, not just counted. A number alone is a statistic; a station
                  with the operator's own wording for where in it the lift sits is
                  a thing a traveller can act on. The cap is stated rather than
                  silent: a truncated list that looks complete is the shape of
                  every misleading summary. */}
              {stations.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-3">
                  {stations.slice(0, SHOWN).map((g) => (
                    <li key={g.station} className="text-[12px] leading-snug text-ink-soft">
                      <span className="font-semibold text-ink">{g.station}</span>
                      {g.n > 1 ? <span className="text-ink-faint"> · {g.n}</span> : null}
                      {g.situation ? (
                        <span className="block truncate font-mono text-[10.5px] text-ink-faint">
                          {g.situation}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {stations.length > SHOWN && (
                    <li className="pt-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                      {t("rail_more_1")} {stations.length - SHOWN} {t("rail_more_2")}
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>

        {/* One door, not four. The rail explains a claim, so it links to where the
            claim is backed up and nowhere else. */}
        <Link
          href="/how-it-works"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-signal transition-colors hover:text-ink"
        >
          {t("rail_link")}
          <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
