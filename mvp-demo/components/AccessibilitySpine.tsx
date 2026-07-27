"use client";

import { useI18n } from "@/lib/i18n";
import type { DemoRoute, RouteNode, Status } from "@/lib/data";
import { statusColorVar, isUnknown, lineTextColor } from "@/lib/status";
import { ACCESS_LEVELS, findStation, toiletsAt } from "@/lib/idfm";
import { useNetworkFacts } from "@/lib/useNetwork";
import {
  Check,
  MoveVertical,
  TriangleAlert,
  CircleHelp,
  Footprints,
  Accessibility,
  CornerDownRight,
} from "lucide-react";

function NodeGlyph({ status }: { status: Status }) {
  const p = { size: 15, strokeWidth: 2.4, "aria-hidden": true } as const;
  if (status === "ok") return <Check {...p} />;
  if (status === "lift") return <MoveVertical {...p} />;
  if (status === "conditional") return <Accessibility {...p} />;
  if (status === "unknown") return <CircleHelp {...p} />;
  return <TriangleAlert {...p} />;
}

function LineBadge({ line }: { line: NonNullable<RouteNode["line"]> }) {
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none"
      style={{ backgroundColor: line.color, color: lineTextColor(line.color) }}
    >
      {line.label}
    </span>
  );
}

/** Vertical connector between dots; dashed when the segment status is unknown. */
function Connector({ status }: { status?: Status }) {
  if (!status) return <div className="w-[3px] flex-1" aria-hidden />;
  const unknown = isUnknown(status);
  return (
    <div
      className="w-[3px] flex-1"
      aria-hidden
      style={
        unknown
          ? {
              backgroundImage:
                "repeating-linear-gradient(var(--color-unknown) 0 5px, transparent 5px 11px)",
            }
          : { backgroundColor: statusColorVar(status) }
      }
    />
  );
}

/**
 * What Île-de-France Mobilités says about this stop, next to what we say.
 *
 * This is the difference between a project that claims to use open data and one
 * that shows it: the class comes from the operator's own published register at
 * page load, in their words, and where they qualify it per line (Châtelet's RER A
 * and B are staff-conditional while the D is not accessible at all) that sentence
 * is theirs too. A stop they do not list says so rather than borrowing a
 * neighbour's class, because their register covers RER and rail, not the métro.
 */
function OfficialRecord({ name }: { name: string }) {
  const { t, lang } = useI18n();
  const { facts, state } = useNetworkFacts();

  if (state === "loading") return null;
  if (state === "unavailable") {
    return <p className="mt-2 text-[12px] leading-snug text-ink-faint">{t("official_unavailable")}</p>;
  }

  const record = findStation(facts, name);
  const toilets = toiletsAt(facts, name);

  return (
    <div className="mt-2.5 border-l-2 border-ink/12 pl-2.5">
      <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
        {t("official_label")} · {t("official_source")}
      </p>
      {record ? (
        <>
          <p className="mt-1 text-[13px] leading-snug text-ink">{ACCESS_LEVELS[record.level]?.[lang] ?? record.levelFr}</p>
          {/* Their French, verbatim, under our gloss: the gloss is a translation
              and a translation is an interpretation. */}
          {lang !== "fr" && record.levelFr && (
            <p className="mt-0.5 text-[12px] italic leading-snug text-ink-soft">{record.levelFr}</p>
          )}
          {record.note && <p className="mt-1 text-[12px] leading-snug text-ink-soft">{record.note}</p>}
        </>
      ) : (
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">{t("official_missing")}</p>
      )}
      {toilets.map((wc, i) => (
        <p key={i} className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-ok-ink">
          <Accessibility size={13} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            {t("wc_label")}
            {wc.line && ` (${wc.line})`}
            {wc.free !== null && `, ${wc.free ? t("wc_free") : t("wc_paid")}`}
            {wc.insideGates !== null && `, ${wc.insideGates ? t("wc_inside") : t("wc_outside")}`}
            {wc.where && `. ${wc.where}`}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function AccessibilitySpine({ route }: { route: DemoRoute }) {
  const { t, lang } = useI18n();

  return (
    <ol className="mt-1">
      {route.nodes.map((node, i) => {
        const topInto = node.into?.status;
        const bottomInto = route.nodes[i + 1]?.into?.status;
        const color = statusColorVar(node.at);

        return (
          <li key={i} className="flex gap-3">
            {/* rail */}
            <div className="flex w-7 shrink-0 flex-col items-center self-stretch">
              <Connector status={i === 0 ? undefined : topInto} />
              <span
                className="my-1 grid h-7 w-7 place-items-center rounded-full border-[3px] bg-canvas"
                style={{ borderColor: color, color }}
              >
                <NodeGlyph status={node.at} />
              </span>
              <Connector status={bottomInto} />
            </div>

            {/* content */}
            <div className="min-w-0 flex-1 pb-7">
              {/* arriving segment */}
              {node.into && (
                <p className="mb-2 flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
                  {node.line ? (
                    <LineBadge line={node.line} />
                  ) : (
                    <Footprints size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-ink/50" aria-hidden />
                  )}
                  <span>{node.into.text[lang]}</span>
                </p>
              )}

              {/* station / place name, lettered to match the map marker */}
              <h3 className="flex items-center gap-2 font-display text-[17px] font-semibold leading-tight text-ink">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-ink"
                  aria-hidden
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {node.name}
              </h3>

              {/* status note at this node, glyph carries the hue, text stays readable */}
              <p className="mt-1 flex items-start gap-1.5 text-[13.5px] leading-snug text-ink-soft">
                <span className="mt-0.5 shrink-0" style={{ color }}>
                  <NodeGlyph status={node.at} />
                </span>
                <span>{node.atText[lang]}</span>
              </p>

              {/* facts row: steps / walk / restroom */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {node.steps === null && (
                  <span className="inline-flex items-center gap-1 rounded border border-unknown/40 bg-unknown/5 px-2 py-0.5 font-mono text-[11px] text-unknown">
                    <span className="hatch-unknown inline-block h-2.5 w-2.5 rounded-[2px]" aria-hidden />
                    {t("steps_unknown")}
                  </span>
                )}
                {typeof node.steps === "number" && node.steps > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-barrier/10 px-2 py-0.5 font-mono text-[11px] font-bold text-barrier">
                    {node.steps} {t("steps_unit")}
                  </span>
                )}
                {node.walkM && (
                  <span className="inline-flex items-center gap-1 rounded bg-ink/5 px-2 py-0.5 font-mono text-[11px] text-ink/70">
                    <Footprints size={12} strokeWidth={2} aria-hidden /> {node.walkM} m {t("walk_label")}
                  </span>
                )}
                {node.restroom && (
                  <span className="inline-flex items-center gap-1 rounded bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok-ink">
                    <Accessibility size={13} strokeWidth={2} aria-hidden /> {t("restroom_ok")}
                  </span>
                )}
              </div>

              <OfficialRecord name={node.name} />

              {/* barrier + step-free alternative */}
              {node.barrier && (
                <div className="mt-2.5 rounded-lg border border-barrier/25 bg-barrier/5 p-3">
                  <p className="flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-barrier">
                    <TriangleAlert size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      <span className="uppercase tracking-wide text-[11px]">{t("barrier_label")}</span>
                      <br />
                      {node.barrier[lang]}
                    </span>
                  </p>
                  {node.alt && (
                    <p className="mt-2 flex items-start gap-1.5 border-t border-ok/20 pt-2 text-[13px] leading-snug text-ok-ink">
                      <CornerDownRight size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        <span className="font-semibold">{t("alt_label")}: </span>
                        {node.alt[lang]}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
