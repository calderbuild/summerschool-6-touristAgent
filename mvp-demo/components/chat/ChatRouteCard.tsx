"use client";

import { ROUTES, type RouteNode } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import RouteMap from "../RouteMap";
import { statusColorVar, legendKey } from "@/lib/status";
import { TriangleAlert, CornerDownRight } from "lucide-react";

/**
 * Compact route summary rendered inline in a chat answer (from a [[route:id]]
 * marker): one line per stop, the barrier + step-free alternative kept
 * prominent, and a small map. The full step-by-step spine lives at /routes.
 */

function statusLabel(t: (k: string) => string, n: RouteNode): string {
  const base = t(legendKey[n.at]);
  if (typeof n.steps === "number" && n.steps > 0) return `${base} · ${n.steps} ${t("steps_unit")}`;
  return base;
}

export default function ChatRouteCard({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const route = ROUTES.find((r) => r.id === id);
  if (!route) return null;
  const barrierNode = route.nodes.find((n) => n.barrier);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-ink/12 bg-paper">
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-ink/10 px-3.5 py-2.5">
        <p className="font-display text-[13.5px] font-bold text-ink">
          {route.from} <span className="text-ink/35">→</span> {route.to}
        </p>
        {route.disruption && (
          <span className="inline-flex items-center gap-1 rounded bg-caution/12 px-1.5 py-0.5 text-[10.5px] font-semibold text-caution">
            <TriangleAlert size={11} strokeWidth={2.4} aria-hidden />
            {t("disruption_today")}
          </span>
        )}
      </div>

      {/* one line per stop */}
      <ul className="px-3.5 py-2">
        {route.nodes.map((n, i) => (
          <li key={i} className="flex items-center gap-2.5 py-[3px]">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: statusColorVar(n.at) }}
              aria-hidden
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{n.name}</span>
            <span className="shrink-0 text-[11.5px] font-medium" style={{ color: statusColorVar(n.at) }}>
              {statusLabel(t, n)}
            </span>
          </li>
        ))}
      </ul>

      {/* the one thing that matters: barrier + step-free alternative */}
      {barrierNode?.barrier && (
        <div className="mx-3.5 mb-2.5 rounded-lg border border-barrier/25 bg-barrier/5 p-2.5 text-[12.5px] leading-snug">
          <p className="flex items-start gap-1.5 font-semibold text-barrier">
            <TriangleAlert size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden />
            <span>{barrierNode.barrier[lang]}</span>
          </p>
          {barrierNode.alt && (
            <p className="mt-1.5 flex items-start gap-1.5 border-t border-barrier/15 pt-1.5 text-signal">
              <CornerDownRight size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden />
              <span>{barrierNode.alt[lang]}</span>
            </p>
          )}
        </div>
      )}

      {/* small map for spatial context */}
      <div className="border-t border-ink/10 p-2.5">
        <div className="h-40 overflow-hidden rounded-lg">
          <RouteMap route={route} />
        </div>
      </div>
    </div>
  );
}
