"use client";

import { useEffect, useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { CircleDot, CircleSlash } from "lucide-react";

/**
 * Whether this app can currently see lift state, said out loud on the page.
 *
 * It reads the live endpoint rather than a build-time constant, which is why the
 * line flipped by itself on the evening the dataset token arrived: for most of the
 * week it said "not available to this app", because that was the true state and a
 * page which simply omitted the topic would have let a reader assume the better of
 * the two readings. Not a line of this component changed when the data started
 * flowing. That is the point of asking instead of asserting.
 *
 * The number it leads with now is the count of lifts the operator itself reports
 * out of service, because that is the only figure on this site that can be
 * different in ten minutes.
 */

/**
 * A counted sentence, glued the way the language wants.
 *
 * The three counts sit between four fragments, and the two scripts space them
 * differently: French and English want a space between every piece, Chinese
 * carries its own spacing and punctuation inside the fragments so that a comma
 * never ends up preceded by a gap.
 */
function join(lang: Lang, parts: (string | number)[]): string {
  const glue = lang === "zh" ? "" : " ";
  return parts
    .map(String)
    .filter((s) => s !== "")
    .join(glue)
    .trim();
}

interface Payload {
  live: boolean;
  configured: boolean;
  count: number;
  classified: { working: number; out: number; unknown: number };
  seenStatuses: Record<string, number>;
}

export default function LiftStatusLine() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/lifts")
      .then((r) => r.json())
      .then((d: Payload) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return null;

  return (
    <div
      className="mt-3 flex items-start gap-2.5 rounded-2xl border border-caution/35 bg-caution/8 p-4"
      role="status"
    >
      {data?.live ? (
        <CircleDot size={17} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0 text-ok-ink" />
      ) : (
        <CircleSlash size={17} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0 text-caution-ink" />
      )}
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-snug text-ink">
          {data?.live ? t("lift_live_title") : t("lift_dark_title")}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          {data === null
            ? t("lift_checking")
            : data.live
              ? join(lang, [
                  t("lift_live_pre"),
                  data.count,
                  t("lift_live_mid_1"),
                  data.classified.out,
                  t("lift_live_mid_2"),
                  data.classified.unknown,
                  t("lift_live_suffix"),
                ])
              : t("lift_dark_body")}
        </p>
      </div>
    </div>
  );
}
