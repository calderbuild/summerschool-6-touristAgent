"use client";

import { memo, useState } from "react";
import { ROUTES, type RouteNode } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import AccessRibbon from "./AccessRibbon";
import RouteMap from "../RouteMap";
import { statusColorVar, legendKey } from "@/lib/status";
import {
  TriangleAlert,
  CornerDownRight,
  CircleHelp,
  Check,
  Accessibility,
  Baby,
  PersonStanding,
  BatteryLow,
  Map as MapIcon,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

/**
 * Inline route summary for a chat answer (from a [[route:id]] marker). It leads
 * with the accessibility verdict + the barrier and its step-free workaround,
 * the part Google Maps cannot produce, then a compact diagram, then a demoted
 * per-stop list, then the data sources. The full spine lives at /routes.
 */

const PROFILE_ICON: Record<string, LucideIcon> = {
  wheelchair: Accessibility,
  stroller: Baby,
  senior: PersonStanding,
  lowenergy: BatteryLow,
};
const PROFILE_LABEL: Record<string, string> = {
  wheelchair: "profile_wheelchair",
  stroller: "profile_stroller",
  senior: "profile_senior",
  lowenergy: "profile_lowenergy",
};

function statusLabel(t: (k: string) => string, n: RouteNode): string {
  const base = t(legendKey[n.at]);
  if (typeof n.steps === "number" && n.steps > 0) return `${base} · ${n.steps} ${t("steps_unit")}`;
  return base;
}

function verdictSummary(t: (k: string) => string, from: string, to: string, barriers: number, unknowns: number) {
  const verdict: string[] = [];
  if (barriers > 0) verdict.push(`${barriers} ${t("verdict_barrier")}`);
  if (unknowns > 0) verdict.push(`${unknowns} ${t("verdict_unknown")}`);
  return `${from} → ${to}: ${verdict.length ? verdict.join(" · ") : t("verdict_clear")}`;
}

function ChatRouteCard({ id, profile }: { id: string; profile?: string | null }) {
  const { t, lang } = useI18n();
  const [showMap, setShowMap] = useState(false);
  const route = ROUTES.find((r) => r.id === id);
  if (!route) return null;

  const barrierNode = route.nodes.find((n) => n.barrier);
  const barriers = route.nodes.filter((n) => n.barrier).length;
  const unknowns = route.nodes.filter((n) => n.at === "unknown").length;
  const clear = barriers === 0 && unknowns === 0;

  const ProfileIcon = profile ? PROFILE_ICON[profile] : null;
  const profileLabel = profile ? PROFILE_LABEL[profile] : null;

  return (
    <div className="my-3">
      <p className="mb-1.5 rounded-lg border border-ink/10 bg-surface-2 px-3 py-2 text-[13px] font-bold leading-snug text-ink">
        {verdictSummary(t, route.from, route.to, barriers, unknowns)}
      </p>
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-surface">
      {/* header: route + who it's for + today's disruption */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-ink/10 px-3.5 py-2.5">
        <p className="font-display text-[14px] font-bold text-ink">
          {route.from} <span className="text-ink/45" aria-hidden>→</span> {route.to}
        </p>
        {ProfileIcon && profileLabel && (
          <span className="inline-flex items-center gap-1 rounded bg-ink/6 px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
            <ProfileIcon size={12} strokeWidth={2.2} aria-hidden />
            {t("for_word")} {t(profileLabel)}
          </span>
        )}
        {route.disruption && (
          <span className="inline-flex items-center gap-1 rounded bg-caution/15 px-1.5 py-0.5 text-[11px] font-semibold text-caution-ink">
            <TriangleAlert size={11} strokeWidth={2.4} aria-hidden />
            {t("disruption_today")}
          </span>
        )}
      </div>

      {/* verdict strip: the honest bottom line, stated in one glance */}
      <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-2.5">
        {clear ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-ok/12 px-2 py-1 text-[12px] font-bold text-ok-ink">
            <Check size={13} strokeWidth={2.6} aria-hidden />
            {t("verdict_clear")}
          </span>
        ) : (
          <>
            {barriers > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-barrier/10 px-2 py-1 text-[12px] font-bold text-barrier">
                <TriangleAlert size={13} strokeWidth={2.4} aria-hidden />
                {barriers} {t("verdict_barrier")}
              </span>
            )}
            {unknowns > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-unknown/35 bg-unknown/5 px-2 py-1 text-[12px] font-semibold text-ink-soft">
                <span className="hatch-unknown inline-block h-2.5 w-2.5 rounded-[2px]" aria-hidden />
                {unknowns} {t("verdict_unknown")}
              </span>
            )}
          </>
        )}
      </div>

      {/* the payload Google Maps can't produce: barrier + step-free way through */}
      {barrierNode?.barrier && (
        <div className="mx-3.5 mt-2.5 rounded-lg border border-barrier/25 bg-barrier/5 p-2.5 text-[12.5px] leading-snug">
          <p className="flex items-start gap-1.5 font-semibold text-barrier">
            <TriangleAlert size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden />
            <span>{barrierNode.barrier[lang]}</span>
          </p>
          {barrierNode.alt && (
            <p className="mt-1.5 flex items-start gap-1.5 border-t border-ok/20 pt-1.5 text-ok-ink">
              <CornerDownRight size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">{t("alt_label")}:</span> {barrierNode.alt[lang]}
              </span>
            </p>
          )}
        </div>
      )}

      {/* schematic diagram (self-drawn, not a map) */}
      <div className="px-3.5 pt-3">
        <div className="h-[76px] rounded-lg bg-canvas ring-1 ring-ink/10">
          <AccessRibbon route={route} label={t("route_map_label")} />
        </div>
        <p className="mt-1.5 px-0.5 text-[10.5px] text-ink-soft">{t("map_legend_lines")}</p>
      </div>

      {/* Real map, opened on demand. The schematic above carries the accessibility
          story; the map answers "where in Paris". It mounts only when opened, so a
          transcript of many cards never spins up many WebGL maps at once. */}
      <div className="px-3.5 pt-2.5">
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-expanded={showMap}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink/15 bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-signal/50"
        >
          <MapIcon size={14} strokeWidth={2.2} aria-hidden />
          {showMap ? t("hide_map") : t("view_on_map")}
          <ChevronDown
            size={14}
            strokeWidth={2.4}
            aria-hidden
            className={`transition-transform ${showMap ? "rotate-180" : ""}`}
          />
        </button>
        {showMap && (
          <div className="mt-2 h-[240px]">
            <RouteMap route={route} />
          </div>
        )}
      </div>

      {/* demoted per-stop detail */}
      <ul className="px-3.5 pt-1.5">
        {route.nodes.map((n, i) => (
          <li key={i} className="flex items-center gap-2.5 py-[3px]">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: statusColorVar(n.at) }}
              aria-hidden
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
              {n.name}
              {n.restroom && (
                <Accessibility
                  size={12}
                  strokeWidth={2.2}
                  className="ml-1 inline text-ok-ink align-[-1px]"
                  // role is what makes the label reliably announced; without it an
                  // <svg> is exposed inconsistently across screen readers.
                  role="img"
                  aria-label={t("restroom_ok")}
                />
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-ink-soft">
              {n.at === "unknown" && (
                <span className="hatch-unknown inline-block h-2.5 w-2.5 rounded-[2px]" aria-hidden />
              )}
              {n.at === "unknown" ? (
                <CircleHelp size={12} strokeWidth={2.2} aria-hidden />
              ) : null}
              {statusLabel(t, n)}
            </span>
          </li>
        ))}
      </ul>

      {/* provenance + honest freshness */}
      <div className="mt-2 border-t border-ink/10 px-3.5 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{t("sources_label")}</p>
        {/* Chips, not a joined string: the source names contain "·" themselves
            ("IDFM · État des ascenseurs"), so any separator blurs the boundary. */}
        <ul className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10.5px] text-ink-soft">
          {route.sources.map((s) => (
            <li key={s} className="rounded border border-ink/10 bg-canvas px-1.5 py-0.5 leading-snug">
              {s}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10.5px] text-ink-soft">{t("freshness_note")}</p>
      </div>
      </div>
    </div>
  );
}

export default memo(ChatRouteCard);
