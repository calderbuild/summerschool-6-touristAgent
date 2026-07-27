"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CircleDot, CircleSlash } from "lucide-react";

/**
 * Whether this app can currently see lift state, said out loud on the page.
 *
 * The gap it reports is the project's one real hole: `etat-des-ascenseurs` needs
 * a registered token, and without it the honest answer is "we cannot see the
 * lifts", which is a different sentence from "no lift is broken". A page that
 * simply omitted the topic would let a reader assume the better of the two.
 *
 * It reads the live endpoint rather than a build-time constant, so the line
 * changes by itself the moment a token is configured. Nothing here is a
 * placeholder waiting to be swapped for real data: the "not available" state IS
 * the real state today, and it is reported by asking.
 */

interface Payload {
  live: boolean;
  configured: boolean;
  count: number;
  classified: { working: number; out: number; unknown: number };
  seenStatuses: Record<string, number>;
}

export default function LiftStatusLine() {
  const { t } = useI18n();
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

  const known = data?.live
    ? data.classified.working + data.classified.out
    : 0;

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
              ? `${t("lift_live_body_1")} ${data.count} ${t("lift_live_body_2")} ${known} ${t("lift_live_body_3")}`
              : t("lift_dark_body")}
        </p>
      </div>
    </div>
  );
}
